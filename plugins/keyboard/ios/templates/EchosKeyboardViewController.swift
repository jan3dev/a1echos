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

        keyboardView = KeyboardView(frame: .zero)
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        keyboardView.delegate = self

        view.addSubview(keyboardView)
        NSLayoutConstraint.activate([
            keyboardView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            keyboardView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

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
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        // Set keyboard height based on orientation
        let isLandscape = view.bounds.width > view.bounds.height
        let height: CGFloat = isLandscape ? 162 : 216
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
        // Update return key appearance based on context
        let returnType = textDocumentProxy.returnKeyType ?? .default
        keyboardView.updateReturnKeyType(returnType)
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

    func keyboardViewDidTapSpace(_ view: KeyboardView) {
        textDocumentProxy.insertText(" ")
    }

    func keyboardViewDidTapReturn(_ view: KeyboardView) {
        textDocumentProxy.insertText("\n")
    }

    func keyboardViewDidTapGlobe(_ view: KeyboardView) {
        advanceToNextInputMode()
    }

    func keyboardViewDidStartMicRecording(_ view: KeyboardView) {
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

    func keyboardViewDidStopMicRecording(_ view: KeyboardView) {
        audioRecorder.stopRecording()
    }
}
