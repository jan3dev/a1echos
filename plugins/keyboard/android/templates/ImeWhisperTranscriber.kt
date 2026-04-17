package com.a1lab.echos.ime

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.concurrent.thread

/**
 * Records audio and transcribes it using Whisper via JNI.
 *
 * Since the Android IME runs in the same process as the main app,
 * the whisper.rn native library (librnwhisper*.so) is already loaded.
 * This class calls the JNI methods directly without needing React Native.
 *
 * Flow: start recording → accumulate PCM → stop → transcribe → callback with text
 */
class ImeWhisperTranscriber(private val context: Context) {

    companion object {
        private const val TAG = "ImeWhisperTranscriber"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
        private const val MAX_RECORDING_SECONDS = 30
        private const val SILENCE_THRESHOLD_RMS = 500
        private const val SILENCE_DURATION_MS = 1500
    }

    private val isRecording = AtomicBoolean(false)
    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private val pcmBuffer = mutableListOf<Short>()

    private var onResult: ((String) -> Unit)? = null
    private var onError: ((String) -> Unit)? = null
    private var onTranscribing: (() -> Unit)? = null

    /**
     * Starts recording audio. Calls back with transcribed text when done.
     */
    fun startTranscription(
        onResult: (String) -> Unit,
        onError: (String) -> Unit,
        onTranscribing: () -> Unit,
    ) {
        this.onResult = onResult
        this.onError = onError
        this.onTranscribing = onTranscribing

        // Verify model is available
        val modelPath = WhisperModelManager.getModelPath(context)
        if (modelPath == null) {
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
            captureAudio(bufferSize)
        }
    }

    /**
     * Stops recording and begins transcription.
     */
    fun stopRecording() {
        isRecording.set(false)
    }

    /**
     * Cancels any active recording without transcribing.
     */
    fun cancelIfActive() {
        if (isRecording.get()) {
            isRecording.set(false)
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
            pcmBuffer.clear()
        }
    }

    /**
     * Releases all resources.
     */
    fun release() {
        cancelIfActive()
    }

    private fun captureAudio(bufferSize: Int) {
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

                    // Simple energy-based silence detection
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

        // Transcribe the captured audio
        transcribe()
    }

    private fun calculateRMS(buffer: ShortArray, length: Int): Double {
        var sum = 0.0
        for (i in 0 until length) {
            sum += buffer[i].toDouble() * buffer[i].toDouble()
        }
        return Math.sqrt(sum / length)
    }

    private fun transcribe() {
        onTranscribing?.invoke()

        val samples: FloatArray
        synchronized(pcmBuffer) {
            if (pcmBuffer.isEmpty()) {
                onError?.invoke("No audio recorded")
                return
            }
            // Convert Short PCM to Float [-1.0, 1.0] for Whisper
            samples = FloatArray(pcmBuffer.size) { pcmBuffer[it].toFloat() / 32768f }
        }

        try {
            // TODO: Call WhisperContext JNI methods directly
            // This requires linking to the whisper.rn WhisperContext class
            // and calling initContext() + fullWithNewJob() + getTextSegment()
            //
            // For now, this is a placeholder that will be wired up when we
            // integrate with the whisper.rn native code.
            Log.d(TAG, "Transcription placeholder: ${samples.size} samples captured")
            onResult?.invoke("[Transcription will appear here]")
        } catch (e: Exception) {
            Log.e(TAG, "Transcription failed", e)
            onError?.invoke("Transcription failed. Try again.")
        }
    }
}
