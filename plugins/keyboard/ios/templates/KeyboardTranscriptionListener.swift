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
    private var lifecycleObservers: [NSObjectProtocol] = []

    /// Active recording driven by the keyboard. Owned + mutated on the main
    /// thread (recordStart/recordStop handlers and the max-duration timer all
    /// hop to main) so no extra synchronisation is needed.
    private var audioRecorder: AVAudioRecorder?
    private var recordingMaxTimer: Timer?
    private let recordingSampleRate: Double = 16000
    /// Whisper's context window is 30s; cap recording so a keyboard left in the
    /// recording state can't hold the mic (and the app awake) indefinitely.
    private let recordingMaxSeconds: TimeInterval = 30

    /// Publishes the recorder's input level into the App Group so the keyboard's
    /// waveform can react to real audio (it can't read levels itself — capture
    /// lives here, in the app process).
    private var meterTimer: Timer?
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
    }

    // MARK: - Keyboard Settings Mirror

    /// Reads `keyboard-settings.json` from the app's Documents directory and
    /// copies the `autocorrect` flag into the App Group `UserDefaults` the
    /// keyboard extension reads via `KeyboardSettings.load()`. Writes the
    /// conservative default (false) when the file is missing or unparseable.
    private func mirrorKeyboardSettings() {
        guard let docsDir = NSSearchPathForDirectoriesInDomains(
            .documentDirectory, .userDomainMask, true
        ).first else { return }
        let path = (docsDir as NSString).appendingPathComponent(keyboardSettingsFilename)

        var autocorrect = false
        if FileManager.default.fileExists(atPath: path),
           let data = try? Data(contentsOf: URL(fileURLWithPath: path)),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let value = json["autocorrect"] as? Bool {
            autocorrect = value
        }
        UserDefaults(suiteName: appGroupID)?.set(autocorrect, forKey: autocorrectDefaultsKey)
    }

    // MARK: - Recording (on the keyboard's behalf)

    private func handleRecordStart() {
        DispatchQueue.main.async { [weak self] in self?.beginRecording() }
    }

    private func handleRecordStop() {
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
    /// background mode is allowed to capture the mic while backgrounded.
    private func beginRecording() {
        guard audioRecorder == nil else {
            NSLog("[KeyboardTranscriptionListener] recordStart while already recording")
            return
        }

        let session = AVAudioSession.sharedInstance()
        guard session.recordPermission == .granted else {
            // Without permission there's nothing to transcribe; the keyboard's
            // poll will time out and prompt the user to open Echos.
            NSLog("[KeyboardTranscriptionListener] Mic permission not granted — cannot record")
            return
        }

        do {
            try session.setCategory(
                .playAndRecord, mode: .measurement,
                options: [.allowBluetooth, .mixWithOthers]
            )
            try session.setActive(true)
        } catch {
            NSLog("[KeyboardTranscriptionListener] Session setup failed: %@",
                  error.localizedDescription)
            return
        }

        let url = recordingFileURL()
        try? FileManager.default.removeItem(at: url)
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: recordingSampleRate,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsFloatKey: false,
        ]

        do {
            let recorder = try AVAudioRecorder(url: url, settings: settings)
            recorder.isMeteringEnabled = true
            guard recorder.record() else {
                NSLog("[KeyboardTranscriptionListener] record() returned false")
                try? session.setActive(false, options: .notifyOthersOnDeactivation)
                return
            }
            audioRecorder = recorder
        } catch {
            NSLog("[KeyboardTranscriptionListener] Recorder init failed: %@",
                  error.localizedDescription)
            try? session.setActive(false, options: .notifyOthersOnDeactivation)
            return
        }

        NSLog("[KeyboardTranscriptionListener] Recording started: %@", url.path)
        startMetering()
        recordingMaxTimer = Timer.scheduledTimer(
            withTimeInterval: recordingMaxSeconds, repeats: false
        ) { [weak self] _ in
            self?.finishRecordingAndTranscribe()
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
        // Start from a clean slate so a value from a prior session can't flash.
        if let url = meterFileURL() { try? FileManager.default.removeItem(at: url) }
        meterTimer = Timer.scheduledTimer(withTimeInterval: 1.0 / 30.0, repeats: true) {
            [weak self] _ in self?.publishMeterLevel()
        }
    }

    private func publishMeterLevel() {
        guard let recorder = audioRecorder, recorder.isRecording,
              let url = meterFileURL() else { return }
        recorder.updateMeters()
        let power = recorder.averagePower(forChannel: 0)
        let normalized = max(0, min(1, (power - meterMinDb) / (meterMaxDb - meterMinDb)))
        let data = withUnsafeBytes(of: Double(normalized)) { Data($0) }
        try? data.write(to: url, options: .atomic)
    }

    private func stopMetering() {
        meterTimer?.invalidate()
        meterTimer = nil
        if let url = meterFileURL() { try? FileManager.default.removeItem(at: url) }
    }

    /// Stops the active recording (from recordStop or the max-duration backstop)
    /// and kicks transcription off the main thread. Idempotent: the first call
    /// clears `audioRecorder`, so the timer + recordStop racing is harmless.
    private func finishRecordingAndTranscribe() {
        recordingMaxTimer?.invalidate()
        recordingMaxTimer = nil
        stopMetering()

        guard let recorder = audioRecorder else { return }
        let url = recorder.url
        let didRecord = recorder.isRecording
        recorder.stop()
        audioRecorder = nil

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

        guard didRecord,
              let attrs = try? FileManager.default.attributesOfItem(atPath: audioURL.path),
              let size = attrs[.size] as? UInt64, size > 1024 else {
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

    private func postResultNotification() {
        let center = CFNotificationCenterGetDarwinNotifyCenter()
        CFNotificationCenterPostNotification(
            center,
            CFNotificationName(resultNotificationName as CFString),
            nil, nil, true
        )
    }
}
