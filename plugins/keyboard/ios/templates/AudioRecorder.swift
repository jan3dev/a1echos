import AVFoundation
import Foundation

/// Records audio in the keyboard extension and saves it as a WAV file
/// in the App Group shared container for the main app to transcribe.
class AudioRecorder: NSObject {

    /// Reports the current input amplitude as a normalised 0…1 value while
    /// recording. Driven by a 30 Hz metering timer; callback fires on the
    /// main thread.
    var onAudioLevelChange: ((Float) -> Void)?

    private var audioRecorder: AVAudioRecorder?
    private var completion: ((Result<URL, Error>) -> Void)?
    private var meteringTimer: Timer?
    private var maxDurationTimer: Timer?

    private let sampleRate: Double = 16000
    private let maxDurationSeconds: TimeInterval = 30
    /// dB range mapped to the 0…1 visualizer level. -50dB ≈ a near-silent
    /// room hum (visualizer at rest), -10dB ≈ a clearly raised voice
    /// (visualizer at full reactivity).
    private let levelMinDb: Float = -50.0
    private let levelMaxDb: Float = -10.0

    enum RecorderError: LocalizedError {
        case noPermission
        case permissionUndetermined
        case setupFailed(String)
        case recordFailed(String)
        case noAudioRecorded
        case alreadyRecording

        var errorDescription: String? {
            switch self {
            case .noPermission:
                return "Microphone access denied. Open Echos → Settings → Microphone to allow."
            case .permissionUndetermined:
                // Keyboard extensions can't present permission prompts. The
                // grant has to happen in the host Echos app first.
                return "Open Echos and record once to grant microphone access."
            case .setupFailed(let detail):
                return "Could not start recording: \(detail)"
            case .recordFailed(let detail):
                return "Recording failed to start: \(detail)"
            case .noAudioRecorded:
                return "No audio was recorded."
            case .alreadyRecording:
                return "A recording is already in progress."
            }
        }
    }

