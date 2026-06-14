import AVFoundation
import Foundation
import UIKit

/// Runs in the main Echos app process. Listens for transcription requests from
/// the keyboard extension via Darwin notifications, transcribes the audio via
/// `SherpaBridge` (sherpa-onnx C++ API), and writes the result into the App
/// Group shared container for the extension to pick up.
@objc class KeyboardTranscriptionListener: NSObject {

    static let shared = KeyboardTranscriptionListener()

    private let appGroupID = "group.com.a1lab.echos.shared"
    private let resultNotificationName = "com.a1lab.echos.transcriptionResult"
    private let pingNotificationName = "com.a1lab.echos.transcriptionPing"
    private let pongNotificationName = "com.a1lab.echos.transcriptionPong"
    // iOS forbids keyboard extensions from recording the mic (the audio daemon
    // rejects AURemoteIO start with "extension … doesn't have entitlements to
    // record audio"). So the *app* records on the keyboard's behalf: the
    // keyboard posts recordStart/recordStop and we drive AVAudioRecorder here,
    // then transcribe and reply over the existing result channel.
    private let recordStartNotificationName = "com.a1lab.echos.recordStart"
    private let recordStopNotificationName = "com.a1lab.echos.recordStop"
    /// JSON file inside the main app's Documents directory that describes the
    /// active sherpa-onnx model. Written from JS by SherpaTranscriptionService
    /// when initialization succeeds, read here when the keyboard requests
    /// transcription. The listener runs in the main app process so App Group
    /// sharing is unnecessary for this file.
    private let modelConfigFilename = "keyboard-sherpa-model.json"
    /// Keyboard settings JSON written by JS (`writeKeyboardSettings`) into the
    /// app's Documents directory. Mirrored into App Group `UserDefaults` (below)
    /// because the keyboard *extension* is sandboxed away from Documents and
    /// can only read the shared suite.
    private let keyboardSettingsFilename = "keyboard-settings.json"
    /// Must match `KeyboardSettings.swift` in the extension.
    private let autocorrectDefaultsKey = "EchosKeyboard.autocorrect"
    private let hapticDefaultsKey = "EchosKeyboard.hapticFeedback"
    private var lifecycleObservers: [NSObjectProtocol] = []

    /// Grace-window assertion that keeps the app alive for a short spell after
    /// it backgrounds. iOS suspends a backgrounded app within seconds, and a
    /// suspended app can't answer the keyboard's ping or drive the recorder —
    /// so without this the keyboard's voice typing dies the moment the user
    /// switches to another app. The assertion buys ~30s; we refresh it on each
    /// ping/record so a session in active use keeps going, and let it lapse
    /// (re-suspending the app) once the user stops. Always touched on main.
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    /// Active recording driven by the keyboard. Owned + mutated on the main
    /// thread (recordStart/recordStop handlers and the max-duration timer all
    /// hop to main) so no extra synchronisation is needed.
    ///
    /// We capture via `AVAudioEngine` + an input tap rather than
    /// `AVAudioRecorder`: `AVAudioRecorder.record()` returns false when the app
    /// is in the background (it can't start a fresh recording while backgrounded,
    /// which is exactly when the keyboard needs it — the user is in another app).
    /// An `AVAudioEngine` tap starts reliably in that state, and we write the WAV
    /// ourselves from the converted PCM.
    private var audioEngine: AVAudioEngine?
    private var wavWriter: WavStreamWriter?
    /// Latest input level (0…1) computed on the audio tap thread, published to
    /// the App Group by `meterTimer` on the main thread. A plain `Float`
    /// read/written across threads — a torn read just yields a momentarily stale
    /// level, which the waveform's smoothing absorbs.
    private var latestLevel: Float = 0
    private var recordingMaxTimer: Timer?
    private let recordingSampleRate: Double = 16000
    /// Whisper's context window is 30s; cap recording so a keyboard left in the
    /// recording state can't hold the mic (and the app awake) indefinitely.
    private let recordingMaxSeconds: TimeInterval = 30

