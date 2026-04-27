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
 * Flow: start recording → accumulate PCM → stop on silence/release → decode →
 * callback with text.
 */
class ImeSherpaTranscriber(private val context: Context) {

    companion object {
        private const val TAG = "ImeSherpaTranscriber"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val MAX_RECORDING_SECONDS = 30
        private const val SILENCE_THRESHOLD_RMS = 500
        private const val SILENCE_DURATION_MS = 1500
        private const val NUM_THREADS = 2
    }

    private val isRecording = AtomicBoolean(false)
    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private val pcmBuffer = mutableListOf<Short>()

    @Volatile private var recognizer: OfflineRecognizer? = null
    @Volatile private var loadedSignature: String? = null

    private var onResult: ((String) -> Unit)? = null
    private var onError: ((String) -> Unit)? = null
    private var onTranscribing: (() -> Unit)? = null

    fun startTranscription(
        onResult: (String) -> Unit,
        onError: (String) -> Unit,
        onTranscribing: () -> Unit,
    ) {
        this.onResult = onResult
        this.onError = onError
        this.onTranscribing = onTranscribing

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

        isRecording.set(true)
        pcmBuffer.clear()
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
            isRecording.set(false)
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
            pcmBuffer.clear()
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
        var silentFrames = 0
        val silentFrameThreshold = (SILENCE_DURATION_MS * SAMPLE_RATE) / (1000 * buffer.size)
        val maxSamples = MAX_RECORDING_SECONDS * SAMPLE_RATE

        try {
            while (isRecording.get() && pcmBuffer.size < maxSamples) {
                val read = audioRecord?.read(buffer, 0, buffer.size) ?: break
                if (read > 0) {
                    synchronized(pcmBuffer) {
                        for (i in 0 until read) {
                            pcmBuffer.add(buffer[i])
                        }
                    }

                    val rms = calculateRMS(buffer, read)
                    if (rms < SILENCE_THRESHOLD_RMS) {
                        silentFrames++
                        if (silentFrames >= silentFrameThreshold) {
                            isRecording.set(false)
                        }
                    } else {
                        silentFrames = 0
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error during audio capture", e)
        }

        audioRecord?.stop()
        audioRecord?.release()
        audioRecord = null

        transcribe(files)
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
        synchronized(pcmBuffer) {
            if (pcmBuffer.isEmpty()) {
                onError?.invoke("No audio recorded")
                return
            }
            samples = FloatArray(pcmBuffer.size) { pcmBuffer[it].toFloat() / 32768f }
            pcmBuffer.clear()
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
