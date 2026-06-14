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
    static let resultNotificationName = "com.a1lab.echos.transcriptionResult"
    /// iOS forbids the keyboard extension from recording the mic, so the main
    /// app records on our behalf. These tell it when to start and stop.
    static let recordStartNotificationName = "com.a1lab.echos.recordStart"
    static let recordStopNotificationName = "com.a1lab.echos.recordStop"
    /// Pre-flight ping/pong notifications. The keyboard fires a ping
    /// before recording so we can detect a force-killed main app and
    /// surface a clear "open Echos" toast instead of letting the user
    /// record and then time out 10 seconds later.
    static let pingNotificationName = "com.a1lab.echos.transcriptionPing"
    static let pongNotificationName = "com.a1lab.echos.transcriptionPong"

    var onTranscriptionResult: ((String) -> Void)?
    var onTranscriptionError: ((String) -> Void)?

    private var pollTimer: Timer?
    private var currentRequestID: String?
    private let timeoutSeconds: TimeInterval = 10
    private let pollInterval: TimeInterval = 0.5

    private var pingCompletion: ((Bool) -> Void)?
    private var pingTimeoutTimer: Timer?
    private var currentPingID: String?

    init() {
        registerForResultNotification()
        registerForPongNotification()
    }

    deinit {
        pollTimer?.invalidate()
        pingTimeoutTimer?.invalidate()
        // The Darwin observers were registered with `passUnretained(self)` —
        // if a notification fires after dealloc the callback dereferences
        // freed memory. Remove every observer keyed to this instance.
        let observer = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterRemoveEveryObserver(
            CFNotificationCenterGetDarwinNotifyCenter(),
            observer
        )
    }

    // MARK: - Shared Container Paths

    static func sharedContainerURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID)
    }

    private static let cachedKeyboardDirectory: URL? = {
        guard let container = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroupID)
        else { return nil }
        let dir = container.appendingPathComponent("keyboard", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    static func keyboardDirectory() -> URL? {
        cachedKeyboardDirectory
    }

    private static func requestFileURL() -> URL? {
        keyboardDirectory()?.appendingPathComponent("request.json")
    }

    private static func resultFileURL() -> URL? {
        keyboardDirectory()?.appendingPathComponent("result.json")
    }

    private static func meterFileURL() -> URL? {
        keyboardDirectory()?.appendingPathComponent("meter")
    }

    /// Latest input level (0…1) the main app publishes while recording, or nil
    /// if nothing's been written yet (file absent or mid-rewrite). Cheap enough
    /// to poll at display rate — a single 8-byte read.
    func readMeterLevel() -> Double? {
        guard let url = IPCClient.meterFileURL(),
              let data = try? Data(contentsOf: url),
              data.count == MemoryLayout<Double>.size else { return nil }
        let level = data.withUnsafeBytes { $0.loadUnaligned(as: Double.self) }
        guard level.isFinite else { return nil }
        return max(0, min(1, level))
    }

    private static func pingFileURL() -> URL? {
        keyboardDirectory()?.appendingPathComponent("ping.json")
    }

    private static func pongFileURL() -> URL? {
        keyboardDirectory()?.appendingPathComponent("pong.json")
    }

    // MARK: - Pre-flight Ping

    /// Synchronous-feeling check that the main Echos app is running and
    /// listening. Writes a ping file, posts a Darwin notification, and
    /// waits up to `timeout` for a matching pong. Calls `completion(true)`
    /// if a pong arrives in time, `completion(false)` otherwise.
    /// `completion` is always invoked on the main thread.
    func pingMainApp(
        timeout: TimeInterval = 0.6,
        completion: @escaping (Bool) -> Void
    ) {
        // Cancel any in-flight ping — only the most recent one is valid.
        pingTimeoutTimer?.invalidate()
        pingTimeoutTimer = nil
        pingCompletion = completion

        let pingID = UUID().uuidString
        currentPingID = pingID

        guard let pingURL = IPCClient.pingFileURL() else {
            finishPing(alive: false)
            return
        }

        let payload: [String: Any] = [
            "id": pingID,
            "timestamp": Date().timeIntervalSince1970,
        ]
        do {
            let data = try JSONSerialization.data(withJSONObject: payload)
            try data.write(to: pingURL)
        } catch {
            finishPing(alive: false)
            return
        }

        postDarwinNotification(IPCClient.pingNotificationName)

        pingTimeoutTimer = Timer.scheduledTimer(
            withTimeInterval: timeout, repeats: false
        ) { [weak self] _ in
            self?.finishPing(alive: false)
        }
    }

    private func finishPing(alive: Bool) {
        pingTimeoutTimer?.invalidate()
        pingTimeoutTimer = nil
        let completion = pingCompletion
        pingCompletion = nil
        currentPingID = nil
        DispatchQueue.main.async { completion?(alive) }
    }

    // MARK: - Record (main app records on the keyboard's behalf)

    /// Tells the main app to start recording. We write the request marker —
    /// carrying the ID the eventual result is keyed to — BEFORE posting, so the
    /// app can read it when it stops (either on our recordStop or its own
    /// max-duration backstop). `language` is deliberately omitted so the app
    /// uses the language in `keyboard-sherpa-model.json`, which it keeps fresh.
    func requestRecordStart() {
        let requestID = UUID().uuidString
        currentRequestID = requestID

        guard let requestURL = IPCClient.requestFileURL() else {
            onTranscriptionError?("Could not access shared storage")
            return
        }

        let request: [String: Any] = [
            "id": requestID,
            "status": "recording",
            "timestamp": Date().timeIntervalSince1970,
        ]
        do {
            let data = try JSONSerialization.data(withJSONObject: request)
            try data.write(to: requestURL)
        } catch {
            onTranscriptionError?("Failed to start recording")
            return
        }

        postDarwinNotification(IPCClient.recordStartNotificationName)
    }

    /// Tells the main app to stop recording and transcribe. The result arrives
    /// via the Darwin result observer; polling is a fallback if it's missed.
    func requestRecordStop() {
        postDarwinNotification(IPCClient.recordStopNotificationName)
        if let requestID = currentRequestID {
            startPolling(requestID: requestID)
        }
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

    private func registerForPongNotification() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()

        CFNotificationCenterAddObserver(
            center,
            observer,
            { _, observer, _, _, _ in
                guard let observer = observer else { return }
                let client = Unmanaged<IPCClient>.fromOpaque(observer).takeUnretainedValue()
                DispatchQueue.main.async {
                    client.checkForPong()
                }
            },
            IPCClient.pongNotificationName as CFString,
            nil,
            .deliverImmediately
        )
    }

    private func checkForPong() {
        guard let pongURL = IPCClient.pongFileURL(),
              FileManager.default.fileExists(atPath: pongURL.path),
              let data = try? Data(contentsOf: pongURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let pongID = json["id"] as? String,
              pongID == currentPingID else {
            return
        }
        try? FileManager.default.removeItem(at: pongURL)
        finishPing(alive: true)
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
