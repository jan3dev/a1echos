import UIKit

/// Main entry point for the Echos keyboard extension.
/// Manages the keyboard view hierarchy, text input via textDocumentProxy,
/// and coordinates mic recording with the main app via IPC.
class EchosKeyboardViewController: UIInputViewController {

    private var keyboardView: KeyboardView!
    private var ipcClient: IPCClient!
    private var doubleSpacePeriod = DoubleSpacePeriod()
    /// Polls the level the main app publishes while recording (capture lives in
    /// the app — iOS forbids extensions from recording) and drives the top-bar
    /// waveform off it.
    private var meterTimer: Timer?
    private let recapitalize = RecapitalizeEngine()
    private let suggestionEngine = SuggestionEngine()
    private var settings = KeyboardSettings.load()
    /// Pending autocorrect-on-space revert target (§5.4): set when the top
    /// guess auto-applied on space, cleared by the next backspace (which
    /// restores the typed word) or any other keystroke / cursor move.
    private var lastAutocorrect: SuggestionEngine.LastAutocorrect?
    /// The `keyboardType` for which the field-type layout was last applied
    /// (§9.1). Used so we only auto-open the field's preferred layout when the
    /// field actually changes — not on every keystroke, which would fight a
    /// user who tapped `123`/`ABC` to navigate within a URL/email/numbers field.
    /// Reset in `viewWillAppear` so a freshly-shown keyboard starts fresh.
    private var lastAppliedKeyboardType: UIKeyboardType?

