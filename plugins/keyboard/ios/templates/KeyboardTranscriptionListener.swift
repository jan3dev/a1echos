import Foundation

/// Runs in the main Echos app process. Listens for transcription requests
/// from the keyboard extension via Darwin notifications, transcribes audio
/// using WhisperBridge (whisper.rn C API), and writes results back to the
/// App Group shared container.
@objc class KeyboardTranscriptionListener: NSObject {

    static let shared = KeyboardTranscriptionListener()

    private let appGroupID = "group.com.a1lab.echos.shared"
    private let requestNotificationName = "com.a1lab.echos.transcriptionRequest"
    private let resultNotificationName = "com.a1lab.echos.transcriptionResult"
    private let modelPathKey = "whisper_model_path"

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

        NSLog("[KeyboardTranscriptionListener] Started listening for keyboard transcription requests")
    }

    @objc func stopListening() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterRemoveObserver(center, observer, nil, nil)
    }

    /// Saves the Whisper model path to the App Group UserDefaults
    /// so the listener (and extension) can find it.
    @objc func saveModelPath(_ path: String) {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return }
        // Strip file:// prefix if present
        let cleanPath = path.hasPrefix("file://")
            ? String(path.dropFirst(7))
            : path
        defaults.set(cleanPath, forKey: modelPathKey)
        defaults.synchronize()
        NSLog("[KeyboardTranscriptionListener] Model path saved: %@", cleanPath)
    }

    // MARK: - Handle Request

    private func handleTranscriptionRequest() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.processRequest()
        }
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

        // Read request
        guard FileManager.default.fileExists(atPath: requestURL.path),
              let requestData = try? Data(contentsOf: requestURL),
              let request = try? JSONSerialization.jsonObject(with: requestData) as? [String: Any],
              let requestID = request["id"] as? String,
              let status = request["status"] as? String,
              status == "pending" else {
            return
        }

        // Verify audio file exists
        guard FileManager.default.fileExists(atPath: audioURL.path) else {
            writeResult(to: resultURL, id: requestID, text: nil, error: "No audio file found")
            postResultNotification()
            return
        }

        NSLog("[KeyboardTranscriptionListener] Processing request: %@", requestID)

        // Ensure model is loaded
        let bridge = WhisperBridge.shared()
        if !bridge.isModelLoaded() {
            guard let modelPath = resolveModelPath() else {
                writeResult(to: resultURL, id: requestID, text: nil, error: "Whisper model not found. Open Echos app first.")
                postResultNotification()
                return
            }

            if !bridge.loadModel(modelPath) {
                writeResult(to: resultURL, id: requestID, text: nil, error: "Failed to load Whisper model")
                postResultNotification()
                return
            }
        }

        // Transcribe
        let language = request["language"] as? String
        let text = bridge.transcribeFile(audioURL.path, language: language)

        if let text = text, !text.isEmpty {
            writeResult(to: resultURL, id: requestID, text: text, error: nil)
        } else {
            writeResult(to: resultURL, id: requestID, text: nil, error: "Transcription returned empty result")
        }

        // Clean up request
        try? FileManager.default.removeItem(at: requestURL)
        postResultNotification()
    }

    // MARK: - Model Path Resolution

    private func resolveModelPath() -> String? {
        // 1. Check App Group UserDefaults (set by WhisperService.ts)
        if let defaults = UserDefaults(suiteName: appGroupID),
           let savedPath = defaults.string(forKey: modelPathKey),
           FileManager.default.fileExists(atPath: savedPath) {
            return savedPath
        }

        // 2. Fallback: scan Expo asset cache for .bin files matching model size
        let cacheDir = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true).first ?? ""
        if let enumerator = FileManager.default.enumerator(atPath: cacheDir) {
            while let file = enumerator.nextObject() as? String {
                if file.hasSuffix(".bin") {
                    let fullPath = (cacheDir as NSString).appendingPathComponent(file)
                    if let attrs = try? FileManager.default.attributesOfItem(atPath: fullPath),
                       let size = attrs[.size] as? UInt64,
                       size > 70_000_000 { // ~70MB for tiny model
                        NSLog("[KeyboardTranscriptionListener] Found model at: %@", fullPath)
                        return fullPath
                    }
                }
            }
        }

        NSLog("[KeyboardTranscriptionListener] Model not found")
        return nil
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
