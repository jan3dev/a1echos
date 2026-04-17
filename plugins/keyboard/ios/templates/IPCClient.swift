import Foundation

/// Handles IPC between the keyboard extension and the main Echos app
/// using the App Group shared container and Darwin notifications.
///
/// Protocol:
/// 1. Extension records audio → writes audio.wav to shared container
/// 2. Extension writes request.json with status "pending"
/// 3. Extension posts Darwin notification to wake main app
/// 4. Main app transcribes → writes result.json
/// 5. Main app posts Darwin notification with result
/// 6. Extension reads result and inserts text
class IPCClient {

    static let appGroupID = "group.com.a1lab.echos.shared"
    static let requestNotificationName = "com.a1lab.echos.transcriptionRequest"
    static let resultNotificationName = "com.a1lab.echos.transcriptionResult"

    var onTranscriptionResult: ((String) -> Void)?
    var onTranscriptionError: ((String) -> Void)?

    private var pollTimer: Timer?
    private var currentRequestID: String?
    private let timeoutSeconds: TimeInterval = 10
    private let pollInterval: TimeInterval = 0.5

    init() {
        registerForResultNotification()
    }

    deinit {
        pollTimer?.invalidate()
    }

    // MARK: - Shared Container Paths

    static func sharedContainerURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID)
    }

    static func keyboardDirectory() -> URL? {
        guard let container = sharedContainerURL() else { return nil }
        let dir = container.appendingPathComponent("keyboard", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    static func audioFileURL() -> URL {
        let dir = keyboardDirectory() ?? FileManager.default.temporaryDirectory
        return dir.appendingPathComponent("audio.wav")
    }

    private static func requestFileURL() -> URL? {
        keyboardDirectory()?.appendingPathComponent("request.json")
    }

    private static func resultFileURL() -> URL? {
        keyboardDirectory()?.appendingPathComponent("result.json")
    }

    // MARK: - Request Transcription

    /// Sends a transcription request to the main app.
    func requestTranscription(audioFileURL: URL) {
        let requestID = UUID().uuidString
        currentRequestID = requestID

        // Write request file
        let request: [String: Any] = [
            "id": requestID,
            "status": "pending",
            "language": "en",
            "timestamp": Date().timeIntervalSince1970,
        ]

        guard let requestURL = IPCClient.requestFileURL() else {
            onTranscriptionError?("Could not access shared storage")
            return
        }

        do {
            let data = try JSONSerialization.data(withJSONObject: request)
            try data.write(to: requestURL)
        } catch {
            onTranscriptionError?("Failed to create transcription request")
            return
        }

        // Post Darwin notification to wake the main app
        postDarwinNotification(IPCClient.requestNotificationName)

        // Start polling for result as fallback
        startPolling(requestID: requestID)
    }

    // MARK: - Darwin Notifications

    private func registerForResultNotification() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()

        CFNotificationCenterAddObserver(
            center,
            observer,
            { _, observer, _, _, _ in
                guard let observer = observer else { return }
                let client = Unmanaged<IPCClient>.fromOpaque(observer).takeUnretainedValue()
                DispatchQueue.main.async {
                    client.checkForResult()
                }
            },
            IPCClient.resultNotificationName as CFString,
            nil,
            .deliverImmediately
        )
    }

    private func postDarwinNotification(_ name: String) {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(center, CFNotificationName(name as CFString), nil, nil, true)
    }

    // MARK: - Result Polling

    private func startPolling(requestID: String) {
        var elapsed: TimeInterval = 0

        pollTimer?.invalidate()
        pollTimer = Timer.scheduledTimer(withTimeInterval: pollInterval, repeats: true) { [weak self] timer in
            elapsed += self?.pollInterval ?? 0.5

            if elapsed >= (self?.timeoutSeconds ?? 10) {
                timer.invalidate()
                self?.onTranscriptionError?("Transcription timed out. Is Echos app running?")
                return
            }

            self?.checkForResult()
        }
    }

    private func checkForResult() {
        guard let resultURL = IPCClient.resultFileURL(),
              FileManager.default.fileExists(atPath: resultURL.path),
              let data = try? Data(contentsOf: resultURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let resultID = json["id"] as? String,
              resultID == currentRequestID else {
            return
        }

        // Found matching result
        pollTimer?.invalidate()
        pollTimer = nil

        if let text = json["text"] as? String, !text.isEmpty {
            onTranscriptionResult?(text)
        } else if let error = json["error"] as? String {
            onTranscriptionError?(error)
        } else {
            onTranscriptionError?("No transcription result")
        }

        // Clean up
        currentRequestID = nil
        try? FileManager.default.removeItem(at: resultURL)
    }
}
