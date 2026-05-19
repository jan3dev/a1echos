package com.a1lab.echos.ime

import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.StateListDrawable
import android.util.TypedValue
import android.view.View

internal fun View.dpPx(value: Float): Float =
    TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        value,
        resources.displayMetrics,
    )

internal fun View.pressableBackground(
    pressedColor: Int,
    cornerDp: Float = 6f,
): StateListDrawable {
    val cornerPx = dpPx(cornerDp)
    val pressed = GradientDrawable().apply {
        cornerRadius = cornerPx
        setColor(pressedColor)
    }
    val idle = GradientDrawable().apply {
        cornerRadius = cornerPx
        setColor(Color.TRANSPARENT)
    }
    return StateListDrawable().apply {
        addState(intArrayOf(android.R.attr.state_pressed), pressed)
        addState(intArrayOf(), idle)
    }
}
