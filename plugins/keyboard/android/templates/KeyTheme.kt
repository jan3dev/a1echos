package com.a1lab.echos.ime

import android.content.Context
import android.graphics.Color
import android.os.Build
import android.util.TypedValue
import androidx.core.content.ContextCompat

/**
 * Keyboard color tokens. Prefers system theme attributes (and, on Android 12+,
 * Material You dynamic-color tokens) so the keyboard visually tracks the
 * device's system theme. Falls back to the Echos brand colors declared in
 * `keyboard_colors.xml` when the attrs aren't available.
 */
class KeyTheme(context: Context) {

    private val isNight: Boolean =
        (context.resources.configuration.uiMode and
            android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
            android.content.res.Configuration.UI_MODE_NIGHT_YES

    val keyboardBackground: Int = resolve(
        context,
        dynamicNight = android.R.color.system_neutral1_900,
        dynamicDay = android.R.color.system_neutral1_50,
        themeAttr = android.R.attr.colorBackground,
        fallbackRes = "keyboard_background",
    )

    val keyBackground: Int = resolve(
        context,
        dynamicNight = android.R.color.system_neutral2_800,
        dynamicDay = android.R.color.system_neutral1_10,
        themeAttr = null,
        fallbackRes = "key_background",
    )

    val keyBackgroundPressed: Int = resolve(
        context,
        dynamicNight = android.R.color.system_neutral2_700,
        dynamicDay = android.R.color.system_neutral2_100,
        themeAttr = android.R.attr.colorControlHighlight,
        fallbackRes = "key_background_pressed",
    )

    val keyText: Int = resolve(
        context,
        dynamicNight = android.R.color.system_neutral1_50,
        dynamicDay = android.R.color.system_neutral1_900,
        themeAttr = android.R.attr.textColorPrimary,
        fallbackRes = "key_text",
    )

    val keyTextSecondary: Int = resolve(
        context,
        dynamicNight = android.R.color.system_neutral2_300,
        dynamicDay = android.R.color.system_neutral2_600,
        themeAttr = android.R.attr.textColorSecondary,
        fallbackRes = "key_text_secondary",
    )

    val specialKeyBackground: Int = resolve(
        context,
        dynamicNight = android.R.color.system_neutral2_700,
        dynamicDay = android.R.color.system_neutral2_100,
        themeAttr = null,
        fallbackRes = "special_key_background",
    )

    val specialKeyBackgroundPressed: Int = resolve(
        context,
        dynamicNight = android.R.color.system_neutral2_600,
        dynamicDay = android.R.color.system_neutral2_200,
        themeAttr = null,
        fallbackRes = "special_key_background_pressed",
    )

    // Brand accents are kept fixed so the mic / return buttons still read as
    // "Echos" regardless of the system theme.
    val micButtonBackground: Int = colorRes(context, "mic_button_background")
    val micButtonRecording: Int = colorRes(context, "mic_button_recording")
    val micButtonIcon: Int = colorRes(context, "mic_button_icon")
    val keyShadow: Int = colorRes(context, "key_shadow")
    val keyPopupBackground: Int = colorRes(context, "key_popup_background")
    val spacebarBackground: Int = keyBackground

    // --- helpers ---

    /**
     * Resolves a color in this priority order:
     *   1. Android 12+ Material You dynamic-color token
     *   2. Theme attribute on the current context (e.g. `colorBackground`)
     *   3. App-declared `keyboard_colors.xml` fallback
     */
    private fun resolve(
        context: Context,
        dynamicNight: Int,
        dynamicDay: Int,
        themeAttr: Int?,
        fallbackRes: String,
    ): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val token = if (isNight) dynamicNight else dynamicDay
            val resolved = runCatching { ContextCompat.getColor(context, token) }.getOrNull()
            if (resolved != null && resolved != Color.TRANSPARENT) return resolved
        }
        if (themeAttr != null) {
            val value = TypedValue()
            if (context.theme.resolveAttribute(themeAttr, value, true)) {
                if (value.resourceId != 0) {
                    return ContextCompat.getColor(context, value.resourceId)
                }
                if (value.type >= TypedValue.TYPE_FIRST_COLOR_INT &&
                    value.type <= TypedValue.TYPE_LAST_COLOR_INT) {
                    return value.data
                }
            }
        }
        return colorRes(context, fallbackRes)
    }

    private fun colorRes(context: Context, name: String): Int {
        val id = context.resources.getIdentifier(name, "color", context.packageName)
        return if (id != 0) ContextCompat.getColor(context, id) else Color.TRANSPARENT
    }
}
