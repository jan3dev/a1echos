package com.a1lab.echos.ime

import android.content.Context
import android.media.AudioManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.view.HapticFeedbackConstants
import android.view.View

/**
 * Single gate for key-press haptic and sound feedback. Haptics honor the
 * user's `hapticFeedback` setting plus the system touch-feedback preference;
 * sounds honor the `keySound` setting plus the system "sound on keypress"
 * preference (and play on the system stream, so silent mode mutes them).
 */
object KeyFeedback {

    private const val VIBRATION_DURATION_MS = 5L

    /** Haptic + key-click for a committed key press. Loads the settings
     *  snapshot once and shares it, so a single press doesn't re-read the
     *  settings file for the haptic and again for the sound. */
    fun keyPress(view: View, effect: Int = AudioManager.FX_KEYPRESS_STANDARD) {
        val settings = KeyboardSettings.load(view.context)
        performKeyHaptic(view, settings)
        performKeySound(view.context, effect, settings)
    }

    /** Light haptic for a key press, if the user's setting allows it. */
    fun performKeyHaptic(
        view: View,
        settings: KeyboardSettings.Settings = KeyboardSettings.load(view.context),
    ) {
        if (!settings.hapticFeedback) return
        view.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
    }

    /** Haptic for a long-press action (e.g. emoji variants popup). */
    fun performLongPressHaptic(view: View) {
        if (!KeyboardSettings.load(view.context).hapticFeedback) return
        view.performHapticFeedback(HapticFeedbackConstants.LONG_PRESS)
    }

    /** System key-click, if the user's setting and system sounds allow it. */
    fun performKeySound(
        context: Context,
        effect: Int = AudioManager.FX_KEYPRESS_STANDARD,
        settings: KeyboardSettings.Settings = KeyboardSettings.load(context),
    ) {
        if (!settings.keySound) return
        if (!systemSoundEffectsEnabled(context)) return
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        audioManager?.playSoundEffect(effect, -1f)
    }

    /**
     * Performs a stronger haptic for special actions (mic press, delete long-press).
     */
    fun performSpecialHaptic(context: Context) {
        if (!KeyboardSettings.load(context).hapticFeedback) return
        val vibrator = getVibrator(context) ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(
                VibrationEffect.createOneShot(
                    VIBRATION_DURATION_MS * 2,
                    VibrationEffect.DEFAULT_AMPLITUDE,
                )
            )
        }
    }

    private fun systemSoundEffectsEnabled(context: Context): Boolean =
        Settings.System.getInt(context.contentResolver, Settings.System.SOUND_EFFECTS_ENABLED, 1) == 1

    private fun getVibrator(context: Context): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }
}
