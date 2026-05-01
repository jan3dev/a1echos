import UIKit

/// Main entry point for the Echos keyboard extension.
/// Manages the keyboard view hierarchy, text input via textDocumentProxy,
/// and coordinates mic recording with the main app via IPC.
class EchosKeyboardViewController: UIInputViewController {

    private var keyboardView: KeyboardView!
    private var ipcClient: IPCClient!
    private var audioRecorder: AudioRecorder!

    override func viewDidLoad() {
        super.viewDidLoad()

        ipcClient = IPCClient()
        audioRecorder = AudioRecorder()

        keyboardView = KeyboardView()
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        keyboardView.delegate = self

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
                self?.keyboardView.showMicError(error)
                self?.keyboardView.setMicState(.idle)
            }
        }

        // Drive the top-bar waveform from the recorder's metering loop.
        audioRecorder.onAudioLevelChange = { [weak self] level in
            self?.keyboardView.setAudioLevel(Double(level))
        }
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        // Keyboard = rows + top bar (Echos logo + record button).
        // Row heights chosen so portrait keys land near 57pt and landscape
        // keys near 40pt, matching the iPhone iOS 26 stock keyboard.
        let isLandscape = view.bounds.width > view.bounds.height
        let rowsHeight: CGFloat = isLandscape ? 204 : 272
        let height = rowsHeight + KeyboardTopBar.preferredHeight
        keyboardView.heightConstraint?.constant = height
        if keyboardView.heightConstraint == nil {
            let constraint = keyboardView.heightAnchor.constraint(equalToConstant: height)
            constraint.priority = .defaultHigh
            constraint.isActive = true
            keyboardView.heightConstraint = constraint
        }
    }

    override func textDidChange(_ textInput: UITextInput?) {
        super.textDidChange(textInput)
        // Update return key appearance based on context.
        let returnType = textDocumentProxy.returnKeyType ?? .default
        keyboardView.updateReturnKeyType(returnType)
        applyKeyboardAppearance()
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
        textDocumentProxy.insertText(char)
    }

    func keyboardViewDidTapDelete(_ view: KeyboardView) {
        textDocumentProxy.deleteBackward()
    }

    func keyboardViewDidHoldDeleteWord(_ view: KeyboardView) {
        deleteWordBackward()
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
        textDocumentProxy.insertText(" ")
    }

    func keyboardViewDidTapReturn(_ view: KeyboardView) {
        textDocumentProxy.insertText("\n")
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
    func keyboardViewDidToggleRecord(_ view: KeyboardView) {
        if isCurrentlyRecording {
            view.setMicState(.transcribing)
            audioRecorder.stopRecording()
            return
        }

        view.setMicState(.recording)
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