    /// Publishes the recorder's input level into the App Group so the keyboard's
    /// waveform can react to real audio (it can't read levels itself — capture
    /// lives here, in the app process).
    private var meterTimer: Timer?
    /// Counts published meter frames so we can log the live input level roughly
    /// once a second — confirms whether the recorder is actually capturing audio
    /// (a flat -160 dB floor means silence / no input route).
    private var meterTickCount = 0
    /// dB range mapped to the waveform's 0…1 level — matches the values the
    /// keyboard's `RecordingWaveformView` was tuned against.
    private let meterMinDb: Float = -50
    private let meterMaxDb: Float = -10

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
                listener.handleRecordStart()
            },
            recordStartNotificationName as CFString,
            nil,
            .deliverImmediately
        )

        CFNotificationCenterAddObserver(
            center,
            observer,
            { _, observer, _, _, _ in
                guard let observer = observer else { return }
                let listener = Unmanaged<KeyboardTranscriptionListener>.fromOpaque(observer).takeUnretainedValue()
                listener.handleRecordStop()
            },
            recordStopNotificationName as CFString,
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

        // Mirror keyboard settings (written by JS to the app sandbox, which the
        // extension can't read) into the App Group suite the extension reads.
        // Re-mirror when the app backgrounds so a toggle made mid-session
        // reaches the keyboard before the user switches to another app.
        mirrorKeyboardSettings()
        let nc = NotificationCenter.default
        for name in [
            UIApplication.willResignActiveNotification,
            UIApplication.didEnterBackgroundNotification,
        ] {
            let token = nc.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                self?.mirrorKeyboardSettings()
            }
            lifecycleObservers.append(token)
        }

        // Open the grace window as the app backgrounds (so the keyboard can
        // still reach it for a spell), and close it once the app is foreground
        // again — a foreground app isn't suspended, so the assertion is pure
        // battery cost there.
        let bgToken = nc.addObserver(
            forName: UIApplication.didEnterBackgroundNotification,
            object: nil, queue: .main
        ) { [weak self] _ in self?.beginGraceWindow() }
        lifecycleObservers.append(bgToken)

        let fgToken = nc.addObserver(
            forName: UIApplication.didBecomeActiveNotification,
            object: nil, queue: .main
        ) { [weak self] _ in self?.endGraceWindow() }
        lifecycleObservers.append(fgToken)

        NSLog("[KeyboardTranscriptionListener] Started listening for keyboard transcription requests")
    }

    @objc func stopListening() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        let observer = Unmanaged.passUnretained(self).toOpaque()
        CFNotificationCenterRemoveObserver(center, observer, nil, nil)
        for token in lifecycleObservers {
            NotificationCenter.default.removeObserver(token)
        }
        lifecycleObservers.removeAll()
        endGraceWindow()
    }

    // MARK: - Background Grace Window

    /// Starts (or refreshes) the background-task assertion that keeps the app
    /// alive while backgrounded so it can answer the keyboard. Each assertion
    /// is good for ~30s; refreshing replaces the running one with a fresh
    /// window, so continued voice typing keeps the app awake while idle use
    /// lets it lapse. Must run on the main thread.
    private func beginGraceWindow() {
        let app = UIApplication.shared
        let previous = backgroundTask
        var task: UIBackgroundTaskIdentifier = .invalid
        task = app.beginBackgroundTask(withName: "EchosKeyboardVoiceTyping") { [weak self] in
            // Expiration handler: end this exact assertion or iOS kills the app.
            app.endBackgroundTask(task)
            if self?.backgroundTask == task { self?.backgroundTask = .invalid }
        }
        backgroundTask = task
        // End the prior assertion only after the new one is live, so the app is
        // never momentarily unprotected between the two.
        if previous != .invalid {
            app.endBackgroundTask(previous)
        }
    }

    private func endGraceWindow() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    /// Refresh the grace window when the keyboard reaches us while backgrounded
    /// (a ping or record-start), extending it for the active session. Skipped
    /// when foreground, where the app isn't suspended and holding an assertion
    /// would just leak until the next background cycle.
    private func refreshGraceWindowIfBackgrounded() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self,
                  UIApplication.shared.applicationState == .background else { return }
            self.beginGraceWindow()
        }
    }

    // MARK: - Keyboard Settings Mirror

    /// Reads `keyboard-settings.json` from the app's Documents directory and
    /// copies the `autocorrect` and `hapticFeedback` flags into the App Group
    /// `UserDefaults` the keyboard extension reads via `KeyboardSettings.load()`.
    /// Writes the conservative defaults (false) when the file is missing or
    /// unparseable.
    private func mirrorKeyboardSettings() {
        guard let docsDir = NSSearchPathForDirectoriesInDomains(
            .documentDirectory, .userDomainMask, true
        ).first else { return }
        let path = (docsDir as NSString).appendingPathComponent(keyboardSettingsFilename)

        var autocorrect = false
        var hapticFeedback = false
        if FileManager.default.fileExists(atPath: path),
           let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            autocorrect = (json["autocorrect"] as? Bool) ?? false
            hapticFeedback = (json["hapticFeedback"] as? Bool) ?? false
        }
        let defaults = UserDefaults(suiteName: appGroupID)
        defaults?.set(autocorrect, forKey: autocorrectDefaultsKey)
        defaults?.set(hapticFeedback, forKey: hapticDefaultsKey)
    }

    // MARK: - Recording (on the keyboard's behalf)

    private func handleRecordStart() {
        NSLog("[KeyboardTranscriptionListener] recordStart notification received")
        refreshGraceWindowIfBackgrounded()
        DispatchQueue.main.async { [weak self] in self?.beginRecording() }
    }

    private func handleRecordStop() {
        NSLog("[KeyboardTranscriptionListener] recordStop notification received")
        DispatchQueue.main.async { [weak self] in self?.finishRecordingAndTranscribe() }
    }

    /// Temp WAV the app records into. Lives in the app's own sandbox (not the
    /// shared App Group container) — the user's voice never touches shared
    /// storage, and we transcribe it in-process.
    private func recordingFileURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent("keyboard-recording.wav")
    }

    /// Records 16 kHz mono PCM in the main app process. Unlike the extension
    /// (which the OS forbids from recording), a full app with the `audio`
    /// background mode is allowed to capture the mic while backgrounded — but
    /// only via `AVAudioEngine`; `AVAudioRecorder.record()` returns false in the
    /// background (see `audioEngine`).
    private func beginRecording() {
        let app = UIApplication.shared
        NSLog(
            "[KeyboardTranscriptionListener] beginRecording (appState=%ld, bgTimeRemaining=%.1fs)",
            app.applicationState.rawValue, app.backgroundTimeRemaining
        )

        if audioEngine != nil {
            // A stale engine means the previous session never stopped. Tear it
            // down so this fresh request can proceed instead of dead-ending.
            NSLog("[KeyboardTranscriptionListener] recordStart while already recording — resetting")
            teardownEngine()
        }

        let session = AVAudioSession.sharedInstance()
        let permission = session.recordPermission
        guard permission == .granted else {
            // Mic permission is app-global, so this fails identically in fore- and
            // background. Reply immediately with a specific instruction instead of
            // letting the keyboard's stop poll time out 10s later.
            NSLog(
                "[KeyboardTranscriptionListener] Mic permission not granted (rawValue=%ld)",
                Int(permission.rawValue)
            )
            replyError(
                permission == .denied
                    ? "Microphone access is off for Echos. Enable it in Settings › Echos."
                    : "Open Echos and allow microphone access to use voice typing."
            )
            return
        }

        do {
            try session.setCategory(
                .playAndRecord, mode: .measurement,
                options: [.allowBluetooth, .mixWithOthers]
            )
            try activateSessionWithRetry(session)
        } catch {
            let nsError = error as NSError
            NSLog(
                "[KeyboardTranscriptionListener] Session setup failed: %@ (domain=%@ code=%ld)",
                error.localizedDescription, nsError.domain, nsError.code
            )
            replyError("Couldn't start the microphone. Open Echos and try again.")
            return
        }

        let url = recordingFileURL()
        try? FileManager.default.removeItem(at: url)

        let engine = AVAudioEngine()
        let input = engine.inputNode
        // The hardware capture format (e.g. 48 kHz float). A zero sample rate
        // means the input route is unavailable — bail with a clear message
        // rather than installing a tap that never fires.
        let inputFormat = input.inputFormat(forBus: 0)
        NSLog(
            "[KeyboardTranscriptionListener] input format: %.0f Hz, %u ch",
            inputFormat.sampleRate, inputFormat.channelCount
        )
        guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else {
            replyError("Couldn't access the microphone. Open Echos and try again.")
            return
        }

        guard let targetFormat = AVAudioFormat(
            commonFormat: .pcmFormatInt16, sampleRate: recordingSampleRate,
            channels: 1, interleaved: true
        ), let converter = AVAudioConverter(from: inputFormat, to: targetFormat) else {
            NSLog("[KeyboardTranscriptionListener] Could not build audio converter")
            replyError("Couldn't start recording. Open Echos and try again.")
            return
        }

        guard let writer = WavStreamWriter(
            url: url, sampleRate: Int(recordingSampleRate), channels: 1, bitsPerSample: 16
        ) else {
            NSLog("[KeyboardTranscriptionListener] Could not open WAV writer at %@", url.path)
            replyError("Couldn't start recording. Open Echos and try again.")
            return
        }

        latestLevel = 0
        input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) {
            [weak self] buffer, _ in
            self?.handleTapBuffer(buffer, converter: converter, targetFormat: targetFormat, writer: writer)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            writer.close()
            try? FileManager.default.removeItem(at: url)
            let nsError = error as NSError
            NSLog(
                "[KeyboardTranscriptionListener] engine.start() failed: %@ (code %ld)",
                error.localizedDescription, nsError.code
            )
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            replyError("Couldn't start recording. Open Echos and try again.")
            return
        }

        audioEngine = engine
        wavWriter = writer

        NSLog("[KeyboardTranscriptionListener] Recording started: %@", url.path)
        startMetering()
        recordingMaxTimer = Timer.scheduledTimer(
            withTimeInterval: recordingMaxSeconds, repeats: false
        ) { [weak self] _ in
            self?.finishRecordingAndTranscribe()
        }
    }

    /// Converts a hardware capture buffer to 16 kHz mono PCM16, appends it to the
    /// WAV, and updates `latestLevel` for the waveform. Runs on the realtime
    /// audio thread — keeps work minimal (one convert + one append).
    private func handleTapBuffer(
        _ buffer: AVAudioPCMBuffer,
        converter: AVAudioConverter,
        targetFormat: AVAudioFormat,
        writer: WavStreamWriter
    ) {
        let ratio = targetFormat.sampleRate / buffer.format.sampleRate
        let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1
        guard capacity > 0,
              let outBuffer = AVAudioPCMBuffer(pcmFormat: targetFormat, frameCapacity: capacity)
        else { return }

        var supplied = false
        var convertError: NSError?
        let status = converter.convert(to: outBuffer, error: &convertError) { _, status in
            if supplied {
                status.pointee = .noDataNow
                return nil
            }
            supplied = true
            status.pointee = .haveData
            return buffer
        }
        if status == .error {
            NSLog(
                "[KeyboardTranscriptionListener] convert error: %@",
                convertError?.localizedDescription ?? "unknown"
            )
            return
        }

        let frames = Int(outBuffer.frameLength)
        guard frames > 0, let samples = outBuffer.int16ChannelData?[0] else { return }
        writer.append(Data(bytes: samples, count: frames * MemoryLayout<Int16>.size))

        // RMS → dB → normalized level, matching the range the waveform expects.
        var sumSquares: Double = 0
        for i in 0..<frames {
            let sample = Double(samples[i]) / 32768.0
            sumSquares += sample * sample
        }
        let rms = (sumSquares / Double(frames)).squareRoot()
        let db = rms > 0 ? Float(20 * log10(rms)) : meterMinDb
        latestLevel = max(0, min(1, (db - meterMinDb) / (meterMaxDb - meterMinDb)))
    }

    /// Stops and discards the capture engine + WAV writer and the timers that
    /// drive a recording. Idempotent — used to reset a stale session before a
    /// fresh start.
    private func teardownEngine() {
        recordingMaxTimer?.invalidate()
        recordingMaxTimer = nil
        stopMetering()
        if let engine = audioEngine {
            engine.inputNode.removeTap(onBus: 0)
            engine.stop()
        }
        audioEngine = nil
        wavWriter?.close()
        wavWriter = nil
    }

    /// Activates the audio session, retrying once. Background activation of a
    /// `.playAndRecord` session can throw transiently when the session is still
    /// settling from a prior deactivation (or another app is mid-handoff); a
    /// single deactivate-then-retry clears that without masking a real failure.
    private func activateSessionWithRetry(_ session: AVAudioSession) throws {
        do {
            try session.setActive(true)
        } catch {
            NSLog(
                "[KeyboardTranscriptionListener] setActive(true) failed, retrying: %@",
                error.localizedDescription
            )
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            try session.setActive(true)
        }
    }

    // MARK: - Metering IPC

    /// File in the App Group container holding the latest input level as a raw
    /// little-endian `Double` (0…1). The keyboard polls it to drive its waveform.
    private func meterFileURL() -> URL? {
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else { return nil }
        return container
            .appendingPathComponent("keyboard", isDirectory: true)
            .appendingPathComponent("meter")
    }

    private func startMetering() {
        stopMetering()
        meterTickCount = 0
        // Start from a clean slate so a value from a prior session can't flash.
        if let url = meterFileURL() { try? FileManager.default.removeItem(at: url) }
        meterTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) {
            [weak self] _ in self?.publishMeterLevel()
        }
    }

    private func publishMeterLevel() {
        guard audioEngine != nil, let url = meterFileURL() else { return }
        // `latestLevel` is set on the audio tap thread; we just snapshot and
        // publish it here on the main thread.
        let normalized = Double(latestLevel)
        let data = withUnsafeBytes(of: normalized) { Data($0) }
        try? data.write(to: url, options: .atomic)
        meterTickCount += 1
        if meterTickCount % 30 == 1 {
            NSLog(
                "[KeyboardTranscriptionListener] meter: normalized=%.2f",
                normalized
            )
        }
    }

    private func stopMetering() {
        meterTimer?.invalidate()
        meterTimer = nil
        if let url = meterFileURL() { try? FileManager.default.removeItem(at: url) }
    }

    /// Stops the active recording (from recordStop or the max-duration backstop)
    /// and kicks transcription off the main thread. Idempotent: the first call
    /// clears `audioEngine`, so the timer + recordStop racing is harmless.
    private func finishRecordingAndTranscribe() {
        recordingMaxTimer?.invalidate()
        recordingMaxTimer = nil
        stopMetering()

        guard let engine = audioEngine, let writer = wavWriter else {
            // Recording never started (beginRecording bailed). beginRecording
            // already replied with a specific error in that case; this is the
            // fallback so a missed reply still ends the keyboard's poll fast
            // rather than letting it run the full 10s timeout.
            NSLog("[KeyboardTranscriptionListener] recordStop with no active engine")
            replyError("Recording didn't start. Open Echos and try again.")
            return
        }
        let url = recordingFileURL()
        let didRecord = engine.isRunning
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        writer.close()
        audioEngine = nil
        wavWriter = nil
        NSLog("[KeyboardTranscriptionListener] Recording stopped (didRecord=%@)",
              didRecord ? "true" : "false")

        // Deactivating the session drops the audio-mode background liveness that
        // kept us awake while recording. Without a fresh assertion the app can
        // be suspended before transcription writes its result — so the keyboard
        // records fine but the stop silently times out. Refresh first; the
        // window is released once the result is posted.
        refreshGraceWindowIfBackgrounded()

        try? AVAudioSession.sharedInstance().setActive(
            false, options: .notifyOthersOnDeactivation
        )

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.processRecordedAudio(at: url, didRecord: didRecord)
        }
    }

    /// Transcribes the freshly recorded clip and replies over the result
    /// channel, keyed to the request ID the keyboard wrote at recordStart.
    private func processRecordedAudio(at audioURL: URL, didRecord: Bool) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            NSLog("[KeyboardTranscriptionListener] Cannot access App Group container")
            return
        }

        let keyboardDir = containerURL.appendingPathComponent("keyboard", isDirectory: true)
        let requestURL = keyboardDir.appendingPathComponent("request.json")
        let resultURL = keyboardDir.appendingPathComponent("result.json")

        // The keyboard wrote request.json at recordStart; without its ID there's
        // no result to key — nothing to reply to.
        guard FileManager.default.fileExists(atPath: requestURL.path),
              let requestData = try? Data(contentsOf: requestURL),
              let request = try? JSONSerialization.jsonObject(with: requestData) as? [String: Any],
              let requestID = request["id"] as? String else {
            try? FileManager.default.removeItem(at: audioURL)
            return
        }

        // The clip holds the user's voice — remove it (and the request marker)
        // on every return path once we've handled it.
        defer {
            try? FileManager.default.removeItem(at: audioURL)
            try? FileManager.default.removeItem(at: requestURL)
        }

        let recordedSize = (try? FileManager.default.attributesOfItem(atPath: audioURL.path))
            .flatMap { $0[.size] as? UInt64 } ?? 0
        NSLog(
            "[KeyboardTranscriptionListener] processRecordedAudio (didRecord=%@, size=%llu bytes)",
            didRecord ? "true" : "false", recordedSize
        )
        guard didRecord, recordedSize > 1024 else {
            writeResult(to: resultURL, id: requestID, text: nil, error: "No audio was recorded.")
            postResultNotification()
            return
        }

        NSLog("[KeyboardTranscriptionListener] Transcribing request: %@", requestID)
        transcribe(audioPath: audioURL.path, requestID: requestID,
                   requestedLanguage: request["language"] as? String, resultURL: resultURL)
    }

    /// Loads the active model and transcribes a WAV, writing the outcome to
    /// `result.json` and posting the result notification.
    private func transcribe(
        audioPath: String, requestID: String,
        requestedLanguage: String?, resultURL: URL
    ) {
        let bridge = SherpaBridge.shared()
        guard let files = resolveModelFiles(requestedLanguage: requestedLanguage) else {
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

        let text = bridge.transcribeFile(audioPath)
        if let text = text, !text.isEmpty {
            writeResult(to: resultURL, id: requestID, text: text, error: nil)
        } else {
            writeResult(to: resultURL, id: requestID, text: nil, error: "Transcription returned empty result")
        }
        postResultNotification()
    }

    /// Reply to a keyboard pre-flight ping by writing the matching ID to
    /// `pong.json` and posting the pong Darwin notification. Synchronous
    /// and minimal — this needs to round-trip in <300ms.
    private func handlePing() {
        // A ping means the keyboard is about to record — keep us alive for it.
        refreshGraceWindowIfBackgrounded()
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

    /// Replies to the keyboard's *in-flight* record request with an error,
    /// keyed to the ID it wrote at recordStart. Used when recording can't even
    /// start (permission, session, or recorder failure) so the keyboard shows a
    /// specific message at once instead of spinning until its 10s stop-poll
    /// times out. The keyboard's result observer matches this against its
    /// `currentRequestID` and surfaces it immediately. Consumes request.json so
    /// a later recordStop can't re-process the dead request.
    private func replyError(_ message: String) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            NSLog("[KeyboardTranscriptionListener] replyError: no App Group container")
            return
        }
        let keyboardDir = containerURL.appendingPathComponent("keyboard", isDirectory: true)
        let requestURL = keyboardDir.appendingPathComponent("request.json")
        let resultURL = keyboardDir.appendingPathComponent("result.json")

        guard let data = try? Data(contentsOf: requestURL),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let requestID = json["id"] as? String else {
            NSLog(
                "[KeyboardTranscriptionListener] replyError with no pending request: %@",
                message
            )
            return
        }

        writeResult(to: resultURL, id: requestID, text: nil, error: message)
        try? FileManager.default.removeItem(at: requestURL)
        postResultNotification()
        NSLog("[KeyboardTranscriptionListener] Replied error to keyboard: %@", message)
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

/// Streams 16-bit PCM into a canonical RIFF/WAVE file. We write the WAV
/// ourselves because capture goes through an `AVAudioEngine` tap (not
/// `AVAudioRecorder`, which won't start in the background). A 44-byte header is
/// written up front with placeholder sizes, samples are appended as they arrive,
/// and `close()` patches the two size fields. sherpa-onnx's WaveReader consumes
/// this directly (16 kHz mono PCM16).
final class WavStreamWriter {
    private let handle: FileHandle
    private var dataBytes: UInt32 = 0
    private let sampleRate: Int
    private let channels: Int
    private let bitsPerSample: Int
    private var closed = false

    init?(url: URL, sampleRate: Int, channels: Int, bitsPerSample: Int) {
        self.sampleRate = sampleRate
        self.channels = channels
        self.bitsPerSample = bitsPerSample
        FileManager.default.createFile(atPath: url.path, contents: nil)
        guard let handle = try? FileHandle(forWritingTo: url) else { return nil }
        self.handle = handle
        handle.write(header(dataBytes: 0))
    }

    /// Appends raw little-endian PCM sample bytes. Called on the audio thread.
    func append(_ data: Data) {
        guard !closed else { return }
        handle.write(data)
        dataBytes &+= UInt32(data.count)
    }

    /// Patches the RIFF chunk size + data subchunk size and closes the file.
    /// Idempotent — safe to call from both the stop path and teardown.
    func close() {
        guard !closed else { return }
        closed = true
        // RIFF chunk size = 36 + dataBytes (whole file minus the 8-byte RIFF id+size).
        try? handle.seek(toOffset: 4)
        handle.write(le32(36 &+ dataBytes))
        // data subchunk size.
        try? handle.seek(toOffset: 40)
        handle.write(le32(dataBytes))
        try? handle.close()
    }

    private func le32(_ value: UInt32) -> Data {
        withUnsafeBytes(of: value.littleEndian) { Data($0) }
    }

    private func le16(_ value: UInt16) -> Data {
        withUnsafeBytes(of: value.littleEndian) { Data($0) }
    }

    private func header(dataBytes: UInt32) -> Data {
        let byteRate = UInt32(sampleRate * channels * bitsPerSample / 8)
        let blockAlign = UInt16(channels * bitsPerSample / 8)
        var data = Data()
        data.append("RIFF".data(using: .ascii)!)
        data.append(le32(36 &+ dataBytes))
        data.append("WAVE".data(using: .ascii)!)
        data.append("fmt ".data(using: .ascii)!)
        data.append(le32(16))                       // PCM fmt chunk size
        data.append(le16(1))                        // audio format = PCM
        data.append(le16(UInt16(channels)))
        data.append(le32(UInt32(sampleRate)))
        data.append(le32(byteRate))
        data.append(le16(blockAlign))
        data.append(le16(UInt16(bitsPerSample)))
        data.append("data".data(using: .ascii)!)
        data.append(le32(dataBytes))
        return data
    }
}
