package com.a1lab.echos.ime

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineStream
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig
import com.k2fsa.sherpa.onnx.OfflineWhisperModelConfig
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * Records microphone audio and transcribes it using sherpa-onnx in-process.
 *
 * The IME runs in the same process as the main Echos app, so we can use the
 * `com.k2fsa.sherpa.onnx` JNI wrappers shipped with `react-native-sherpa-onnx`
 * directly — no IPC needed.
 *
 * Flow: start recording → accumulate PCM → stop on user release / max
 * duration → decode → callback with text. There is no silence-based
 * auto-stop; the user owns the start/stop boundaries.
 */
class ImeSherpaTranscriber(private val context: Context) {

    companion object {
        private const val TAG = "ImeSherpaTranscriber"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val MAX_RECORDING_SECONDS = 30
        private const val NUM_THREADS = 2
    }

    private val isRecording = AtomicBoolean(false)
    /// Set when the user dismisses the keyboard mid-capture (vs. a normal
    /// stop). The capture thread checks this before transcribing so a cancel
    /// doesn't surface a spurious "No audio recorded" error on the empty buffer.
    private val isCancelled = AtomicBoolean(false)
    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    // Pre-allocated primitive buffer sized for the full recording cap. A
    // boxed ArrayList<Short> would allocate ~24 bytes per sample × 30s ×
    // 16 kHz ≈ 11 MB of GC garbage inside the IME process; a primitive
    // ShortArray is one upfront allocation and zero per-sample objects.
    private val pcmBuffer = ShortArray(MAX_RECORDING_SECONDS * SAMPLE_RATE)
    private val pcmBufferLock = Object()
    @Volatile private var pcmBufferLength: Int = 0

    @Volatile private var recognizer: OfflineRecognizer? = null
    @Volatile private var loadedSignature: String? = null

    private var onResult: ((String) -> Unit)? = null
    private var onError: ((String) -> Unit)? = null
    private var onTranscribing: (() -> Unit)? = null
    private var onAudioLevel: ((Double) -> Unit)? = null

    fun startTranscription(
        onResult: (String) -> Unit,
        onError: (String) -> Unit,
        onTranscribing: () -> Unit,
        onAudioLevel: ((Double) -> Unit)? = null,
    ) {
        this.onResult = onResult
        this.onError = onError
        this.onTranscribing = onTranscribing
        this.onAudioLevel = onAudioLevel

        val files = SherpaModelManager.getModelFiles(context)
        if (files == null) {
            onError("Open Echos app to enable voice input")
            return
        }

        val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
        if (bufferSize == AudioRecord.ERROR || bufferSize == AudioRecord.ERROR_BAD_VALUE) {
            onError("Audio recording not available")
            return
        }

        try {
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize * 2,
            )
        } catch (e: SecurityException) {
            onError("Microphone permission required")
            return
        }

