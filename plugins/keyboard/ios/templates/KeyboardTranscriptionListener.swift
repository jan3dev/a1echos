import Foundation

/// Runs in the main Echos app process. Listens for transcription requests from
/// the keyboard extension via Darwin notifications, transcribes the audio via
/// `SherpaBridge` (sherpa-onnx C++ API), and writes the result into the App
/// Group shared container for the extension to pick up.
@objc class KeyboardTranscriptionListener: NSObject {

    static let shared = KeyboardTranscriptionListener()

    private let appGroupID = "group.com.a1lab.echos.shared"
    private let requestNotificationName = "com.a1lab.echos.transcriptionRequest"
    private let resultNotificationName = "com.a1lab.echos.transcriptionResult"
    private let pingNotificationName = "com.a1lab.echos.transcriptionPing"
    private let pongNotificationName = "com.a1lab.echos.transcriptionPong"
    /// JSON file inside the main app's Documents directory that describes the
    /// active sherpa-onnx model. Written from JS by SherpaTranscriptionService
    /// when initialization succeeds, read here when the keyboard requests
    /// transcription. The listener runs in the main app process so App Group
    /// sharing is unnecessary for this file.
    private let modelConfigFilename = "keyboard-sherpa-model.json"

    private override init() {
        super.init()
    }

    /// Call this from AppDelegate or app initialization to start listening.
    @objc func startListening() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()

        CFNotificationCenterAddObserver(
            center,
            observer,
            { _, observer, _, _, _ in
                guard let observer = observer else { return }
                let listener = Unmanaged<KeyboardTranscriptionListener>.fromOpaque(observer).takeUnretainedValue()
                listener.handleTranscriptionRequest()
            },
            requestNotificationName as CFString,
            nil,
            .deliverImmediately
        )

        // Pre-flight ping handler — answers within milliseconds so the
        // keyboard can detect a force-killed app and prompt the user
        // before they record.
        CFNotificationCenterAddObserver(
            center,
            observer,
            { _, observer, _, _, _ in
                guard let observer = observer else { return }
                let listener = Unmanaged<KeyboardTranscriptionListener>.fromOpaque(observer).takeUnretainedValue()
                listener.handlePing()
            },
            pingNotificationName as CFString,
            nil,
            .deliverImmediately
        )

