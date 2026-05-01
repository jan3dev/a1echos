package com.a1lab.echos.ime

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
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
    private var emojiPickerView: EchosEmojiPickerView? = null
    private lateinit var transcriber: ImeSherpaTranscriber
    private var currentEditorAction: Int = EditorInfo.IME_ACTION_NONE
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        transcriber = ImeSherpaTranscriber(this)
    }

    override fun onCreateInputView(): View {
        // The root frame stacks a transparent overlay (`keyOverlay`) on top
        // of the topBar+keyboard column. The overlay hosts the typewriter
        // preview balloon and the long-press accent popup so those can
        // extend above the keyboard's row area into the topBar's vertical
        // band — otherwise top-row keys would have nowhere visible to put
        // their preview. We use a custom FrameLayout subclass that sizes
        // itself by the column's measured height (instead of letting a
        // MATCH_PARENT overlay child blow the IME window up to full screen).
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
        }

        val topBarHeightPx = resources.getIdentifier("keyboard_top_bar_height", "dimen", packageName)
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
        keyboardView.updateReturnKeyType(currentEditorAction)
        showKeyboardLayout()

        val inputType = info.inputType and android.text.InputType.TYPE_MASK_CLASS
        when (inputType) {
            android.text.InputType.TYPE_CLASS_NUMBER,
            android.text.InputType.TYPE_CLASS_PHONE -> keyboardView.showNumberLayout()
            android.text.InputType.TYPE_CLASS_TEXT -> keyboardView.showLetterLayout()
            else -> keyboardView.showLetterLayout()
        }
    }

    override fun onFinishInputView(finishingInput: Boolean) {
        super.onFinishInputView(finishingInput)
        transcriber.cancelIfActive()
        topBar.setMicState(MicState.IDLE)
        // Release the lock if we still hold it — otherwise dismissing the
        // keyboard mid-record would leave the lock stuck and silently block
        // the next attempt.
        RecordingLock.release("ime")
    }

    override fun onDestroy() {
        transcriber.release()
        super.onDestroy()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Theme and orientation changes are handled by recreating the view
    }

    // -- KeyboardActionListener --

    override fun onKeyPress(char: String) {
        currentInputConnection?.commitText(char, 1)
    }

    override fun onDeletePress() {
        deleteOneGrapheme()
    }

    override fun onDeleteWord() {
        deleteWordBackward()
    }

    /**
     * Deletes one grapheme cluster — covers surrogate pairs (most emojis),
     * skin-tone modifiers, regional-indicator flags, and ZWJ sequences.
     * `deleteSurroundingText(1, 0)` only drops a single Java char, which
     * leaves the trailing half of a surrogate pair behind and renders as a
     * "?" replacement until the user taps delete a second time.
     */
    private fun deleteOneGrapheme() {
        val ic: InputConnection = currentInputConnection ?: return
        // 32 chars is enough for the longest standard ZWJ family sequences.
        val before = ic.getTextBeforeCursor(32, 0)?.toString().orEmpty()
        if (before.isEmpty()) return
        val bi = BreakIterator.getCharacterInstance()
        bi.setText(before)
        val end = bi.last()
        val prev = bi.previous()
        val deleteLen = if (prev == BreakIterator.DONE) 1 else end - prev
        ic.deleteSurroundingText(deleteLen, 0)
    }

    override fun onSpacePress() {
        currentInputConnection?.commitText(" ", 1)
    }

    override fun onReturnPress() {
        val ic = currentInputConnection ?: return
        if (currentEditorAction != EditorInfo.IME_ACTION_NONE) {
            ic.performEditorAction(currentEditorAction)
        } else {
            ic.commitText("\n", 1)
        }
    }

    /** Legacy bottom-row mic — the button is gone from the layout, but keep
     *  the hooks so a stale layout doesn't crash. */
    override fun onMicPress() = toggleRecording()
    override fun onMicRelease() { /* toggle on press, no action on release */ }

    override fun onEmojiPress() {
        // Android doesn't expose a direct "open emoji keyboard" API to third-
        // party IMEs, so we render our own picker inside the keyboard area
        // (same approach as Gboard / SwiftKey).
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

    // -- EmojiPickerView.Listener --

    override fun onEmojiSelected(emoji: String) {
        currentInputConnection?.commitText(emoji, 1)
    }

    override fun onBackToLetters() {
        showKeyboardLayout()
    }

    override fun onSpacePressed() {
        currentInputConnection?.commitText(" ", 1)
    }

    override fun onDeleteCharacter() {
        deleteOneGrapheme()
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
    }

    private fun showKeyboardLayout() {
        emojiPickerView?.visibility = View.GONE
        keyboardView.visibility = View.VISIBLE
    }

    private fun deleteWordBackward() {
        val ic = currentInputConnection ?: return
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
        ic.deleteSurroundingText(count, 0)
    }

    // -- TopBar.Listener --

    override fun onRecordClick() {
        toggleRecording()
    }

    // -- Transcription --

    private var micState: MicState = MicState.IDLE

    private fun setMicState(state: MicState) {
        micState = state
        topBar.setMicState(state)
    }

    private fun toggleRecording() {
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
        // Check the runtime mic permission first — on modern Android the
        // `AudioRecord` constructor doesn't throw when RECORD_AUDIO is
        // missing, it just returns an instance with `STATE_UNINITIALIZED`,
        // which is exactly what was being seen in the IME (`state=0`).
        // Catch it here so we can guide the user to the main app rather
        // than silently failing.
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
                    currentInputConnection?.commitText(text, 1)
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