    override func viewDidLoad() {
        super.viewDidLoad()

        ipcClient = IPCClient()
        suggestionEngine.resolveLanguage()

        keyboardView = KeyboardView()
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        keyboardView.delegate = self

        // Resize the keyboard whenever the layout mode changes — emoji
        // modes need extra vertical space so the picker's 5 native rows
        // fit. Applied without animation: opening/closing the emoji
        // picker, switching to emoji-search, and toggling 123/symbols
        // all snap into place instantly. Wrapping in `UIView.animate`
        // makes the chrome (topBar / search overlay / rowStack) slide
        // between anchors, which reads as a noisy in/out flicker
        // especially on the emoji ↔ QWERTY transition.
        keyboardView.onLayoutModeChange = { [weak self] _ in
            guard let self = self else { return }
            self.applyPreferredKeyboardHeight()
            self.view.layoutIfNeeded()
        }

        view.addSubview(keyboardView)
        NSLayoutConstraint.activate([
            keyboardView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            keyboardView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        applyKeyboardAppearance()

        // Listen for transcription results from the main app
        ipcClient.onTranscriptionResult = { [weak self] text in
            DispatchQueue.main.async {
                self?.stopMetering()
                self?.textDocumentProxy.insertText(text)
                self?.keyboardView.setMicState(.idle)
            }
        }

        ipcClient.onTranscriptionError = { [weak self] error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.stopMetering()
                // Timeout = main app went away (force-killed, jetsamed)
                // mid-recording. Show the same "open Echos" toast the
                // pre-flight ping uses so the user gets a consistent
                // recovery instruction instead of a vague timeout error.
                if error.localizedCaseInsensitiveContains("timed out") {
                    self.keyboardView.showOpenAppPrompt(
                        "Open Echos to finish transcription"
                    )
                } else {
                    self.keyboardView.showMicError(error)
                }
                self.keyboardView.setMicState(.idle)
            }
        }

    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        // Re-read the autocorrect preference each time the keyboard is shown so
        // a change made in the app (while the keyboard was dismissed) takes
        // effect on next appearance — no file watcher needed. Also re-resolve
        // the checker language so a host-locale change is picked up.
        settings = KeyboardSettings.load()
        suggestionEngine.resolveLanguage()
        // A freshly-shown keyboard should always start in the field-appropriate
        // layout, so forget the last-applied type before re-applying.
        lastAppliedKeyboardType = nil
        // Apply the field-type layout on first appearance too — `textDidChange`
        // may not fire before the keyboard is shown for a freshly focused field.
        applyFieldTypeLayout()
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        applyPreferredKeyboardHeight()
    }

    /// Pulls the keyboard's preferred height from `KeyboardView`. Computed
    /// over there because the per-mode budget (taller in emoji, tighter in
    /// QWERTY) needs to know `currentLayout`. Portrait/landscape ratios:
    /// QWERTY ≈ 44pt key / ~32pt key; emoji modes ≈ 32pt cells × 5 rows +
    /// search + strip.
    private func applyPreferredKeyboardHeight() {
        let height = keyboardView.preferredHeight
        if let constraint = keyboardView.heightConstraint {
            constraint.constant = height
        } else {
            let constraint = keyboardView.heightAnchor.constraint(equalToConstant: height)
            constraint.priority = .defaultHigh
            constraint.isActive = true
            keyboardView.heightConstraint = constraint
        }
    }

    /// Cursor moves are an out-of-band signal to abandon any in-flight
    /// composing state — without this, the user could double-tap shift,
    /// move the cursor, then tap shift again and accidentally engage
    /// caps lock. Same for the smart double-space window.
    override func selectionWillChange(_ textInput: UITextInput?) {
        super.selectionWillChange(textInput)
        doubleSpacePeriod.reset()
        keyboardView.resetShiftDoubleTap()
        // A user-driven cursor/selection move ends any recapitalize rotation
        // (§4.7). Our own proxy edits don't fire this callback, so an
        // in-progress rotation survives consecutive shift taps.
        recapitalize.reset()
        // A cursor move invalidates the composing word and the autocorrect
        // revert window — drop both and recompute the strip for the new spot.
        lastAutocorrect = nil
        refreshSuggestions()
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        // Field-type adaptive layout (§9.1): swap to the numeric pad when the
        // host declares a numeric keyboard type, and back to letters when a
        // numeric field loses focus. `switchToLayout` no-ops unless the mode
        // actually changes, so this is cheap to run on every change.
        applyFieldTypeLayout()
        // Update return key appearance based on context.
        let returnType = textDocumentProxy.returnKeyType ?? .default
        keyboardView.updateReturnKeyType(returnType)
        applyKeyboardAppearance()

        // Re-evaluate auto-cap after every commit so the visual shift
        // state matches the cursor position. Cheap (read cached
        // documentContextBeforeInput, walk back ~10 chars).
        applyAutoCap()
        // Host-driven edits (e.g. autofill) change the composing word too.
        refreshSuggestions()
    }

    private func applyAutoCap() {
        switch AutoCapEngine.decide(for: textDocumentProxy) {
        case .capitalize:
            keyboardView.applyAutoShift(true)
        case .lowercase:
            keyboardView.applyAutoShift(false)
        case .disabled:
            // Host opted out — leave shift state alone, the user's
            // manual taps still work.
            break
        }
    }

    // MARK: - Suggestions (§5.5)

    /// Recomputes the top-bar suggestion strip for the current composing word.
    /// Hides the strip (restoring the logo + record button) when there's no
    /// word, the field disallows suggestions, or the bar is busy recording.
    private func refreshSuggestions() {
        guard keyboardView.currentMicState == .idle,
              suggestionsAllowed(for: textDocumentProxy) else {
            keyboardView.hideSuggestions()
            return
        }
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        let word = SuggestionEngine.currentWord(beforeCursor: before, afterCursor: after)
        guard !word.isEmpty else {
            keyboardView.hideSuggestions()
            return
        }
        let result = suggestionEngine.suggestions(for: word, casing: currentCasing())
        if result.candidates.isEmpty {
            keyboardView.hideSuggestions()
        } else {
            keyboardView.showSuggestions(result.candidates)
        }
    }

    /// Maps the live shift state to the casing suggestion candidates should
    /// adopt so a tapped/auto-applied word matches what a typed letter would.
    private func currentCasing() -> SuggestionEngine.Casing {
        switch keyboardView.currentShiftState {
        case .capsLock: return .upper
        case .on, .automatic: return .capitalize
        case .off, .manualFromAuto: return .lower
        }
    }

    /// Applies the field-type adaptive layout (§9.1). The field's preferred
    /// layout is applied only when `keyboardType` *changes* — `textDidChange`
    /// fires on every keystroke, and re-forcing the layout each time would
    /// fight a user who tapped `123`/`ABC` to navigate within a URL / email /
    /// numbers field (the numeric pads have no such escape, but the letter
    /// variants and `.numbersAndPunctuation` do). Phone / name-phone / secure
    /// fields never reach our extension (iOS forces the system keyboard), so
    /// they need no handling here.
    private func applyFieldTypeLayout() {
        let keyboardType = textDocumentProxy.keyboardType
        guard keyboardType != lastAppliedKeyboardType else { return }
        lastAppliedKeyboardType = keyboardType

        switch keyboardType {
        case .decimalPad:
            keyboardView.switchToLayout(.decimalPad)
        case .numberPad, .asciiCapableNumberPad:
            keyboardView.switchToLayout(.numberPad)
        case .URL:
            keyboardView.switchToLayout(.urlLetters)
        case .emailAddress:
            keyboardView.switchToLayout(.emailLetters)
        case .twitter:
            keyboardView.switchToLayout(.twitter)
        case .webSearch:
            keyboardView.switchToLayout(.webSearch)
        case .numbersAndPunctuation:
            // Open to the numbers page once; the user can tap `ABC` to reach
            // letters and stays there (we don't re-force on later keystrokes).
            keyboardView.switchToLayout(.numbers)
        default:
            // A plain text field: restore letters only if we're sitting on a
            // field-specific layout. Don't yank the user out of a numbers /
            // symbols / emoji page they opened manually.
            switch keyboardView.currentLayoutMode {
            case .numberPad, .decimalPad, .urlLetters, .emailLetters, .twitter, .webSearch:
                keyboardView.switchToLayout(.letters)
            default:
                break
            }
        }
    }

    /// Suppresses suggestions in fields where they'd be noise or unsafe —
    /// URLs, emails, passwords, numeric pads — mirroring auto-cap's opt-out.
    private func suggestionsAllowed(for proxy: UITextDocumentProxy) -> Bool {
        // `==` (not `switch`) so this compiles whether `keyboardType` is
        // declared optional or non-optional on the proxy across SDK versions.
        let keyboardType = proxy.keyboardType
        let blockedTypes: [UIKeyboardType] = [
            .URL, .emailAddress, .numberPad, .phonePad,
            .decimalPad, .namePhonePad, .asciiCapableNumberPad,
        ]
        if blockedTypes.contains(where: { $0 == keyboardType }) {
            return false
        }
        // `textContentType` is itself optional on the proxy, so the property
        // is double-optional — flatten before unwrapping.
        if let contentType = proxy.textContentType.flatMap({ $0 }) {
            let blockedContent: [UITextContentType] = [
                .password, .newPassword, .oneTimeCode, .URL, .emailAddress,
            ]
            if blockedContent.contains(contentType) {
                return false
            }
        }
        return true
    }

    /// Honors `textDocumentProxy.keyboardAppearance` so a dark-mode host app
    /// gets the dark keyboard even when the system appearance is light
    /// (matches stock iOS keyboard behavior).
    private func applyKeyboardAppearance() {
        let appearance = textDocumentProxy.keyboardAppearance ?? .default
        let style: UIUserInterfaceStyle
        switch appearance {
        case .dark: style = .dark
        case .light: style = .light
        default: style = .unspecified
        }
        if keyboardView.overrideUserInterfaceStyle != style {
            keyboardView.overrideUserInterfaceStyle = style
        }
    }
}

// MARK: - KeyboardViewDelegate

extension EchosKeyboardViewController: KeyboardViewDelegate {