        NSLog("[KeyboardTranscriptionListener] Started listening for keyboard transcription requests")
    }

    @objc func stopListening() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterRemoveObserver(center, observer, nil, nil)
    }

    // MARK: - Handle Request

    private func handleTranscriptionRequest() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.processRequest()
        }
    }

    /// Reply to a keyboard pre-flight ping by writing the matching ID to
    /// `pong.json` and posting the pong Darwin notification. Synchronous
    /// and minimal — this needs to round-trip in <300ms.
    private func handlePing() {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else { return }
        let keyboardDir = containerURL.appendingPathComponent("keyboard", isDirectory: true)
        let pingURL = keyboardDir.appendingPathComponent("ping.json")
        let pongURL = keyboardDir.appendingPathComponent("pong.json")

        guard FileManager.default.fileExists(atPath: pingURL.path),
              let data = try? Data(contentsOf: pingURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let pingID = json["id"] as? String else {
            return
        }

        let pong: [String: Any] = [
            "id": pingID,
            "timestamp": Date().timeIntervalSince1970,
        ]
        guard let pongData = try? JSONSerialization.data(withJSONObject: pong) else { return }
        try? pongData.write(to: pongURL)
        try? FileManager.default.removeItem(at: pingURL)

        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(
            center,
            CFNotificationName(pongNotificationName as CFString),
            nil, nil, true
        )
    }

    private func processRequest() {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            NSLog("[KeyboardTranscriptionListener] Cannot access App Group container")
            return
        }

        let keyboardDir = containerURL.appendingPathComponent("keyboard", isDirectory: true)
        let requestURL = keyboardDir.appendingPathComponent("request.json")
        let audioURL = keyboardDir.appendingPathComponent("audio.wav")
        let resultURL = keyboardDir.appendingPathComponent("result.json")

        guard FileManager.default.fileExists(atPath: requestURL.path),
              let requestData = try? Data(contentsOf: requestURL),
              let request = try? JSONSerialization.jsonObject(with: requestData) as? [String: Any],
              let requestID = request["id"] as? String,
              let status = request["status"] as? String,
              status == "pending" else {
            return
        }

        guard FileManager.default.fileExists(atPath: audioURL.path) else {
            writeResult(to: resultURL, id: requestID, text: nil, error: "No audio file found")
            postResultNotification()
            return
        }

        NSLog("[KeyboardTranscriptionListener] Processing request: %@", requestID)

        let bridge = SherpaBridge.shared()
        guard let files = resolveModelFiles(requestedLanguage: request["language"] as? String) else {
            writeResult(to: resultURL, id: requestID, text: nil,
                        error: "Echos voice model not ready. Open Echos app first.")
            postResultNotification()
            return
        }

        if !bridge.loadModel(files) {
            writeResult(to: resultURL, id: requestID, text: nil, error: "Failed to load voice model")
            postResultNotification()
            return
        }

        let text = bridge.transcribeFile(audioURL.path)
        if let text = text, !text.isEmpty {
            writeResult(to: resultURL, id: requestID, text: text, error: nil)
        } else {
            writeResult(to: resultURL, id: requestID, text: nil, error: "Transcription returned empty result")
        }

        try? FileManager.default.removeItem(at: requestURL)
        postResultNotification()
    }

    // MARK: - Model Resolution

    /// Reads the saved model configuration from the main app's Documents
    /// directory and returns a `SherpaModelFiles` ready for `SherpaBridge`.
    /// The language from the keyboard request (if provided) overrides the
    /// saved Whisper language.
    private func resolveModelFiles(requestedLanguage: String?) -> SherpaModelFiles? {
        guard let docsDir = NSSearchPathForDirectoriesInDomains(
            .documentDirectory, .userDomainMask, true
        ).first else {
            NSLog("[KeyboardTranscriptionListener] Could not resolve Documents dir")
            return nil
        }
        let configPath = (docsDir as NSString).appendingPathComponent(modelConfigFilename)

        guard FileManager.default.fileExists(atPath: configPath),
              let data = try? Data(contentsOf: URL(fileURLWithPath: configPath)),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let modelDir = json["modelDir"] as? String,
              let modelTypeStr = json["modelType"] as? String,
              let encoder = json["encoder"] as? String,
              let decoder = json["decoder"] as? String,
              let tokens = json["tokens"] as? String else {
            NSLog("[KeyboardTranscriptionListener] No sherpa model config at %@", configPath)
            return nil
        }

        // Verify the encoder file actually exists on disk — bundled model
        // files can be cleared by the OS under storage pressure.
        let encoderPath = (modelDir as NSString).appendingPathComponent(encoder)
        guard FileManager.default.fileExists(atPath: encoderPath) else {
            NSLog("[KeyboardTranscriptionListener] Saved model file missing: %@", encoderPath)
            return nil
        }

        let files = SherpaModelFiles()
        files.modelDir = modelDir
        files.encoder = encoder
        files.decoder = decoder
        files.tokens = tokens
        files.joiner = json["joiner"] as? String

        switch modelTypeStr {
        case "whisper":
            files.modelType = .whisper
            files.language = requestedLanguage ?? (json["language"] as? String) ?? "en"
        case "nemo_transducer":
            files.modelType = .nemoTransducer
        default:
            NSLog("[KeyboardTranscriptionListener] Unsupported model type: %@", modelTypeStr)
            return nil
        }

        return files
    }

    // MARK: - Write Result

    private func writeResult(to url: URL, id: String, text: String?, error: String?) {
        var result: [String: Any] = [
            "id": id,
            "timestamp": Date().timeIntervalSince1970,
        ]
        if let text = text { result["text"] = text }
        if let error = error { result["error"] = error }

        do {
            let data = try JSONSerialization.data(withJSONObject: result)
            try data.write(to: url)
        } catch {
            NSLog("[KeyboardTranscriptionListener] Failed to write result: %@", error.localizedDescription)
        }
    }

    private func postResultNotification() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(
            center,
            CFNotificationName(resultNotificationName as CFString),
            nil, nil, true
        )
    }
}
