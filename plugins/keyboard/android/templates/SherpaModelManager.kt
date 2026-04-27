package com.a1lab.echos.ime

import android.content.Context
import android.util.Log
import java.io.File
import org.json.JSONObject

/**
 * Describes a sherpa-onnx offline ASR model on disk. Mirrors the JSON blob the
 * main app writes into its files directory when its transcription service
 * initializes.
 */
data class SherpaModelFiles(
    val modelDir: String,
    val modelType: String, // "whisper" or "nemo_transducer"
    val encoder: String,
    val decoder: String,
    val tokens: String,
    val joiner: String?,
    val language: String?,
) {
    fun encoderPath(): String = File(modelDir, encoder).absolutePath
    fun decoderPath(): String = File(modelDir, decoder).absolutePath
    fun tokensPath(): String = File(modelDir, tokens).absolutePath
    fun joinerPath(): String? = joiner?.let { File(modelDir, it).absolutePath }

    fun isValid(): Boolean = File(encoderPath()).exists() &&
        File(decoderPath()).exists() &&
        File(tokensPath()).exists() &&
        (modelType != "nemo_transducer" || joinerPath()?.let { File(it).exists() } == true)
}

/**
 * Reads the sherpa-onnx model descriptor written by the main Echos app when
 * its transcription service comes up. The IME runs in the same process as the
 * main app, so it reads the same `<filesDir>/keyboard-sherpa-model.json`
 * (which JS can write via `expo-file-system`'s `Paths.document`).
 */
object SherpaModelManager {

    private const val TAG = "SherpaModelManager"
    /**
     * File name the main app writes inside its Documents directory
     * (expo-file-system `Paths.document`, which resolves to the app's
     * `filesDir` on Android). Kept in sync with
     * SherpaTranscriptionService.ts.
     */
    private const val CONFIG_FILENAME = "keyboard-sherpa-model.json"

    @Volatile
    private var cached: SherpaModelFiles? = null

    /**
     * Returns the active model descriptor, or null if none is configured or
     * the files on disk are missing. Call this before starting a recognizer.
     */
    fun getModelFiles(context: Context): SherpaModelFiles? {
        cached?.let { if (it.isValid()) return it else cached = null }

        val configFile = File(context.applicationContext.filesDir, CONFIG_FILENAME)
        if (!configFile.exists()) {
            Log.w(TAG, "No sherpa model config at ${configFile.absolutePath}. Open Echos app first.")
            return null
        }

        return try {
            val json = JSONObject(configFile.readText(Charsets.UTF_8))
            val files = SherpaModelFiles(
                modelDir = json.getString("modelDir"),
                modelType = json.getString("modelType"),
                encoder = json.getString("encoder"),
                decoder = json.getString("decoder"),
                tokens = json.getString("tokens"),
                joiner = json.optString("joiner").takeIf { it.isNotEmpty() },
                language = json.optString("language").takeIf { it.isNotEmpty() },
            )
            if (!files.isValid()) {
                Log.w(TAG, "Saved model config points to missing files: ${files.modelDir}")
                return null
            }
            cached = files
            files
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse saved model config", e)
            null
        }
    }
}