    func keyboardView(_ view: KeyboardView, didTapCharacter char: String) {
        // Any non-space, non-backspace input invalidates the smart
        // double-space window. Letters / digits / accents all reset.
        doubleSpacePeriod.reset()
        // Typing past an autocorrect ends its one-shot revert window.
        lastAutocorrect = nil
        textDocumentProxy.insertText(char)
        // iOS does NOT call `textDidChange` after our own `insertText`
        // (only for host-driven changes), so we run the auto-cap pass
        // inline here. Without this, typing ". " in the numbers layout
        // never lifts the shift state and the next letter stays lowercase.
        applyAutoCap()
        refreshSuggestions()
    }

    func keyboardViewDidTapDelete(_ view: KeyboardView) {
        // A backspace within 1100 ms of a smart `. ` commit reverts it
        // back to a double space — matches LatinIME's "undo correction"
        // behaviour for this specific helper.
        if doubleSpacePeriod.shouldUndoPeriod() {
            // Delete the `. ` we just inserted and put `  ` back in
            // its place. We don't know the exact prior chars for sure
            // (the host may have rewritten them), so we re-read to
            // confirm before mutating.
            let before = textDocumentProxy.documentContextBeforeInput ?? ""
            if before.hasSuffix(". ") {
                textDocumentProxy.deleteBackward()
                textDocumentProxy.deleteBackward()
                textDocumentProxy.insertText("  ")
                applyAutoCap()
                refreshSuggestions()
                return
            }
        }
        // Revert an autocorrect-on-space (§5.4): the first backspace after the
        // auto-applied correction restores exactly what the user typed.
        if let last = lastAutocorrect {
            let before = textDocumentProxy.documentContextBeforeInput ?? ""
            if before.hasSuffix(last.corrected + " ") {
                for _ in 0..<(last.corrected.count + 1) {
                    textDocumentProxy.deleteBackward()
                }
                textDocumentProxy.insertText(last.typed)
                lastAutocorrect = nil
                applyAutoCap()
                refreshSuggestions()
                return
            }
            lastAutocorrect = nil
        }
        textDocumentProxy.deleteBackward()
        applyAutoCap()
        refreshSuggestions()
    }

