import AVFoundation
import Foundation

/// Records audio in the keyboard extension and saves it as a WAV file
/// in the App Group shared container for the main app to transcribe.
class AudioRecorder: NSObject {

    private var audioRecorder: AVAudioRecorder?
    private var completion: ((Result<URL, Error>) -> Void)?
    private var silenceTimer: Timer?
    private var maxDurationTimer: Timer?

    private let sampleRate: Double = 16000
    private let maxDurationSeconds: TimeInterval = 30
    private let silenceTimeoutSeconds: TimeInterval = 1.5
    private let silenceThreshold: Float = -40.0 // dB

    enum RecorderError: LocalizedError {
        case noPermission
        case setupFailed
        case noAudioRecorded

        var errorDescription: String? {
            switch self {
            case .noPermission: return "Microphone permission required. Enable Full Access in Settings."
            case .setupFailed: return "Could not start recording."
            case .noAudioRecorded: return "No audio was recorded."
            }
        }
    }

    /// Starts recording audio. Calls completion with the audio file URL when done.
    func startRecording(completion: @escaping (Result<URL, Error>) -> Void) {
        self.completion = completion

        // Check microphone permission
        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                if granted {
                    self?.beginRecording()
                } else {
                    completion(.failure(RecorderError.noPermission))
                }
            }
        }
    }

    /// Stops recording and triggers transcription via completion.
    func stopRecording() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        maxDurationTimer?.invalidate()
        maxDurationTimer = nil

        guard let recorder = audioRecorder, recorder.isRecording else { return }
        recorder.stop()

        let url = recorder.url
        audioRecorder = nil

        // Verify file has content
        if let attrs = try? FileManager.default.attributesOfItem(atPath: url.path),
           let size = attrs[.size] as? UInt64, size > 1024 {
            completion?(.success(url))
        } else {
            completion?(.failure(RecorderError.noAudioRecorded))
        }
    }

    private func beginRecording() {
        // Configure audio session
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .default)
            try session.setActive(true)
        } catch {
            completion?(.failure(RecorderError.setupFailed))
            return
        }

        // Record to the App Group shared container
        let audioURL = IPCClient.audioFileURL()

        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM),
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: 1,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsFloatKey: false,
        ]

        do {
            audioRecorder = try AVAudioRecorder(url: audioURL, settings: settings)
            audioRecorder?.isMeteringEnabled = true
            audioRecorder?.delegate = self
            audioRecorder?.record()
        } catch {
            completion?(.failure(RecorderError.setupFailed))
            return
        }

        // Start max duration timer
        maxDurationTimer = Timer.scheduledTimer(
            withTimeInterval: maxDurationSeconds, repeats: false
        ) { [weak self] _ in
            self?.stopRecording()
        }

        // Start silence detection
        startSilenceDetection()
    }

    private func startSilenceDetection() {
        var silentDuration: TimeInterval = 0
        let checkInterval: TimeInterval = 0.1

        silenceTimer = Timer.scheduledTimer(withTimeInterval: checkInterval, repeats: true) { [weak self] _ in
            guard let self = self, let recorder = self.audioRecorder, recorder.isRecording else { return }

            recorder.updateMeters()
            let power = recorder.averagePower(forChannel: 0)

            if power < self.silenceThreshold {
                silentDuration += checkInterval
                if silentDuration >= self.silenceTimeoutSeconds {
                    self.stopRecording()
                }
            } else {
                silentDuration = 0
            }
        }
    }
}

// MARK: - AVAudioRecorderDelegate

extension AudioRecorder: AVAudioRecorderDelegate {
    func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
        if !flag {
            completion?(.failure(RecorderError.noAudioRecorded))
        }
    }
}
