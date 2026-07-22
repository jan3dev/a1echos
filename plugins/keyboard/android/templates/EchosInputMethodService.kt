package com.a1lab.echos.ime

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.PointF
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.view.inputmethod.InputMethodManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
import androidx.core.content.ContextCompat
import java.text.BreakIterator
import java.util.Locale

/**
 * Echos system keyboard with voice transcription.
 *
 * Layout (vertical):
 *   1. Echos top bar — logo + record/stop button driving transcription.
 *   2. Echos keyboard view — the key grid.
 *
 * Transcription runs in the same process as the main app, via
 * [ImeSherpaTranscriber] which calls sherpa-onnx directly.
 */
class EchosInputMethodService : InputMethodService(),
    EchosKeyboardView.KeyboardActionListener,
    EchosEmojiPickerView.Listener,
    EchosKeyboardTopBar.Listener {

    private lateinit var rootFrame: FrameLayout
    private lateinit var container: LinearLayout
    private lateinit var topBar: EchosKeyboardTopBar
    private lateinit var keyboardView: EchosKeyboardView
    private lateinit var keyOverlay: KeyOverlayView
    private var topBarHeightPx: Int = 0
    private var emojiPickerView: EchosEmojiPickerView? = null
    private var emojiSearchOverlay: EchosEmojiSearchOverlayView? = null
    private var emojiSearchIndex: EmojiSearchIndex? = null
    private var emojiSearchQuery: String = ""
    // True while keystroke / delete actions are intercepted into
    // emojiSearchQuery instead of the host's InputConnection.
    private var emojiSearchActive: Boolean = false
    private lateinit var transcriber: ImeSherpaTranscriber
    private var currentEditorAction: Int = EditorInfo.IME_ACTION_NONE
    private val mainHandler = Handler(Looper.getMainLooper())
    private val doubleSpacePeriod = DoubleSpacePeriod()
    private var currentEditorInfo: EditorInfo? = null

    // -- Suggestions (§5.5) --
    private lateinit var suggestionEngine: SuggestionEngine
    /// Learned vocabulary + revert blacklist (§5.11). Loaded off-main in
    /// [onCreate], flushed in [onFinishInputView].
    private lateinit var userLexicon: UserLexicon
    /// Bundled-dictionary correction engine (§5.10). Loaded off-main; until
    /// then [SuggestionEngine] falls back to the system spell checker.
    private lateinit var correctionEngine: CorrectionEngine
    private var keyboardSettings = KeyboardSettings.Settings()
    /// Word the user explicitly kept by tapping the verbatim strip slot —
    /// autocorrect must not fire on it when the separator lands. Cleared on
    /// cursor moves and whenever the composing word ends.
    private var autocorrectSuppressedWord: String? = null
    /// Whether the current field allows suggestions (false for URL / email /
    /// password / no-suggestions fields). Computed once per `onStartInputView`.
    private var suggestionsAllowed: Boolean = false
    /// Latest async result, cached so the legacy (system spell checker)
    /// autocorrect-on-space path can consult it without a second lookup.
    /// Keyed by the word it was computed for. The bundled engine ignores this
    /// cache — it looks up synchronously at commit time, which can't go stale.
    private var lastSuggestionWord: String = ""
    private var lastResult: SuggestionEngine.Result = SuggestionEngine.Result.EMPTY
    /// Pending autocorrect revert target (§5.4): set when a correction
    /// auto-applied on a separator, consumed by the next backspace (which
    /// deletes the separator and offers the typed word in the strip) or any
    /// other keystroke / cursor move.
    private var lastAutoCorrected: LastComposedWord? = null
    /// Active revert offer (§5.4): the user backspaced right after an
    /// autocorrect, so the strip shows the quoted original word — tapping it
    /// swaps the correction back and blacklists the pair. Mirrors the native
    /// iOS revert affordance. Cleared by any other input or cursor move.
    private var pendingRevert: LastComposedWord? = null
    /// Per-character tap coordinates for the in-progress word (spatial
    /// correction model, §5.10). One entry per composing character, appended on
    /// key-down, popped on backspace, and reset whenever the composing word
    /// ends or the cursor/text changes out from under us. Fed to the engine
    /// only when its length matches the reconstructed word — a mismatch falls
    /// back to the static adjacency model rather than skewing costs.
    private val currentWordTouches = ArrayList<CorrectionEngine.TouchPoint?>()
    private val suggestionRunnable = Runnable { performSuggestionLookup() }
    /// One-time nudge guard (§5.5): HyperOS and several OEM builds ship the
    /// system spell checker disabled/absent, so [SuggestionEngine] never gets a
    /// session and the whole suggestion + autocorrect layer silently no-ops.
    /// Android has no always-available bundled equivalent of iOS's
    /// `UITextChecker`, so the first time the user types a word that would have
    /// produced a suggestion we point them at the setting — once, then never
    /// again (persisted in IME-private prefs).
    private var spellCheckerHintShown = false

    private data class LastComposedWord(
        val original: String,
        val corrected: String,
        val separator: String,
    )

    /// Punctuation that commits a pending autocorrect, like space does.
    private val autocorrectTriggers = setOf(".", ",", "!", "?", ";", ":")

    // Tracks where we expect the host's cursor to land after each of
    // our own commit/delete calls. The host then fires `onUpdateSelection`
    // asynchronously to confirm — if the reported position matches
    // an entry in [pendingExpectedPositions], it's our own update and
    // we leave the composing state (double-space window, shift double-
    // tap timer) alone. Otherwise (paste, tap-to-move, external
    // programmatic edit) we treat it as a real cursor jump and reset.
    //
    // Without this, every keystroke fires an `onUpdateSelection` that
    // wipes the double-space window — the user can never get a second
    // space inside the 1100 ms window, so `space space → ". "` never
    // triggers.
    //
    // The queue (rather than a single field) handles multi-step
    // mutations: the smart-period commit fires delete-1 then commit-". "
    // back-to-back, so two echoes will arrive — the first reporting
    // the intermediate cursor after the delete, the second the final
    // position. We must pop both as our own; matching only the latest
    // would treat the first echo as external and clobber state.
    private var expectedSelStart: Int = 0
    private var expectedSelEnd: Int = 0
    private val pendingExpectedPositions: ArrayDeque<Pair<Int, Int>> = ArrayDeque()

    override fun onCreate() {
        super.onCreate()
        transcriber = ImeSherpaTranscriber(this)
        userLexicon = UserLexicon(this)
        correctionEngine = CorrectionEngine(userLexicon)
        // The callback runs on the main thread (sync for the bundled engine;
        // the checker path posts there).
        suggestionEngine = SuggestionEngine(this, correctionEngine) { word, result ->
            lastSuggestionWord = word
            lastResult = result
            if (micState == MicState.IDLE && suggestionsAllowed && !emojiSearchActive) {
                topBar.setSuggestions(suggestionSlots(result))
            } else {
                topBar.setSuggestions(emptyList())
            }
        }
        // Both loads read files (assets + JSON) — keep them off the keystroke
        // path. `isLoaded` flips once and only ever true afterwards, so the
        // main thread simply keeps using the checker fallback until then.
        Thread {
            userLexicon.load()
            correctionEngine.load(this)
        }.start()
    }

    override fun onCreateInputView(): View {
        // keyOverlay is a transparent FrameLayout child that hosts the
        // preview balloon + long-press popup. ColumnSizedFrameLayout sizes
        // itself by its first child so a MATCH_PARENT overlay doesn't blow
        // the IME window up to full screen.
        rootFrame = ColumnSizedFrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            )
        }

        container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
            )
            // Opaque fallback behind the entire keyboard column. The
            // top bar and keyboard view paint their own backgrounds,
            // but a transitional frame (e.g. installing the emoji
            // picker, or a light-mode swap) could otherwise show host
            // content through this column for one frame.
            val bgId = resources.getIdentifier(
                "keyboard_background", "color", packageName,
            )
            if (bgId != 0) {
                setBackgroundColor(ContextCompat.getColor(this@EchosInputMethodService, bgId))
            }
        }

        topBarHeightPx = resources.getIdentifier("keyboard_top_bar_height", "dimen", packageName)
            .let { if (it != 0) resources.getDimensionPixelSize(it) else (48 * resources.displayMetrics.density).toInt() }

        topBar = EchosKeyboardTopBar(this).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, topBarHeightPx)
            setListener(this@EchosInputMethodService)
        }

        keyboardView = EchosKeyboardView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
            setKeyboardActionListener(this@EchosInputMethodService)
        }

        container.addView(topBar)
        container.addView(keyboardView)

        // The overlay's measured size is forced to match the column by
        // ColumnSizedFrameLayout.onMeasure — its layoutParams are advisory.
        keyOverlay = KeyOverlayView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            setKeyboardOffsetY(topBarHeightPx.toFloat())
        }

        rootFrame.addView(container)
        rootFrame.addView(keyOverlay)
        keyboardView.setOverlay(keyOverlay)

        return rootFrame
    }

    /**
     * FrameLayout that sizes itself by its first child (the column) so the
     * IME's measured height tracks the topBar+keyboard total — not the
     * overlay's MATCH_PARENT default, which would make the IME claim the
     * full screen and render the keys at the top.
     */
    private class ColumnSizedFrameLayout(context: android.content.Context) : FrameLayout(context) {
        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val column = getChildAt(0)
            if (column == null) {
                super.onMeasure(widthMeasureSpec, heightMeasureSpec)
                return
            }
            val width = MeasureSpec.getSize(widthMeasureSpec)
            // Measure the column with its own (WRAP_CONTENT) constraints to
            // discover the natural keyboard height.
            column.measure(
                MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED),
            )
            val height = column.measuredHeight
            // Force every other child (the overlay) to the same bounds.
            val exactW = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
            val exactH = MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY)
            for (i in 1 until childCount) {
                getChildAt(i).measure(exactW, exactH)
            }
            setMeasuredDimension(width, height)
        }
    }

    override fun onStartInputView(info: EditorInfo, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        currentEditorAction = info.imeOptions and EditorInfo.IME_MASK_ACTION
        currentEditorInfo = info
        currentWordTouches.clear()
        keyboardView.updateReturnKeyType(currentEditorAction)
        showKeyboardLayout()

        val inputType = info.inputType and android.text.InputType.TYPE_MASK_CLASS
        val variation = info.inputType and android.text.InputType.TYPE_MASK_VARIATION
        // The numeric pads and the phone dial pad drop the top bar for the
        // compact native look.
        val isCompactPad = inputType == android.text.InputType.TYPE_CLASS_NUMBER ||
            inputType == android.text.InputType.TYPE_CLASS_PHONE
        when (inputType) {
            // Gboard parity (§9.2): numeric password fields (PINs / passcodes)
            // get the stripped digits-only pad; all other numeric field types
            // (number / decimal / signed) share the full 4×4 pad.
            android.text.InputType.TYPE_CLASS_NUMBER ->
                if (variation == android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD) {
                    keyboardView.showNumericPasswordPadLayout()
                } else {
                    keyboardView.showNumericPadLayout()
                }
            // Phone fields get Gboard's two-page dial pad (§9.2).
            android.text.InputType.TYPE_CLASS_PHONE -> keyboardView.showPhonePadLayout()
            // Text fields: surface the field-appropriate letter variant (§9.2).
            android.text.InputType.TYPE_CLASS_TEXT -> when (variation) {
                android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
                android.text.InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS ->
                    keyboardView.showEmailLayout()
                android.text.InputType.TYPE_TEXT_VARIATION_URI ->
                    keyboardView.showUriLayout()
                else -> keyboardView.showLetterLayout()
            }
            else -> keyboardView.showLetterLayout()
        }

        // The numeric pads drop the top bar (logo / mic / suggestion strip)
        // for the compact native look, mirroring iOS (§9.1); the keyboard then
        // starts at the very top, so the overlay's key-Y offset is zero.
        topBar.visibility = if (isCompactPad) View.GONE else View.VISIBLE
        keyOverlay.setKeyboardOffsetY(if (isCompactPad) 0f else topBarHeightPx.toFloat())

        // Fresh input field — start-of-document = sentence start.
        doubleSpacePeriod.reset()
        keyboardView.resetShiftDoubleTap()
        // Seed expected cursor from the host's reported initial selection.
        // Defaults to 0 if the host doesn't supply one (initialSelStart = -1).
        expectedSelStart = info.initialSelStart.coerceAtLeast(0)
        expectedSelEnd = info.initialSelEnd.coerceAtLeast(expectedSelStart)
        pendingExpectedPositions.clear()

        // Suggestions (§5.5): refresh the autocorrect preference, recompute
        // whether this field allows suggestions, ensure the spell-checker
        // session is up for the current language, and clear any stale strip.
        keyboardSettings = KeyboardSettings.load(this)
        suggestionsAllowed = computeSuggestionsAllowed(info)
        ensureSuggestionEngineStarted()
        lastAutoCorrected = null
        pendingRevert = null
        clearSuggestions()

        applyAutoCap()
    }

    /**
     * Commit text via the host's [InputConnection] and update the
     * expected cursor position. Use this everywhere instead of calling
     * `commitText` directly so [onUpdateSelection] can tell our own
     * mutations apart from external cursor moves.
     */
    private fun icCommitText(text: String) {
        val ic = currentInputConnection ?: return
        ic.commitText(text, 1)
        // If there was a selection, it's replaced. Cursor lands at the
        // smaller anchor plus the inserted text length.
        val anchor = minOf(expectedSelStart, expectedSelEnd)
        expectedSelStart = anchor + text.length
        expectedSelEnd = expectedSelStart
        pendingExpectedPositions.addLast(expectedSelStart to expectedSelEnd)
    }

    private fun icDeleteSurroundingText(beforeLength: Int, afterLength: Int) {
        val ic = currentInputConnection ?: return
        ic.deleteSurroundingText(beforeLength, afterLength)
        expectedSelStart = (expectedSelStart - beforeLength).coerceAtLeast(0)
        expectedSelEnd = expectedSelStart
        pendingExpectedPositions.addLast(expectedSelStart to expectedSelEnd)
    }

    /**
     * Cursor moves are an out-of-band signal to abandon any in-flight
     * composing state. Without this, the user could double-tap shift,
     * move the cursor, then tap shift again and accidentally engage
     * caps lock. Same for the smart double-space window.
     */
    override fun onUpdateSelection(
        oldSelStart: Int,
        oldSelEnd: Int,
        newSelStart: Int,
        newSelEnd: Int,
        candidatesStart: Int,
        candidatesEnd: Int,
    ) {
        super.onUpdateSelection(
            oldSelStart, oldSelEnd,
            newSelStart, newSelEnd,
            candidatesStart, candidatesEnd,
        )
        // The host fires this after every text commit — including our
        // own. The smart-period commit issues two IC ops in a row
        // (delete + commit), so we may have several pending echoes.
        // Pop the front of the queue if it matches; treat any other
        // position as an external cursor move and reset state.
        val front = pendingExpectedPositions.firstOrNull()
        val isOurEcho = front != null &&
            newSelStart == front.first &&
            newSelEnd == front.second
        if (isOurEcho) {
            pendingExpectedPositions.removeFirst()
        } else {
            pendingExpectedPositions.clear()
            expectedSelStart = newSelStart
            expectedSelEnd = newSelEnd
            doubleSpacePeriod.reset()
            keyboardView.resetShiftDoubleTap()
            // A real cursor jump invalidates the composing word, the
            // autocorrect revert window, and any verbatim-tap suppression —
            // drop them and recompute the strip.
            lastAutoCorrected = null
            pendingRevert = null
            autocorrectSuppressedWord = null
            currentWordTouches.clear()
            refreshSuggestions()
        }
        applyAutoCap()
    }

    private fun applyAutoCap() {
        when (AutoCapEngine.decide(currentInputConnection, currentEditorInfo)) {
            AutoCapEngine.Decision.CAPITALIZE -> keyboardView.applyAutoShift(true)
            AutoCapEngine.Decision.LOWERCASE -> keyboardView.applyAutoShift(false)
            AutoCapEngine.Decision.DISABLED -> Unit
        }
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        // Persist any learning from this session (debounced writes may still
        // be pending).
        userLexicon.flush()
        transcriber.cancelIfActive()
        topBar.setMicState(MicState.IDLE)
        // Release the lock if we still hold it — otherwise dismissing the
        // keyboard mid-record would leave the lock stuck and silently block
        // the next attempt.
        RecordingLock.release("ime")
        // Drop any composing state — the next input field gets a clean slate.
        doubleSpacePeriod.reset()
        keyboardView.resetShiftDoubleTap()
        pendingExpectedPositions.clear()
        currentEditorInfo = null
        // Cancel any in-flight suggestion lookup and clear the strip.
        mainHandler.removeCallbacks(suggestionRunnable)
        lastAutoCorrected = null
        pendingRevert = null
        clearSuggestions()
    }

    override fun onDestroy() {
        // Belt-and-braces: onFinishInputView usually releases the lock first,
        // but a process-kill path skips it and would leak the lock until
        // the main app restarts.
        RecordingLock.release("ime")
        transcriber.release()
        suggestionEngine.close()
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Re-read dimens so the `values-land/` overrides (shorter key
        // height, tighter vertical gap) actually apply on rotation —
        // IMEs keep their input view across config changes, so values
        // loaded once at init would stay stale.
        if (::keyboardView.isInitialized) {
            keyboardView.reloadDimensions()
        }
        // Drop the cached emoji picker and search overlay — both pick
        // their visible-row count from the current orientation at
        // construction time, so stale instances would keep portrait
        // dimensions after a rotation. Next show rebuilds them with
        // the right size.
        val pickerWasVisible = emojiPickerView?.visibility == View.VISIBLE
        emojiPickerView?.let {
            if (it.parent is ViewGroup) (it.parent as ViewGroup).removeView(it)
        }
        emojiPickerView = null
        val searchWasVisible = emojiSearchOverlay?.visibility == View.VISIBLE
        // Preserve the in-progress search query so rotation doesn't wipe
        // what the user typed — `enterEmojiSearchMode` resets it.
        val preservedSearchQuery = if (searchWasVisible) emojiSearchQuery else ""
        emojiSearchOverlay?.let {
            if (it.parent is ViewGroup) (it.parent as ViewGroup).removeView(it)
        }
        emojiSearchOverlay = null
        if (searchWasVisible) {
            enterEmojiSearchMode()
            if (preservedSearchQuery.isNotEmpty()) {
                emojiSearchQuery = preservedSearchQuery
                refreshEmojiSearchOverlay()
            }
        } else if (pickerWasVisible) {
            showEmojiPicker()
        }
    }

    // -- KeyboardActionListener --

    override fun onKeyPress(char: String, normalizedTouch: PointF?) {
        if (emojiSearchActive) {
            emojiSearchQuery += char.lowercase()
            refreshEmojiSearchOverlay()
            return
        }
        // Any non-space, non-backspace input invalidates the smart
        // double-space window. Letters / digits / accents all reset.
        doubleSpacePeriod.reset()
        // Sentence punctuation commits a pending autocorrect exactly like
        // space does ("teh." becomes "the."). The commit reads the word's
        // touch buffer, so reset it only once the word has ended.
        if (char in autocorrectTriggers && commitWithAutocorrect(char)) {
            currentWordTouches.clear()
            applyContextualContraction(char)
            applyAutoCap()
            refreshSuggestions()
            return
        }
        if (char.length == 1 && SpacingAndPunctuations.isWordSeparator(char[0])) {
            observeSeparatorCommit()
        }
        // Typing past an autocorrect ends its one-shot revert window.
        lastAutoCorrected = null
        pendingRevert = null
        recordTouch(char, normalizedTouch)
        icCommitText(char)
        // A separator ends the previous word too, so it can trigger a
        // context-aware confusable fix even when the current word wasn't
        // autocorrected ("ill be." — "be" is valid, so no commit fired above).
        if (char.length == 1 && SpacingAndPunctuations.isWordSeparator(char[0])) {
            applyContextualContraction(char)
        }
        applyAutoCap()
        refreshSuggestions()
    }

    /// Records the tap for a committed character into the composing-word touch
    /// buffer: a point for a letter, null for other in-word characters, and a
    /// reset for word separators or multi-character commits (emoji).
    private fun recordTouch(char: String, point: PointF?) {
        val c = char.singleOrNull()
        if (c == null || SpacingAndPunctuations.isWordSeparator(c)) {
            currentWordTouches.clear()
            return
        }
        currentWordTouches.add(
            if (point != null && c.isLetter()) {
                CorrectionEngine.TouchPoint(point.x, point.y)
            } else {
                null
            }
        )
    }

    /// The composing-word touch buffer, but only when it lines up with the
    /// word the engine will score — otherwise null, so a desynced buffer falls
    /// back to the static adjacency model.
    private fun touchPointsMatching(word: String): List<CorrectionEngine.TouchPoint?>? =
        if (currentWordTouches.size == word.length) ArrayList(currentWordTouches) else null

    /**
     * After a word + separator commits, retroactively fix a confusable
     * previous word using the just-committed word as context ("ill be" ->
     * "I'll be"). Gated under the autocorrect setting; only rewrites a
     * single-space-separated pair whose exact text is still present before the
     * cursor, so a host that rewrote the field can never misfire it.
     */
    private fun applyContextualContraction(separator: String) {
        if (!keyboardSettings.autocorrect || separator.isEmpty()) return
        val ic = currentInputConnection ?: return
        val before = ic.getTextBeforeCursor(64, 0)?.toString() ?: return
        if (!before.endsWith(separator)) return
        val afterW2 = before.dropLast(separator.length) // "...P W2"
        val w2 = trailingWord(afterW2)
        if (w2.isEmpty()) return
        val afterSpace = afterW2.dropLast(w2.length) // "...P "
        if (!afterSpace.endsWith(" ")) return // single space only
        val beforeSpace = afterSpace.dropLast(1) // "...P"
        val lastCh = beforeSpace.lastOrNull()
        if (lastCh != null && SpacingAndPunctuations.isWordSeparator(lastCh)) return
        val prev = trailingWord(beforeSpace)
        if (prev.isEmpty()) return
        val contraction = correctionEngine.contextualContraction(prev, w2) ?: return
        val deleteCount = separator.length + w2.length + 1 + prev.length
        icDeleteSurroundingText(deleteCount, 0)
        icCommitText(contraction + " " + w2 + separator)
    }

    /** The trailing run of non-separator characters in [text] (its last word). */
    private fun trailingWord(text: String): String {
        var start = text.length
        while (start > 0 && !SpacingAndPunctuations.isWordSeparator(text[start - 1])) {
            start--
        }
        return text.substring(start)
    }

    /**
     * Runs autocorrect for the in-progress word, committing the corrected
     * word plus [separator] when the engine is confident. Returns true when
     * it handled the commit. Shared by the space, punctuation, and return
     * paths (§5.10).
     */
    private fun commitWithAutocorrect(separator: String): Boolean {
        val ic = currentInputConnection ?: return false
        if (!keyboardSettings.autocorrect || !suggestionsAllowed ||
            micState != MicState.IDLE
        ) {
            return false
        }
        // Mid-word guard: only correct when the cursor is at the word's end.
        val after = ic.getTextAfterCursor(1, 0)?.toString().orEmpty()
        if (after.isNotEmpty() && !SpacingAndPunctuations.isWordSeparator(after[0])) {
            return false
        }
        val before = ic.getTextBeforeCursor(48, 0)?.toString().orEmpty()
        val word = SuggestionEngine.currentWordBefore(before)
        if (word.isEmpty() || word.equals(autocorrectSuppressedWord, ignoreCase = true)) {
            return false
        }
        val previous = SuggestionEngine.previousWordBefore(before, word)
        val corrected: String? = if (suggestionEngine.usesBundledEngine) {
            // Synchronous lookup — the decision can never be stale.
            val result = suggestionEngine.lookupNow(word, previous, touchPointsMatching(word))
            if (result.topIsCorrection) result.replacement else null
        } else {
            // Legacy checker path: consult the cached async result.
            if (word == lastSuggestionWord && lastResult.topIsCorrection) {
                lastResult.replacement
            } else {
                null
            }
        }
        // Exact compare: case-only corrections (i -> I, france -> France)
        // must apply too.
        if (corrected == null || corrected == word) return false
        icDeleteSurroundingText(word.length, 0)
        icCommitText(corrected + separator)
        lastAutoCorrected = LastComposedWord(word, corrected, separator)
        pendingRevert = null
        autocorrectSuppressedWord = null
        // The corrected pair feeds prediction learning too.
        if (previous != null && !corrected.contains(' ')) {
            userLexicon.observeBigram(previous, corrected)
        }
        return true
    }

    /**
     * Learning hook (§5.11): a separator is about to end the in-progress
     * word — feed it to the user lexicon. Unknown words are learned after
     * two commits; known words strengthen their suggestion weight, and known
     * word pairs feed next-word prediction.
     */
    private fun observeSeparatorCommit() {
        if (micState != MicState.IDLE || !suggestionsAllowed) return
        val ic = currentInputConnection ?: return
        val after = ic.getTextAfterCursor(1, 0)?.toString().orEmpty()
        if (after.isNotEmpty() && !SpacingAndPunctuations.isWordSeparator(after[0])) {
            return
        }
        val before = ic.getTextBeforeCursor(48, 0)?.toString().orEmpty()
        val word = SuggestionEngine.currentWordBefore(before)
        if (word.isEmpty()) return
        val isKnown = correctionEngine.contains(word) || userLexicon.contains(word)
        userLexicon.observeCommit(word, isKnown)
        // Predictions learn only vetted pairs — a typo must never resurface
        // as a suggestion.
        if (isKnown) {
            SuggestionEngine.previousWordBefore(before, word)?.let { previous ->
                userLexicon.observeBigram(previous, word)
            }
        }
        autocorrectSuppressedWord = null
    }

    override fun onDeletePress() {
        if (emojiSearchActive) {
            if (emojiSearchQuery.isNotEmpty()) {
                emojiSearchQuery = emojiSearchQuery.dropLast(1)
                refreshEmojiSearchOverlay()
            }
            return
        }
        // A backspace within 1100 ms of a smart `. ` commit reverts it
        // back to a double space — matches LatinIME's "undo correction"
        // behaviour for this specific helper.
        if (doubleSpacePeriod.shouldUndoPeriod()) {
            val ic = currentInputConnection
            val before = ic?.getTextBeforeCursor(2, 0)?.toString().orEmpty()
            if (ic != null && before == ". ") {
                currentWordTouches.clear()
                icDeleteSurroundingText(2, 0)
                icCommitText("  ")
                applyAutoCap()
                refreshSuggestions()
                return
            }
        }
        // Backspace after an autocorrect (§5.4): delete normally (removing
        // the separator, matching native iOS — the correction itself stays),
        // then offer the quoted original in the strip so one tap restores it.
        val auto = lastAutoCorrected
        if (auto != null) {
            lastAutoCorrected = null
            val ic = currentInputConnection
            val expected = auto.corrected + auto.separator
            val before = ic?.getTextBeforeCursor(expected.length, 0)?.toString().orEmpty()
            if (ic != null && auto.separator.isNotEmpty() && before == expected) {
                currentWordTouches.clear()
                icDeleteSurroundingText(auto.separator.length, 0)
                pendingRevert = auto
                applyAutoCap()
                refreshSuggestions()
                return
            }
        }
        pendingRevert = null
        // Keep the touch buffer aligned with the shrinking word; the
        // length-match guard covers any residual desync.
        if (currentWordTouches.isNotEmpty()) currentWordTouches.removeAt(currentWordTouches.size - 1)
        deleteOneGrapheme()
        applyAutoCap()
        refreshSuggestions()
    }

    override fun onDeleteWord() {
        if (emojiSearchActive) {
            if (emojiSearchQuery.isNotEmpty()) {
                emojiSearchQuery = ""
                refreshEmojiSearchOverlay()
            }
            return
        }
        lastAutoCorrected = null
        pendingRevert = null
        currentWordTouches.clear()
        deleteWordBackward()
        clearSuggestions()
    }

    // Grapheme-cluster delete — deleteSurroundingText(1, 0) drops half a
    // surrogate pair for emoji/ZWJ sequences and leaves "?" until the user
    // taps delete again.
    private fun deleteOneGrapheme() {
        val ic: InputConnection = currentInputConnection ?: return
        val selected = ic.getSelectedText(0)
        if (!selected.isNullOrEmpty()) {
            icCommitText("")
            return
        }
        val before = ic.getTextBeforeCursor(32, 0)?.toString().orEmpty()
        if (before.isEmpty()) return
        val bi = BreakIterator.getCharacterInstance()
        bi.setText(before)
        val end = bi.last()
        val prev = bi.previous()
        val deleteLen = if (prev == BreakIterator.DONE) 1 else end - prev
        icDeleteSurroundingText(deleteLen, 0)
    }

    override fun onSpacePress() {
        if (emojiSearchActive) {
            emojiSearchQuery += " "
            refreshEmojiSearchOverlay()
            return
        }
        val ic = currentInputConnection
        // Smart double-space → ". ". Check the two chars before the
        // cursor: if it looks like `<letter|digit|allowed-punct> ` and
        // we're inside the 1100 ms window, swap the trailing space
        // for `. ` (LatinIME §4.5).
        val before = ic?.getTextBeforeCursor(2, 0)?.toString().orEmpty()
        // Smart double-space → ". " runs first and unchanged — it owns the case
        // where the previous keystroke was already a space.
        if (ic != null && doubleSpacePeriod.shouldCommitPeriod(before)) {
            lastAutoCorrected = null
            pendingRevert = null
            currentWordTouches.clear()
            icDeleteSurroundingText(1, 0)
            icCommitText(". ")
            doubleSpacePeriod.markPeriodCommitted()
            applyAutoCap()
            clearSuggestions()
            return
        }
        // Autocorrect-on-space (§5.10) — only when the user enabled it. The
        // commit reads the word's touch buffer, so reset it only afterwards.
        if (commitWithAutocorrect(" ")) {
            currentWordTouches.clear()
            applyContextualContraction(" ")
            doubleSpacePeriod.recordSpaceCommit()
            applyAutoCap()
            refreshSuggestions()
            return
        }
        observeSeparatorCommit()
        lastAutoCorrected = null
        pendingRevert = null
        currentWordTouches.clear()
        icCommitText(" ")
        applyContextualContraction(" ")
        doubleSpacePeriod.recordSpaceCommit()
        applyAutoCap()
        refreshSuggestions()
    }

    override fun onReturnPress() {
        if (emojiSearchActive) {
            val first = emojiSearchIndex?.search(emojiSearchQuery)?.firstOrNull()
            if (first != null) {
                commitEmoji(first)
                RecentEmojis.record(this, first)
            }
            exitEmojiSearchMode()
            return
        }
        doubleSpacePeriod.reset()
        val ic = currentInputConnection ?: return
        if (currentEditorAction != EditorInfo.IME_ACTION_NONE) {
            // Apply a pending autocorrect before the action fires (send /
            // search may dismiss the field). Empty separator: the action is
            // the terminator. The revert check tolerates a vanished field —
            // the before-text comparison simply fails.
            commitWithAutocorrect("")
            currentWordTouches.clear()
            // performEditorAction may dismiss the field entirely — we
            // don't try to predict the cursor, the onUpdateSelection
            // echo will reseed it.
            ic.performEditorAction(currentEditorAction)
            applyAutoCap()
            clearSuggestions()
            return
        }
        // Return commits a pending autocorrect too, then still newlines.
        if (commitWithAutocorrect("\n")) {
            currentWordTouches.clear()
            applyContextualContraction("\n")
            applyAutoCap()
            refreshSuggestions()
            return
        }
        observeSeparatorCommit()
        lastAutoCorrected = null
        pendingRevert = null
        currentWordTouches.clear()
        icCommitText("\n")
        applyContextualContraction("\n")
        applyAutoCap()
        clearSuggestions()
    }

    override fun onMicPress() = toggleRecording()
    override fun onMicRelease() {}

    override fun onEmojiPress() {
        if (emojiSearchActive) {
            exitEmojiSearchMode()
            return
        }
        showEmojiPicker()
    }

    override fun onSwitchKeyboard() {
        switchToNextInputMethod(false)
    }

    override fun onShowKeyboardPicker() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.showInputMethodPicker()
    }

    /**
     * Recapitalize-on-selection (§4.7). With text selected, shift replaces the
     * selection with the next case form (lower -> Title -> UPPER) and re-selects
     * the result so a follow-up shift tap keeps cycling. Returns false (normal
     * shift) when nothing is selected.
     */
    override fun onShiftTap(): Boolean {
        if (emojiSearchActive) return false
        val ic = currentInputConnection ?: return false
        val selected = ic.getSelectedText(0)
        if (selected.isNullOrEmpty()) return false
        val next = RecapitalizeEngine.nextCase(selected.toString()) ?: return false

        val anchor = minOf(expectedSelStart, expectedSelEnd)
        doubleSpacePeriod.reset()
        // commitText replaces the selection (cursor lands after the run), then
        // setSelection re-selects it. Each op fires its own onUpdateSelection
        // echo, so push both expected positions (same pattern as the smart-
        // period delete+commit) to keep them from being read as a cursor move.
        ic.commitText(next, 1)
        pendingExpectedPositions.addLast((anchor + next.length) to (anchor + next.length))
        ic.setSelection(anchor, anchor + next.length)
        pendingExpectedPositions.addLast(anchor to (anchor + next.length))
        expectedSelStart = anchor
        expectedSelEnd = anchor + next.length
        return true
    }

    /**
     * Walks the user toward granting RECORD_AUDIO. IMEs can't request runtime
     * permissions directly (no UI host), so we open the main Echos app —
     * which already has the runtime permission flow wired up — and surface
     * a Toast so the path is obvious.
     */
    private fun promptForMicPermission() {
        Toast.makeText(
            this,
            "Open Echos to grant microphone access first",
            Toast.LENGTH_LONG,
        ).show()
        try {
            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            launchIntent?.let { startActivity(it) }
        } catch (_: Exception) {
            // If launching the main app fails (very unlikely), the toast
            // above still tells the user where to go — they can also grant
            // mic access from system Settings → Apps → Echos.
        }
    }

    /// Emoji commits invalidate any in-flight smart-double-space window
    /// (just like any non-space, non-backspace input) and need to refresh
    /// the auto-cap state so the shift indicator tracks the new cursor.
    private fun commitEmoji(emoji: String) {
        doubleSpacePeriod.reset()
        currentWordTouches.clear()
        icCommitText(emoji)
        applyAutoCap()
    }

    // -- EmojiPickerView.Listener --

    override fun onEmojiSelected(emoji: String) {
        commitEmoji(emoji)
    }

    override fun onBackToLetters() {
        showKeyboardLayout()
    }

    override fun onActivateSearch() {
        enterEmojiSearchMode()
    }

    // -- View swapping --

    private fun showEmojiPicker() {
        val picker = emojiPickerView ?: EchosEmojiPickerView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
            setListener(this@EchosInputMethodService)
        }.also { emojiPickerView = it }
        if (picker.parent == null) container.addView(picker)
        keyboardView.visibility = View.GONE
        picker.visibility = View.VISIBLE
        picker.refresh()
        topBar.visibility = View.VISIBLE
    }

    private fun showKeyboardLayout() {
        emojiPickerView?.visibility = View.GONE
        keyboardView.visibility = View.VISIBLE
        exitEmojiSearchMode(suppressViewSwap = true)
        topBar.visibility = View.VISIBLE
    }

    private fun enterEmojiSearchMode() {
        emojiSearchActive = true
        emojiSearchQuery = ""
        if (emojiSearchIndex == null) {
            emojiSearchIndex = EmojiSearchIndex(this)
        }
        installSearchOverlayIfNeeded()
        emojiSearchOverlay?.visibility = View.VISIBLE
        topBar.visibility = View.GONE
        emojiPickerView?.visibility = View.GONE
        keyboardView.visibility = View.VISIBLE
        keyboardView.showLetterLayout()
        keyboardView.updateReturnKeyType(currentEditorAction)
        keyboardView.setReturnAsCheckmark(true)
        refreshEmojiSearchOverlay()
        // The long-press preview balloon translates rects from keyboard-
        // view coords to overlay coords using `keyboardOffsetY`. With the
        // top bar hidden and the search overlay sitting above the
        // keyboard, the offset has to track the search overlay's height
        // — otherwise the balloon floats far above the keys.
        emojiSearchOverlay?.let { overlay ->
            val overlayPx = (overlay.measuredOverlayHeightDp() * resources.displayMetrics.density).toInt()
            keyOverlay.setKeyboardOffsetY(overlayPx.toFloat())
        }
    }

    private fun exitEmojiSearchMode(suppressViewSwap: Boolean = false) {
        if (!emojiSearchActive) return
        emojiSearchActive = false
        emojiSearchQuery = ""
        emojiSearchOverlay?.visibility = View.GONE
        keyboardView.setReturnAsCheckmark(false)
        keyOverlay.setKeyboardOffsetY(topBarHeightPx.toFloat())
        if (!suppressViewSwap) {
            showEmojiPicker()
        }
    }

    private fun installSearchOverlayIfNeeded() {
        if (emojiSearchOverlay != null) return
        val overlay = EchosEmojiSearchOverlayView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
            setListener(object : EchosEmojiSearchOverlayView.Listener {
                override fun onClearQuery() {
                    emojiSearchQuery = ""
                    refreshEmojiSearchOverlay()
                }
                override fun onEmojiSelected(emoji: String) {
                    // Stay in search mode so the user can keep firing
                    // matches — Gboard does the same. Only the back arrow
                    // and the return-key checkmark leave search mode.
                    commitEmoji(emoji)
                    RecentEmojis.record(this@EchosInputMethodService, emoji)
                }
                override fun onLeaveSearch() {
                    exitEmojiSearchMode()
                }
            })
        }
        container.addView(overlay, container.indexOfChild(topBar) + 1)
        emojiSearchOverlay = overlay
    }

    private fun refreshEmojiSearchOverlay() {
        val overlay = emojiSearchOverlay ?: return
        val results: List<String> = if (emojiSearchQuery.isEmpty()) {
            val recents = EmojiData.emojis(EmojiCategory.RECENTS, this)
            if (recents.isNotEmpty()) recents
            else EmojiData.emojis(EmojiCategory.SMILEYS, this).take(40)
        } else {
            emojiSearchIndex?.search(emojiSearchQuery).orEmpty()
        }
        overlay.setQuery(emojiSearchQuery, results)
    }

    private fun deleteWordBackward() {
        val ic = currentInputConnection ?: return
        val selected = ic.getSelectedText(0)
        if (!selected.isNullOrEmpty()) {
            icCommitText("")
            return
        }
        val before = ic.getTextBeforeCursor(256, 0)?.toString().orEmpty()
        if (before.isEmpty()) return
        var idx = before.length - 1
        var count = 0
        while (idx >= 0 && before[idx].isWhitespace()) {
            count++
            idx--
        }
        while (idx >= 0 && !before[idx].isWhitespace()) {
            count++
            idx--
        }
        if (count == 0) count = 1
        icDeleteSurroundingText(count, 0)
    }

    // -- TopBar.Listener --

    override fun onRecordClick() {
        toggleRecording()
    }

    override fun onSuggestionTapped(slot: SuggestionSlot) {
        val ic = currentInputConnection ?: return
        // Selecting a slot replaces or ends the composing word; its per-key
        // touch buffer no longer applies.
        currentWordTouches.clear()
        val before = ic.getTextBeforeCursor(48, 0)?.toString().orEmpty()
        // During a revert offer the verbatim slot swaps the correction back
        // to the typed word and blacklists the pair.
        val revert = pendingRevert
        if (revert != null && slot.isVerbatim) {
            pendingRevert = null
            if (!before.endsWith(revert.corrected)) return
            doubleSpacePeriod.reset()
            icDeleteSurroundingText(revert.corrected.length, 0)
            icCommitText(revert.original)
            userLexicon.recordRevert(revert.original, revert.corrected)
            userLexicon.learnNow(revert.original)
            autocorrectSuppressedWord = revert.original
            applyAutoCap()
            refreshSuggestions()
            return
        }
        val current = SuggestionEngine.currentWordBefore(before)
        if (current.isEmpty()) {
            // Next-word prediction tap: nothing to replace — insert the word
            // plus a space.
            if (!slot.isVerbatim) {
                doubleSpacePeriod.reset()
                lastAutoCorrected = null
                pendingRevert = null
                icCommitText(slot.text + " ")
                applyAutoCap()
                refreshSuggestions()
            }
            return
        }
        if (slot.isVerbatim) {
            // Keep the typed word: learn it and stop autocorrect from
            // touching it when the separator lands.
            doubleSpacePeriod.reset()
            lastAutoCorrected = null
            userLexicon.learnNow(current)
            autocorrectSuppressedWord = current
            refreshSuggestions()
            return
        }
        replaceCurrentWord(slot.text)
    }

    /** Builds the strip layout from a lookup result. While a correction is
     *  pending it mirrors native QuickType: quoted typed word on the left,
     *  the correction emphasized in the center, a runner-up on the right. */
    private fun suggestionSlots(result: SuggestionEngine.Result): List<SuggestionSlot> {
        val verbatim = result.verbatim
        val replacement = result.replacement
        if (!result.topIsCorrection || verbatim == null || replacement == null) {
            return result.candidates.map { SuggestionSlot.candidate(it) }
        }
        val slots = mutableListOf(
            SuggestionSlot(verbatim, isVerbatim = true, isEmphasized = false),
            SuggestionSlot(replacement, isVerbatim = false, isEmphasized = true),
        )
        result.candidates.firstOrNull { !it.equals(replacement, ignoreCase = true) }
            ?.let { slots.add(SuggestionSlot.candidate(it)) }
        return slots
    }

    // -- Suggestions (§5.5) --

    /**
     * Recomputes the suggestion strip for the current composing word, debounced
     * onto the main handler. Clears the strip (no-op early) when the bar is
     * busy, the field disallows suggestions, or we're in emoji search.
     */
    private fun refreshSuggestions() {
        mainHandler.removeCallbacks(suggestionRunnable)
        if (micState != MicState.IDLE || !suggestionsAllowed || emojiSearchActive) {
            clearSuggestions()
            return
        }
        // Coalesce rapid keystrokes — the async spell-check request can
        // outlive several taps; the engine's word guard drops stale results.
        mainHandler.postDelayed(suggestionRunnable, 120L)
    }

    private fun performSuggestionLookup() {
        val ic = currentInputConnection
        if (ic == null) {
            clearSuggestions()
            return
        }
        // Revert offer (§5.4): the user just backspaced an autocorrect's
        // separator — show the quoted original until they type on.
        val revert = pendingRevert
        if (revert != null) {
            val tail = ic.getTextBeforeCursor(revert.corrected.length, 0)
                ?.toString().orEmpty()
            if (tail == revert.corrected) {
                topBar.setSuggestions(
                    listOf(
                        SuggestionSlot(
                            revert.original,
                            isVerbatim = true,
                            isEmphasized = false,
                        ),
                    ),
                )
                return
            }
            pendingRevert = null
        }
        // Mid-word guard: only suggest when the cursor is at a word's end.
        val after = ic.getTextAfterCursor(1, 0)?.toString().orEmpty()
        if (after.isNotEmpty() && !SpacingAndPunctuations.isWordSeparator(after[0])) {
            clearSuggestions()
            return
        }
        val before = ic.getTextBeforeCursor(48, 0)?.toString().orEmpty()
        val word = SuggestionEngine.currentWordBefore(before)
        if (word.isEmpty()) {
            autocorrectSuppressedWord = null
            // Next-word prediction (§5.12): after a word (possibly across a
            // comma) offer its likely continuations; at a sentence start or
            // empty field offer curated openers, capitalized. Only at an
            // actual word boundary — never glued right after unspaced
            // punctuation.
            val previous = SuggestionEngine.previousWordBefore(before, "")
            if (before.isEmpty() || before.endsWith(" ") || previous != null) {
                var predictions = suggestionEngine.predictions(previous ?: "")
                if (previous == null) {
                    predictions = predictions.map {
                        it.replaceFirstChar { c -> c.uppercase() }
                    }
                }
                if (predictions.isNotEmpty()) {
                    topBar.setSuggestions(
                        predictions.map { SuggestionSlot.candidate(it) },
                    )
                    return
                }
            }
            clearSuggestions()
            return
        }
        // The bundled engine handles 1-char words itself ("i" -> "I"); the
        // system checker is useless below 2 chars.
        if (word.length < 2 && !suggestionEngine.usesBundledEngine) {
            clearSuggestions()
            return
        }
        // Non-English fallback with no system spell checker — the request
        // would no-op and the strip stay empty forever. Nudge the user toward
        // enabling one (once) instead of failing silently. (English never
        // lands here: the bundled engine is always ready.)
        if (!suggestionEngine.isReady()) {
            maybeShowSpellCheckerHint()
            return
        }
        suggestionEngine.request(
            word,
            SuggestionEngine.previousWordBefore(before, word),
            touchPointsMatching(word),
        )
    }

    /**
     * Surfaces a one-time toast pointing the user at the system spell-checker
     * setting when none is enabled. Persisted in IME-private prefs so it shows
     * at most once per install — a missing checker is a setup gap, not a
     * recurring error worth nagging about.
     */
    private fun maybeShowSpellCheckerHint() {
        if (spellCheckerHintShown) return
        spellCheckerHintShown = true
        val prefs = getSharedPreferences("echos_ime", Context.MODE_PRIVATE)
        if (prefs.getBoolean("spell_checker_hint_shown", false)) return
        prefs.edit().putBoolean("spell_checker_hint_shown", true).apply()
        Toast.makeText(
            this,
            "Turn on a system spell checker in Settings ▸ Languages & input ▸ " +
                "Spell checker to get word suggestions in Echos.",
            Toast.LENGTH_LONG,
        ).show()
    }

    private fun clearSuggestions() {
        lastSuggestionWord = ""
        lastResult = SuggestionEngine.Result.EMPTY
        topBar.setSuggestions(emptyList())
    }

    /** Replaces the in-progress word with [candidate] (tap-to-apply, §5.5). No
     *  trailing space — the user keeps control of word spacing. */
    private fun replaceCurrentWord(candidate: String) {
        val ic = currentInputConnection ?: return
        val before = ic.getTextBeforeCursor(48, 0)?.toString().orEmpty()
        val current = SuggestionEngine.currentWordBefore(before)
        if (current.isEmpty()) return
        doubleSpacePeriod.reset()
        lastAutoCorrected = null
        pendingRevert = null
        icDeleteSurroundingText(current.length, 0)
        icCommitText(candidate)
        applyAutoCap()
        clearSuggestions()
    }

    /** Starts the spell-checker session for the host locale. Suggestions follow
     *  the device language, independent of the ASR model's spoken language —
     *  the spoken-language setting only affects transcription, not typing. */
    private fun ensureSuggestionEngineStarted() {
        suggestionEngine.start(Locale.getDefault())
    }

    /** Suppresses suggestions in URL / email / password / no-suggestions
     *  fields, mirroring auto-cap's opt-out. */
    private fun computeSuggestionsAllowed(info: EditorInfo): Boolean {
        val klass = info.inputType and android.text.InputType.TYPE_MASK_CLASS
        if (klass != android.text.InputType.TYPE_CLASS_TEXT) return false
        val variation = info.inputType and android.text.InputType.TYPE_MASK_VARIATION
        when (variation) {
            android.text.InputType.TYPE_TEXT_VARIATION_URI,
            android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
            android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD,
            android.text.InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
            android.text.InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD,
            android.text.InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS,
            android.text.InputType.TYPE_TEXT_VARIATION_FILTER -> return false
        }
        if (info.inputType and android.text.InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS != 0) {
            return false
        }
        return true
    }

    // -- Transcription --

    private var micState: MicState = MicState.IDLE

    private fun setMicState(state: MicState) {
        micState = state
        topBar.setMicState(state)
        // Recording / transcribing owns the bar — drop the strip; idle lets
        // the next keystroke re-show suggestions.
        if (state != MicState.IDLE) {
            mainHandler.removeCallbacks(suggestionRunnable)
            clearSuggestions()
        }
    }

    private fun toggleRecording() {
        currentWordTouches.clear()
        when (micState) {
            MicState.RECORDING -> {
                setMicState(MicState.TRANSCRIBING)
                transcriber.stopRecording()
            }
            MicState.TRANSCRIBING -> Unit // Ignore taps while transcribing.
            MicState.IDLE -> startTranscription()
        }
    }

    private fun startTranscription() {
        // AudioRecord doesn't throw without RECORD_AUDIO — it just returns
        // STATE_UNINITIALIZED. Check the permission up front instead.
        if (
            ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            promptForMicPermission()
            setMicState(MicState.IDLE)
            return
        }
        if (!RecordingLock.tryAcquire("ime")) {
            setMicState(MicState.IDLE)
            Toast.makeText(this, "Echos is recording — close the app and try again", Toast.LENGTH_LONG).show()
            return
        }
        setMicState(MicState.RECORDING)
        transcriber.startTranscription(
            onResult = { text ->
                mainHandler.post {
                    icCommitText(text)
                    setMicState(MicState.IDLE)
                    RecordingLock.release("ime")
                }
            },
            onError = { message ->
                // `onError` can fire on the audio capture thread, so bounce
                // back to the main looper before touching UI/Toast/state.
                mainHandler.post {
                    setMicState(MicState.IDLE)
                    RecordingLock.release("ime")
                    // Surface failures (missing model, mic permission, empty
                    // audio) — without this the button silently snaps back
                    // to idle and the user has no idea the tap registered.
                    Toast.makeText(this, message, Toast.LENGTH_LONG).show()
                }
            },
            onTranscribing = {
                mainHandler.post { setMicState(MicState.TRANSCRIBING) }
            },
            // Audio capture runs on a dedicated thread; bounce the level
            // onto the main looper before it touches the UI-thread-only
            // waveform state. The waveform field itself is @Volatile but
            // we still want to avoid surprising teardown races.
            onAudioLevel = { level ->
                mainHandler.post { topBar.setAudioLevel(level) }
            },
        )
    }
}

enum class MicState {
    IDLE, RECORDING, TRANSCRIBING
}