    func keyboardViewDidHoldDeleteWord(_ view: KeyboardView) {
        lastAutocorrect = nil
        deleteWordBackward()
        applyAutoCap()
        refreshSuggestions()
    }

    /// Deletes a contiguous run of trailing whitespace plus the word before
    /// it, falling back to a single character delete when the host doesn't
    /// expose enough context. Mirrors how native iOS escalates a long delete
    /// hold once the per-character repeat has been running for a while.
    private func deleteWordBackward() {
        guard
            let context = textDocumentProxy.documentContextBeforeInput,
            !context.isEmpty
        else {
            textDocumentProxy.deleteBackward()
            return
        }
        let chars = Array(context)
        var idx = chars.count - 1
        var deleteCount = 0
        while idx >= 0, chars[idx].isWhitespace {
            deleteCount += 1
            idx -= 1
        }
        while idx >= 0, !chars[idx].isWhitespace {
            deleteCount += 1
            idx -= 1
        }
        if deleteCount == 0 { deleteCount = 1 }
        for _ in 0..<deleteCount {
            textDocumentProxy.deleteBackward()
        }
    }

    func keyboardViewDidTapSpace(_ view: KeyboardView) {
        // Smart double-space → ". ". Check the two chars before the
        // cursor: if it looks like `<letter|digit|allowed-punct> ` and
        // we're inside the 1100 ms window, swap the trailing space
        // for `. ` (LatinIME §4.5).
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let tail = Array(before.suffix(2))
        // Smart double-space → ". " runs first and unchanged — it owns the
        // case where the previous keystroke was already a space.
        if doubleSpacePeriod.shouldCommitPeriod(previousChars: tail) {
            lastAutocorrect = nil
            textDocumentProxy.deleteBackward()
            textDocumentProxy.insertText(". ")
            doubleSpacePeriod.markPeriodCommitted()
            applyAutoCap()
            refreshSuggestions()
            return
        }
        // Autocorrect-on-space (§5.10) — only when the user enabled it. Replace
        // a misspelled in-progress word with the top guess, then commit the
        // space, recording the original for backspace-revert.
        if settings.autocorrect,
           keyboardView.currentMicState == .idle,
           suggestionsAllowed(for: textDocumentProxy) {
            let after = textDocumentProxy.documentContextAfterInput ?? ""
            let word = SuggestionEngine.currentWord(beforeCursor: before, afterCursor: after)
            if !word.isEmpty {
                let result = suggestionEngine.suggestions(for: word, casing: currentCasing())
                if result.topIsCorrection,
                   let corrected = result.candidates.first,
                   corrected.lowercased() != word.lowercased() {
                    for _ in 0..<word.count { textDocumentProxy.deleteBackward() }
                    textDocumentProxy.insertText(corrected + " ")
                    lastAutocorrect = SuggestionEngine.LastAutocorrect(
                        typed: word, corrected: corrected
                    )
                    doubleSpacePeriod.recordSpaceCommit()
                    applyAutoCap()
                    refreshSuggestions()
                    return
                }
            }
        }
        lastAutocorrect = nil
        textDocumentProxy.insertText(" ")
        doubleSpacePeriod.recordSpaceCommit()
        applyAutoCap()
        refreshSuggestions()
    }

