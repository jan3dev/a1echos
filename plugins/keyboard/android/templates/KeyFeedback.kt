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
 * Provides haptic and audio feedback for key presses,
 * respecting system settings for keyboard sounds and vibration.
 */
object KeyFeedback {

    private const val VIBRATION_DURATION_MS = 5L

    /**
     * Performs haptic feedback for a key press if system settings allow it.
     */
    fun performKeyHaptic(view: View) {
        view.performHapticFeedback(
            HapticFeedbackConstants.KEYBOARD_TAP,
            HapticFeedbackConstants.FLAG_IGNORE_GLOBAL_SETTING,
        )
    }

    /**
     * Plays the system key click sound if enabled in settings.
     */
    fun performKeySound(context: Context) {
        val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        audioManager?.playSoundEffect(AudioManager.FX_KEYPRESS_STANDARD, -1f)
    }

    /**
     * Performs a stronger haptic for special actions (mic press, delete long-press).
     */
    fun performSpecialHaptic(context: Context) {
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
