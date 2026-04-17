package com.a1lab.echos.ime

import android.content.Context
import androidx.core.content.ContextCompat

/**
 * Provides theme colors for the keyboard, respecting light/dark mode.
 * Colors are loaded from Android resources which use values/ and values-night/ qualifiers.
 */
class KeyTheme(context: Context) {

    private fun color(context: Context, name: String): Int {
        val id = context.resources.getIdentifier(name, "color", context.packageName)
        return if (id != 0) ContextCompat.getColor(context, id) else 0
    }

    val keyboardBackground: Int = color(context, "keyboard_background")
    val keyBackground: Int = color(context, "key_background")
    val keyBackgroundPressed: Int = color(context, "key_background_pressed")
    val keyText: Int = color(context, "key_text")
    val keyTextSecondary: Int = color(context, "key_text_secondary")
    val specialKeyBackground: Int = color(context, "special_key_background")
    val specialKeyBackgroundPressed: Int = color(context, "special_key_background_pressed")
    val micButtonBackground: Int = color(context, "mic_button_background")
    val micButtonRecording: Int = color(context, "mic_button_recording")
    val micButtonIcon: Int = color(context, "mic_button_icon")
    val keyShadow: Int = color(context, "key_shadow")
    val keyPopupBackground: Int = color(context, "key_popup_background")
    val spacebarBackground: Int = color(context, "spacebar_background")
}
