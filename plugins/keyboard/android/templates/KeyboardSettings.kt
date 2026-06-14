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

    /** [autocorrect]: when true, the top spelling guess auto-applies on space
     *  and the next backspace reverts it (false = tap-only). [hapticFeedback]:
     *  when true, key presses vibrate (false = silent). Both default off. */
    data class Settings(
        val autocorrect: Boolean = false,
        val hapticFeedback: Boolean = false,
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
                autocorrect = json.optBoolean("autocorrect", false),
                hapticFeedback = json.optBoolean("hapticFeedback", false),
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