    func keyboardViewDidTapReturn(_ view: KeyboardView) {
        doubleSpacePeriod.reset()
        lastAutocorrect = nil
        textDocumentProxy.insertText("\n")
        applyAutoCap()
        refreshSuggestions()
    }

    func keyboardViewDidTapGlobe(_ view: KeyboardView) {
        advanceToNextInputMode()
    }

    /// Tap-to-apply (§5.5): replace the in-progress word with the tapped
    /// candidate. No trailing space — the user keeps control of word spacing
    /// (and the double-space-period window stays clean).
    func keyboardView(_ view: KeyboardView, didSelectSuggestion candidate: String) {
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        let word = SuggestionEngine.currentWord(beforeCursor: before, afterCursor: after)
        guard !word.isEmpty else { return }
        lastAutocorrect = nil
        doubleSpacePeriod.reset()
        for _ in 0..<word.count { textDocumentProxy.deleteBackward() }
        textDocumentProxy.insertText(candidate)
        applyAutoCap()
        refreshSuggestions()
    }

    /// Spacebar cursor-drag (§5.1): move the caret without inserting a space.
    func keyboardView(_ view: KeyboardView, moveCursorBy offset: Int) {
        textDocumentProxy.adjustTextPosition(byCharacterOffset: offset)
    }

    /// Spacebar cursor-drag vertical (§5.1). The keyboard proxy exposes no
    /// text geometry, so we move between newline-delimited lines on a
    /// best-effort basis, preserving the caret's column where the target line
    /// is long enough. Soft-wrapped visual lines are invisible to us.
    func keyboardView(_ view: KeyboardView, moveCursorVerticallyBy lines: Int) {
        guard lines != 0 else { return }
        for _ in 0..<abs(lines) {
            if lines < 0 { moveCaretUpOneLine() } else { moveCaretDownOneLine() }
        }
    }

    /// Caret's column = characters since the last newline in the text behind it.
    private func currentColumn(in before: String) -> Int {
        if let nl = before.lastIndex(of: "\n") {
            return before.distance(from: before.index(after: nl), to: before.endIndex)
        }
        return before.count
    }

    private func moveCaretUpOneLine() {
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let col = currentColumn(in: before)
        guard let curLineStart = before.lastIndex(of: "\n") else {
            // Already on the first line — clamp to its start.
            if !before.isEmpty {
                textDocumentProxy.adjustTextPosition(byCharacterOffset: -before.count)
            }
            return
        }
        let prevChunk = before[..<curLineStart]
        let prevLineStart = prevChunk.lastIndex(of: "\n").map { prevChunk.index(after: $0) }
            ?? prevChunk.startIndex
        let prevLineLength = prevChunk.distance(from: prevLineStart, to: prevChunk.endIndex)
        let targetCol = min(col, prevLineLength)
        let offset = -(col + 1 + (prevLineLength - targetCol))
        textDocumentProxy.adjustTextPosition(byCharacterOffset: offset)
    }

    private func moveCaretDownOneLine() {
        let before = textDocumentProxy.documentContextBeforeInput ?? ""
        let after = textDocumentProxy.documentContextAfterInput ?? ""
        let col = currentColumn(in: before)
        guard let nlIdx = after.firstIndex(of: "\n") else {
            // Already on the last line — clamp to its end.
            if !after.isEmpty {
                textDocumentProxy.adjustTextPosition(byCharacterOffset: after.count)
            }
            return
        }
        let remainderOfCurLine = after.distance(from: after.startIndex, to: nlIdx)
        let nextLineStart = after.index(after: nlIdx)
        let nextLineEnd = after[nextLineStart...].firstIndex(of: "\n") ?? after.endIndex
        let nextLineLength = after.distance(from: nextLineStart, to: nextLineEnd)
        let targetCol = min(col, nextLineLength)
        let offset = remainderOfCurLine + 1 + targetCol
        textDocumentProxy.adjustTextPosition(byCharacterOffset: offset)
    }

