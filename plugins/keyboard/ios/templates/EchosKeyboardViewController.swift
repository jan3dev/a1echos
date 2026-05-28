import UIKit

/// Main entry point for the Echos keyboard extension.
/// Manages the keyboard view hierarchy, text input via textDocumentProxy,
/// and coordinates mic recording with the main app via IPC.
class EchosKeyboardViewController: UIInputViewController {

    private var keyboardView: KeyboardView!
    private var ipcClient: IPCClient!
    private var audioRecorder: AudioRecorder!
    private var doubleSpacePeriod = DoubleSpacePeriod()

    override func viewDidLoad() {
        super.viewDidLoad()

        ipcClient = IPCClient()
        audioRecorder = AudioRecorder()

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
                self?.textDocumentProxy.insertText(text)
                self?.keyboardView.setMicState(.idle)
            }
        }

        ipcClient.onTranscriptionError = { [weak self] error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                // Timeout = main app went away (force-killed, jetsamed)
                // mid-recording. Show the same "open Echos" banner the
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

        // Drive the top-bar waveform from the recorder's metering loop.
        audioRecorder.onAudioLevelChange = { [weak self] level in
            self?.keyboardView.setAudioLevel(Double(level))
        }
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
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        // Update return key appearance based on context.
        let returnType = textDocumentProxy.returnKeyType ?? .default
        keyboardView.updateReturnKeyType(returnType)
        applyKeyboardAppearance()

        // Re-evaluate auto-cap after every commit so the visual shift
        // state matches the cursor position. Cheap (read cached
        // documentContextBeforeInput, walk back ~10 chars).
        applyAutoCap()
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
        textDocumentProxy.insertText(char)
        // iOS does NOT call `textDidChange` after our own `insertText`
        // (only for host-driven changes), so we run the auto-cap pass
        // inline here. Without this, typing ". " in the numbers layout
        // never lifts the shift state and the next letter stays lowercase.
        applyAutoCap()
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
                return
            }
        }
        textDocumentProxy.deleteBackward()
        applyAutoCap()
    }

    func keyboardViewDidHoldDeleteWord(_ view: KeyboardView) {
        deleteWordBackward()
        applyAutoCap()
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
        if doubleSpacePeriod.shouldCommitPeriod(previousChars: tail) {
            textDocumentProxy.deleteBackward()
            textDocumentProxy.insertText(". ")
            doubleSpacePeriod.markPeriodCommitted()
            applyAutoCap()
            return
        }
        textDocumentProxy.insertText(" ")
        doubleSpacePeriod.recordSpaceCommit()
        applyAutoCap()
    }

    func keyboardViewDidTapReturn(_ view: KeyboardView) {
        doubleSpacePeriod.reset()
        textDocumentProxy.insertText("\n")
        applyAutoCap()
    }

    func keyboardViewDidTapGlobe(_ view: KeyboardView) {
        advanceToNextInputMode()
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
            view.setMicState(.transcribing)
            audioRecorder.stopRecording()
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
        audioRecorder.startRecording { [weak self] result in
            DispatchQueue.main.async {
                switch result {
                case .success(let audioURL):
                    self?.keyboardView.setMicState(.transcribing)
                    self?.ipcClient.requestTranscription(audioFileURL: audioURL)
                case .failure(let error):
                    self?.keyboardView.showMicError(error.localizedDescription)
                    self?.keyboardView.setMicState(.idle)
                }
            }
        }
    }

    /// Tracks whether the recorder is currently capturing. The view's mic
    /// state is the source of truth — `AudioRecorder` doesn't expose its
    /// internal AVAudioRecorder state publicly.
    private var isCurrentlyRecording: Bool {
        keyboardView.currentMicState == .recording
    }
}
