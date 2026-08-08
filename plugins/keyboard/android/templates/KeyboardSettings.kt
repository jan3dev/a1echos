package com.a1lab.echos.ime

import android.content.Context
import android.util.Log
import java.io.File
import org.json.JSONObject

/**
 * Reads the keyboard's user-tunable settings from a small JSON file the main
 * app writes into its files directory. The IME runs in the same process as the
 * main app, so it reads the same `<filesDir>/keyboard-settings.json` (which JS
 * writes via `expo-file-system`'s `Paths.document`) — the same channel
 * [SherpaModelManager] uses for the model descriptor.
 *
 * Cross-process `SharedPreferences` is unreliable (MODE_MULTI_PROCESS is
 * deprecated/unsupported), hence the JSON-file approach. Everything defaults to
 * the conservative "suggest" behaviour, so a missing / unparseable file never
 * enables a surprising edit.
 */
object KeyboardSettings {

    private const val TAG = "KeyboardSettings"
    /** Kept in sync with the writer in writeKeyboardSettings.ts. */
    private const val FILENAME = "keyboard-settings.json"

    /** [autocorrect]: when true (default), the engine's confident correction
     *  auto-applies on a separator and the next backspace reverts it (false =
     *  tap-only). [hapticFeedback]: when true (default), key presses vibrate.
     *  [keySound]: when true (default), key presses play the system click.
     *  [contextAwareAutocorrect]: when true (default OFF while the
     *  placeholder model ships), the neural reranker blends sentence-context
     *  evidence into autocorrect ranking. [lmStrength]: how strongly LM
     *  evidence weighs against the classical score (0…2). */
    data class Settings(
        val autocorrect: Boolean = true,
        val hapticFeedback: Boolean = true,
        val keySound: Boolean = true,
        val contextAwareAutocorrect: Boolean = false,
        val lmStrength: Float = 1.0f,
    )

    @Volatile
    private var cached: Settings = Settings()
    @Volatile
    private var cachedMtime: Long = 0L

    /** Returns the current settings, re-reading only when the file's mtime
     *  advanced since the last parse. Never throws — defaults on any error. */
    fun load(context: Context): Settings {
        val file = File(context.applicationContext.filesDir, FILENAME)
        if (!file.exists()) {
            cached = Settings()
            cachedMtime = 0L
            return cached
        }
        val mtime = file.lastModified()
        if (mtime == cachedMtime) return cached
        return try {
            val json = JSONObject(file.readText(Charsets.UTF_8))
            val settings = Settings(
                autocorrect = json.optBoolean("autocorrect", true),
                hapticFeedback = json.optBoolean("hapticFeedback", true),
                keySound = json.optBoolean("keySound", true),
                contextAwareAutocorrect =
                    json.optBoolean("contextAwareAutocorrect", false),
                lmStrength = json.optDouble("lmStrength", 1.0)
                    .toFloat().coerceIn(0f, 2f),
            )
            cached = settings
            cachedMtime = mtime
            settings
        } catch (e: Exception) {
            Log.w(TAG, "Failed to parse keyboard settings", e)
            Settings()
        }
    }
}