    /// Recapitalize-on-selection (§4.7). With text selected, shift replaces
    /// the selection with the next case form (lower → Title → UPPER) and
    /// returns true so the view skips its shift-state cycle. iOS can't
    /// re-select, so a follow-up shift tap continues the rotation by deleting
    /// and re-inserting our own run — but only while that run is still intact
    /// immediately before the cursor (any typing or cursor move ends it).
    /// Returns false (normal shift) when there's nothing to recapitalize.
    func keyboardViewDidTapShift(_ view: KeyboardView) -> Bool {
        if let selection = textDocumentProxy.selectedText, !selection.isEmpty {
            guard let next = RecapitalizeEngine.nextCase(selection) else { return false }
            doubleSpacePeriod.reset()
            textDocumentProxy.insertText(next)  // replaces the selection
            recapitalize.begin(inserted: next)
            return true
        }
        guard recapitalize.active,
              !recapitalize.lastInserted.isEmpty,
              let before = textDocumentProxy.documentContextBeforeInput,
              before.hasSuffix(recapitalize.lastInserted),
              let next = RecapitalizeEngine.nextCase(recapitalize.lastInserted)
        else {
            recapitalize.reset()
            return false
        }
        for _ in 0..<recapitalize.lastInserted.count {
            textDocumentProxy.deleteBackward()
        }
        textDocumentProxy.insertText(next)
        recapitalize.begin(inserted: next)
        return true
    }

    /// Long-press on the emoji key surfaces the system keyboard picker
    /// (same list iOS shows when you long-press the stock globe key). The
    /// short tap on the smiley now opens the in-keyboard emoji picker, so
    /// long-press is the remaining path to switch to a different system
    /// keyboard.
    func keyboardView(_ view: KeyboardView, didLongPressEmojiFrom sourceView: UIView) {
        handleInputModeList(from: sourceView, with: UIEvent())
    }

    /// Toggles recording from the top-bar record button. Tap-to-start begins
    /// capture; tap-to-stop flushes the WAV and hands it off to the main app
    /// listener for transcription.
    ///
    /// Before starting, we ping the main app over the App Group IPC channel.
    /// iOS keyboard extensions cannot launch the host app, so a force-killed
    /// Echos app would silently swallow the audio and time out 10 seconds
    /// later. Pinging first lets us surface a clear "open Echos" prompt
    /// immediately and avoid wasting recording time.
    func keyboardViewDidToggleRecord(_ view: KeyboardView) {
        if isCurrentlyRecording {
            // Hand off to the main app to stop + transcribe. The result (or a
            // timeout) flows back through ipcClient's result/error callbacks.
            view.setMicState(.transcribing)
            stopMetering()
            ipcClient.requestRecordStop()
            return
        }

        ipcClient.pingMainApp { [weak self] alive in
            guard let self = self else { return }
            guard alive else {
                self.keyboardView.showOpenAppPrompt(
                    "Open Echos to enable voice typing"
                )
                return
            }
            self.beginRecording()
        }
    }

    private func beginRecording() {
        keyboardView.setMicState(.recording)
        startMetering()
        ipcClient.requestRecordStart()
    }

    /// Polls the app-published input level at display rate and feeds the
    /// waveform. The waveform's own smoothing absorbs the polling cadence, and a
    /// nil read (app hasn't written yet) simply leaves the last level in place.
    private func startMetering() {
        stopMetering()
        keyboardView.setAudioLevel(0)
        meterTimer = Timer.scheduledTimer(
            withTimeInterval: 1.0 / 30.0, repeats: true
        ) { [weak self] _ in
            guard let self = self else { return }
            if let level = self.ipcClient.readMeterLevel() {
                self.keyboardView.setAudioLevel(level)
            }
        }
    }

    private func stopMetering() {
        meterTimer?.invalidate()
        meterTimer = nil
    }

    /// Tracks whether a recording is in progress. The view's mic state is the
    /// source of truth — recording itself happens in the main app, so there's
    /// no local recorder to query.
    private var isCurrentlyRecording: Bool {
        keyboardView.currentMicState == .recording
    }
}