        if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
            onError("Could not initialize microphone")
            audioRecord?.release()
            audioRecord = null
            return
        }

        isCancelled.set(false)
        isRecording.set(true)
        synchronized(pcmBufferLock) { pcmBufferLength = 0 }
        audioRecord?.startRecording()

        recordingThread = thread(name = "EchosIME-AudioCapture") {
            captureAudio(bufferSize, files)
        }
    }

    fun stopRecording() {
        isRecording.set(false)
    }

    fun cancelIfActive() {
        if (isRecording.get()) {
            isCancelled.set(true)
            isRecording.set(false)
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
            synchronized(pcmBufferLock) { pcmBufferLength = 0 }
        }
    }

    /** Releases recording buffers and tears down the recognizer. */
    fun release() {
        cancelIfActive()
        recognizer?.release()
        recognizer = null
        loadedSignature = null
    }

    private fun captureAudio(bufferSize: Int, files: SherpaModelFiles) {
        val buffer = ShortArray(bufferSize / 2)
        // Hard cap matches Whisper's 30s context window and keeps the
        // pre-allocated `pcmBuffer` from overflowing. The user controls
        // start/stop; this loop only exits early when they release or
        // the buffer hits its cap.
        val maxSamples = MAX_RECORDING_SECONDS * SAMPLE_RATE

        try {
            while (isRecording.get() && pcmBufferLength < maxSamples) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: break
                if (read > 0) {
                    synchronized(pcmBufferLock) {
                        val remaining = pcmBuffer.size - pcmBufferLength
                        val toCopy = if (read <= remaining) read else remaining
                        if (toCopy > 0) {
                            System.arraycopy(buffer, 0, pcmBuffer, pcmBufferLength, toCopy)
                            pcmBufferLength += toCopy
                        }
                    }

                    // Push a normalised 0…1 level to the visualizer. ~3000
                    // RMS is roughly normal-volume speech in 16-bit PCM —
                    // tuned to give the wave expressive motion without
                    // pegging at full amplitude on conversational input.
                    val rms = calculateRMS(buffer, read)
                    onAudioLevel?.invoke((rms / 3000.0).coerceIn(0.0, 1.0))
                }
            }
            // Reaching the buffer cap counts as a user-initiated stop —
            // flush the recorder so the next branch transcribes.
            if (pcmBufferLength >= maxSamples) {
                isRecording.set(false)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error during audio capture", e)
        }

        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null

        // A cancel (keyboard dismissed) zeroes the buffer; don't transcribe it
        // — that would surface a bogus "No audio recorded" error to the user.
        if (!isCancelled.get()) {
            transcribe(files)
        }
    }

    private fun calculateRMS(buffer: ShortArray, length: Int): Double {
        if (length <= 0) return 0.0
        var sum = 0.0
        for (i in 0 until length) {
            sum += buffer[i].toDouble() * buffer[i].toDouble()
        }
        return Math.sqrt(sum / length)
    }

    private fun transcribe(files: SherpaModelFiles) {
        onTranscribing?.invoke()

        val samples: FloatArray
        synchronized(pcmBufferLock) {
            val length = pcmBufferLength
            if (length == 0) {
                onError?.invoke("No audio recorded")
                return
            }
            samples = FloatArray(length) { pcmBuffer[it].toFloat() / 32768f }
            pcmBufferLength = 0
        }

        val rec = try {
            ensureRecognizer(files)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load recognizer", e)
            onError?.invoke("Failed to load voice model")
            return
        }

        var stream: OfflineStream? = null
        try {
            stream = rec.createStream()
            stream.acceptWaveform(samples, SAMPLE_RATE)
            rec.decode(stream)
            val result = rec.getResult(stream)
            val text = result.text?.trim().orEmpty()
            if (text.isEmpty()) {
                onError?.invoke("Transcription returned empty result")
            } else {
                onResult?.invoke(text)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Transcription failed", e)
            onError?.invoke("Transcription failed. Try again.")
        } finally {
            stream?.release()
        }
    }

    /**
     * Returns a recognizer configured for [files], reusing an existing one
     * when the config hasn't changed.
     */
    @Synchronized
    private fun ensureRecognizer(files: SherpaModelFiles): OfflineRecognizer {
        val signature = files.signature()
        val existing = recognizer
        if (existing != null && signature == loadedSignature) {
            return existing
        }

        existing?.release()
        recognizer = null
        loadedSignature = null

        val featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80)
        val modelConfig = when (files.modelType) {
            "whisper" -> OfflineModelConfig(
                whisper = OfflineWhisperModelConfig(
                    encoder = files.encoderPath(),
                    decoder = files.decoderPath(),
                    language = files.language ?: "en",
                    task = "transcribe",
                ),
                tokens = files.tokensPath(),
                modelType = "whisper",
                numThreads = NUM_THREADS,
            )
            "nemo_transducer" -> OfflineModelConfig(
                transducer = OfflineTransducerModelConfig(
                    encoder = files.encoderPath(),
                    decoder = files.decoderPath(),
                    joiner = files.joinerPath() ?: throw IllegalStateException(
                        "Transducer model requires a joiner file"
                    ),
                ),
                tokens = files.tokensPath(),
                modelType = "nemo_transducer",
                numThreads = NUM_THREADS,
            )
            else -> throw IllegalStateException(
                "Unsupported sherpa-onnx model type: ${files.modelType}"
            )
        }
        val config = OfflineRecognizerConfig(featConfig = featConfig, modelConfig = modelConfig)

        val newRecognizer = OfflineRecognizer(config = config)
        recognizer = newRecognizer
        loadedSignature = signature
        return newRecognizer
    }

    private fun SherpaModelFiles.signature(): String =
        "$modelType|$modelDir|$encoder|$decoder|$tokens|${joiner.orEmpty()}|${language.orEmpty()}"
}
