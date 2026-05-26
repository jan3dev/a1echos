package com.a1lab.echos.ime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.widget.TextView

/**
 * TextView subclass used for cells in the emoji picker grid and search
 * results. When [showToneIndicator] is true, draws a small triangle in
 * the bottom-right corner — the "this glyph has variants" affordance
 * Gboard surfaces on skin-toneable emojis so users discover the long-
 * press gesture without having to guess.
 *
 * The triangle is sized and colored to be visible but quiet: ~5dp, a
 * neutral grey supplied via [setIndicatorColor]. Drawing happens after
 * the glyph is rendered so the indicator sits over the lower-right of
 * the emoji rather than being clipped by the background.
 */
class EmojiCellTextView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : TextView(context, attrs) {

    var showToneIndicator: Boolean = false
        set(value) {
            if (field != value) {
                field = value
                invalidate()
            }
        }

    private val indicatorPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFF888888.toInt()
        style = Paint.Style.FILL
    }
    private val indicatorPath = Path()

    fun setIndicatorColor(color: Int) {
        if (indicatorPaint.color != color) {
            indicatorPaint.color = color
            invalidate()
        }
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (!showToneIndicator) return
        val density = resources.displayMetrics.density
        val pad = 3f * density
        val size = 5f * density
        val w = width.toFloat()
        val h = height.toFloat()
        indicatorPath.reset()
        // Right-angle triangle in the bottom-right corner: top-right
        // along the right edge, bottom-left along the bottom edge.
        indicatorPath.moveTo(w - pad, h - pad - size)
        indicatorPath.lineTo(w - pad, h - pad)
        indicatorPath.lineTo(w - pad - size, h - pad)
        indicatorPath.close()
        canvas.drawPath(indicatorPath, indicatorPaint)
    }
}
