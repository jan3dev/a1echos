package com.a1lab.echos.ime

import android.content.Context
import android.util.Log
import java.io.File
import java.util.concurrent.locks.ReentrantLock

/**
 * Singleton managing the Whisper model path and native context for the IME.
 *
 * The model file is downloaded by the main Echos app (via expo-asset) and its
 * path is saved to SharedPreferences. The IME reads this path to initialize
 * Whisper without depending on the React Native runtime.
 */
object WhisperModelManager {

    private const val TAG = "WhisperModelManager"
    private const val PREFS_NAME = "echos_ime"
    private const val KEY_MODEL_PATH = "whisper_model_path"
    private const val EXPECTED_MODEL_SIZE_MIN = 70_000_000L // ~70MB for tiny model

    private val lock = ReentrantLock()
    private var modelPath: String? = null

    /**
     * Resolves the Whisper model file path.
     * 1. Check SharedPreferences for path saved by the main app
     * 2. Fallback: scan Expo asset cache for matching .bin file
     * @return absolute path to the model file, or null if not found
     */
    fun getModelPath(context: Context): String? {
        lock.lock()
        try {
            // Return cached path if still valid
            modelPath?.let { path ->
                if (File(path).exists()) return path
                modelPath = null
            }

            // Check SharedPreferences
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val savedPath = prefs.getString(KEY_MODEL_PATH, null)
            if (savedPath != null && File(savedPath).exists()) {
                modelPath = savedPath
                return savedPath
            }

            // Fallback: scan Expo asset cache
            val found = scanExpoAssetCache(context)
            if (found != null) {
                modelPath = found
                // Save for future use
                prefs.edit().putString(KEY_MODEL_PATH, found).apply()
                return found
            }

            Log.w(TAG, "Whisper model not found. User needs to open Echos app first.")
            return null
        } finally {
            lock.unlock()
        }
    }

    /**
     * Scans the Expo asset cache directory for a .bin file that matches
     * the expected Whisper model size.
     */
    private fun scanExpoAssetCache(context: Context): String? {
        val cacheDir = context.cacheDir
        if (!cacheDir.exists()) return null

        // Expo stores assets with ExponentAsset- prefix or in subdirectories
        val candidates = cacheDir.walkTopDown()
            .filter { it.isFile && it.extension == "bin" && it.length() > EXPECTED_MODEL_SIZE_MIN }
            .toList()

        return candidates.firstOrNull()?.absolutePath
    }

    /**
     * Called by the main app to save the model path after download.
     */
    fun saveModelPath(context: Context, path: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_MODEL_PATH, path).apply()
        lock.lock()
        try {
            modelPath = path
        } finally {
            lock.unlock()
        }
    }
}