    /// Starts recording audio. Calls completion with the audio file URL when done.
    func startRecording(completion: @escaping (Result<URL, Error>) -> Void) {
        // A re-entrant start while one is in flight would overwrite `completion`
        // and orphan the first caller (its handler would never fire). Reject it
        // instead of corrupting recorder state.
        guard audioRecorder == nil else {
            NSLog("[EchosKeyboard.AudioRecorder] startRecording called while already recording")
            completion(.failure(RecorderError.alreadyRecording))
            return
        }
        self.completion = completion

        // Keyboard extensions cannot present the system mic permission
        // prompt — calling `requestRecordPermission` from here when the
        // status is `.undetermined` returns `granted = false` silently on
        // real devices (works on simulator, which is why this slipped
        // through). Inspect the cached status first so we can surface a
        // useful error pointing the user back to the main Echos app
        // instead of the generic "Could not start recording".
        let permission = AVAudioSession.sharedInstance().recordPermission
        switch permission {
        case .granted:
            beginRecording()
        case .denied:
            NSLog("[EchosKeyboard.AudioRecorder] Mic permission denied")
            completion(.failure(RecorderError.noPermission))
        case .undetermined:
            NSLog("[EchosKeyboard.AudioRecorder] Mic permission undetermined — keyboard can't prompt")
            // Best-effort request anyway. On most devices this returns
            // false immediately without prompting; on a few host apps it
            // does prompt. Either way the result drives the next step.
            AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
                DispatchQueue.main.async {
                    if granted {
                        self?.beginRecording()
                    } else {
                        completion(.failure(RecorderError.permissionUndetermined))
                    }
                }
            }
        @unknown default:
            completion(.failure(RecorderError.noPermission))
        }
    }

    /// Stops recording and triggers transcription via completion.
    func stopRecording() {
        meteringTimer?.invalidate()
        meteringTimer = nil
        maxDurationTimer?.invalidate()
        maxDurationTimer = nil

        guard let recorder = audioRecorder else { return }
        let wasRecording = recorder.isRecording
        recorder.stop()

        let url = recorder.url
        audioRecorder = nil

        // Release the audio session so the host app's audio routing returns
        // to normal. `.notifyOthersOnDeactivation` lets any backgrounded
        // audio apps (Music, Podcasts) resume after we're done.
        do {
            try AVAudioSession.sharedInstance().setActive(
                false, options: .notifyOthersOnDeactivation
            )
        } catch {
            NSLog("[EchosKeyboard.AudioRecorder] Session deactivate failed: %@",
                  error.localizedDescription)
        }

        // If `record()` never actually started (real-device extension
        // sandbox rejection), the file is missing or just a WAV header.
        guard wasRecording else {
            NSLog("[EchosKeyboard.AudioRecorder] stopRecording called but recorder was not active")
            completion?(.failure(RecorderError.noAudioRecorded))
            return
        }

        if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
           let size = attrs[.size] as? UInt64, size > 1024 {
            completion?(.success(url))
        } else {
            completion?(.failure(RecorderError.noAudioRecorded))
        }
    }

    private func beginRecording() {
        // `.playAndRecord` + `.measurement` is the combination that
        // actually works inside a keyboard extension on real devices.
        // `.record` is too aggressive — when the host app (Messages,
        // Safari, etc.) already owns the audio session in a playback
        // category, the extension's attempt to take exclusive `.record`
        // throws on real hardware (silently passes on the simulator,
        // which has a more permissive audio session arbitrator).
        // `.measurement` disables AGC and other DSP that can interfere
        // with sherpa-onnx STT. `.allowBluetooth` enables HFP mics so
        // users on AirPods aren't silently muted.
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(
                .playAndRecord,
                mode: .measurement,
                options: [.allowBluetooth]
            )
            // Hint the system to deliver 16 kHz natively. Without this,
            // AVAudioRecorder asks CoreMediaServer to instantiate an
            // AudioConverter to resample from the hardware-native rate
            // (44.1/48 kHz) to our requested 16 kHz; that converter
            // creation fails with status -50 inside the extension
            // sandbox, which is why `record()` returns false on device.
            try session.setPreferredSampleRate(sampleRate)
            try session.setActive(true)
        } catch {
            NSLog("[EchosKeyboard.AudioRecorder] Session setup failed: %@",
                  error.localizedDescription)
            completion?(.failure(RecorderError.setupFailed(error.localizedDescription)))
            return
        }

        let actualSampleRate = session.sampleRate
        NSLog("[EchosKeyboard.AudioRecorder] Session active — actual sampleRate=%.0f preferred=%.0f",
              actualSampleRate, sampleRate)

        // Record to the App Group shared container. Use the session's
        // actual sample rate; if the hardware refused 16 kHz we let
        // AVAudioRecorder write at the hardware rate and the main app
        // resamples on the receiving side via sherpa-onnx's WaveReader.
        let audioURL = IPCClient.audioFileURL()

        // Remove any previous recording so AVAudioRecorder isn't trying
        // to overwrite a locked or partially-flushed file.
        try? FileManager.default.removeItem(at: audioURL)

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: actualSampleRate,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsFloatKey: false,
        ]

        do {
            audioRecorder = try AVAudioRecorder(url: audioURL, settings: settings)
            audioRecorder?.isMeteringEnabled = true
            audioRecorder?.delegate = self
        } catch {
            NSLog("[EchosKeyboard.AudioRecorder] Recorder init failed: %@",
                  error.localizedDescription)
            completion?(.failure(RecorderError.setupFailed(error.localizedDescription)))
            return
        }

        // `prepareToRecord()` surfaces file-system / format problems
        // before `record()` so we can fail loudly instead of letting the
        // silent `record() -> false` path strand the UI.
        guard audioRecorder?.prepareToRecord() == true else {
            NSLog("[EchosKeyboard.AudioRecorder] prepareToRecord returned false")
            audioRecorder = nil
            completion?(.failure(RecorderError.recordFailed("prepareToRecord failed")))
            return
        }

        guard audioRecorder?.record() == true else {
            NSLog("[EchosKeyboard.AudioRecorder] record() returned false — extension sandbox rejected mic")
            audioRecorder = nil
            completion?(.failure(RecorderError.recordFailed(
                "Extension could not start microphone. Try toggling Allow Full Access off and on."
            )))
            return
        }

        NSLog("[EchosKeyboard.AudioRecorder] Recording started: %@", audioURL.path)

        // 30s max-duration backstop. Whisper's context window is 30s, so
        // anything longer wouldn't transcribe in one pass anyway, and the
        // backstop protects against a stuck UI swallowing the mic.
        maxDurationTimer = Timer.scheduledTimer(
            withTimeInterval: maxDurationSeconds, repeats: false
        ) { [weak self] _ in
            self?.stopRecording()
        }

        startLevelMetering()
    }

    /// Drives the visualizer at 30 Hz off the recorder's meter. Recording
    /// itself runs until the user taps stop or the max-duration backstop
    /// fires — no silence-based auto-stop.
    private func startLevelMetering() {
        let checkInterval: TimeInterval = 1.0 / 30.0

        meteringTimer = Timer.scheduledTimer(withTimeInterval: checkInterval, repeats: true) { [weak self] _ in
            guard let self = self, let recorder = self.audioRecorder, recorder.isRecording else { return }

            recorder.updateMeters()
            let power = recorder.averagePower(forChannel: 0)

            // Normalise to 0…1 for the visualizer. Map [levelMinDb,
            // levelMaxDb] linearly; clamp outside the range.
            let span = self.levelMaxDb - self.levelMinDb
            let normalized = max(0, min(1, (power - self.levelMinDb) / span))
            self.onAudioLevelChange?(normalized)
        }
    }
}

// MARK: - AVAudioRecorderDelegate

extension AudioRecorder: AVAudioRecorderDelegate {
    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            NSLog("[EchosKeyboard.AudioRecorder] Delegate: finished unsuccessfully")
            completion?(.failure(RecorderError.noAudioRecorded))
        }
    }

    func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: Error?) {
        NSLog("[EchosKeyboard.AudioRecorder] Encode error: %@",
              error?.localizedDescription ?? "unknown")
    }
}
