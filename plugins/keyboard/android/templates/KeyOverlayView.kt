package com.a1lab.echos.ime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.util.TypedValue
import android.view.MotionEvent
import android.view.View

/**
 * Transparent overlay view that sits on top of the IME container and renders
 * the typewriter key-preview balloon and the long-press accent variants
 * popup. Living in a sibling view (instead of inside `EchosKeyboardView`)
 * lets the popups draw outside the keyboard's row area — specifically into
 * the top-bar's vertical band — so the balloon for a top-row key still
 * appears *above* the key.
 *
 * Touch events fall through to the keyboard view underneath (this view is
 * never clickable and never consumes ACTION_DOWN).
 */
class KeyOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private val theme = KeyTheme(context)
    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT
    }

    private data class VariantsState(
        val variants: List<String>,
        val backgroundRect: RectF,
        val cellRects: List<RectF>,
        var selectedIndex: Int,
    )

    private data class PreviewState(
        val char: String,
        val balloonRect: RectF,
    )

    private var variantsState: VariantsState? = null
    private var previewState: PreviewState? = null
    /// Vertical offset in this view's coordinate space at which the keyboard
    /// view begins (i.e. the top-bar's height). Set by the keyboard view via
    /// [setKeyboardOffsetY] before any popup is shown.
    private var keyboardOffsetY: Float = 0f

    init {
        // Never intercept; touches go straight to the keyboard view sitting
        // behind us.
        isClickable = false
        isFocusable = false
        setWillNotDraw(false)
    }

    fun setKeyboardOffsetY(y: Float) {
        keyboardOffsetY = y
    }

    fun showPreview(char: String, keyRectInKeyboard: RectF) {
        val key = translate(keyRectInKeyboard)
        val balloonW = key.width() * 1.1f
        val balloonH = key.height() * 1.1f
        val left = (key.centerX() - balloonW / 2).coerceIn(0f, width - balloonW)
        // Always above the key now that the overlay can extend into the
        // top-bar's band. If we'd still go off-screen (very tall key in a
        // very short overlay) clamp to the top of the view.
        val top = (key.top - balloonH - dpPx(2f)).coerceAtLeast(0f)
        previewState = PreviewState(
            char = char,
            balloonRect = RectF(left, top, left + balloonW, top + balloonH),
        )
        invalidate()
    }

    fun showVariants(keyRectInKeyboard: RectF, variants: List<String>) {
        val key = translate(keyRectInKeyboard)
        val cellW = dpPx(40f)
        val cellH = dpPx(44f)
        val pad = dpPx(6f)
        val totalW = variants.size * cellW + 2 * pad
        val totalH = cellH + 2 * pad

        var bgLeft = key.centerX() - totalW / 2
        if (bgLeft < 0f) bgLeft = 0f
        if (bgLeft + totalW > width) bgLeft = width - totalW

        // Always above the key — clamp to the top of the overlay if there
        // somehow still isn't room (tiny screen / oversized variant set).
        val bgTop = (key.top - totalH - dpPx(4f)).coerceAtLeast(0f)

        val cellRects = (0 until variants.size).map { i ->
            val cellLeft = bgLeft + pad + i * cellW
            RectF(cellLeft, bgTop + pad, cellLeft + cellW, bgTop + pad + cellH)
        }
        // Hide the typewriter balloon as soon as the variants take over —
        // matches Gboard.
        previewState = null
        variantsState = VariantsState(
            variants = variants,
            backgroundRect = RectF(bgLeft, bgTop, bgLeft + totalW, bgTop + totalH),
            cellRects = cellRects,
            // Default selection is index 0 — for top-row letters the first
            // entry is the paired number, so a long-press + immediate
            // release types the number (Gboard convention).
            selectedIndex = 0,
        )
        invalidate()
    }

    /** Returns true while a variants popup is up. */
    fun hasVariants(): Boolean = variantsState != null

    /** Updates the highlighted variant from a touch in keyboard-view coords. */
    fun updateVariantsHighlight(xInKeyboard: Float, yInKeyboard: Float) {
        val state = variantsState ?: return
        val x = xInKeyboard
        // y is unused — once the popup is up we only track horizontal drag,
        // matching Gboard.
        if (x < state.backgroundRect.left || x > state.backgroundRect.right) return
        for ((i, cellRect) in state.cellRects.withIndex()) {
            if (x >= cellRect.left && x <= cellRect.right) {
                if (i != state.selectedIndex) {
                    state.selectedIndex = i
                    invalidate()
                }
                return
            }
        }
    }

    /** Returns the currently highlighted variant, or null if no popup is up. */
    fun selectedVariant(): String? {
        val state = variantsState ?: return null
        return state.variants.getOrNull(state.selectedIndex)
    }

    fun clearPreview() {
        if (previewState != null) {
            previewState = null
            invalidate()
        }
    }

    fun clearVariants() {
        if (variantsState != null) {
            variantsState = null
            invalidate()
        }
    }

    fun clearAll() {
        if (previewState != null || variantsState != null) {
            previewState = null
            variantsState = null
            invalidate()
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean = false

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        // Variants popup wins over the typewriter preview — Gboard does the
        // same: as soon as the long-press fires, the preview balloon is
        // replaced by the variants strip.
        val variants = variantsState
        if (variants != null) {
            drawVariants(canvas, variants)
        } else {
            previewState?.let { drawPreview(canvas, it) }
        }
    }

    private fun drawVariants(canvas: Canvas, state: VariantsState) {
        backgroundPaint.color = theme.specialKeyBackground
        val radius = dpPx(10f)
        canvas.drawRoundRect(state.backgroundRect, radius, radius, backgroundPaint)
        textPaint.textSize = dpPx(22f)
        for ((i, cellRect) in state.cellRects.withIndex()) {
            if (i == state.selectedIndex) {
                backgroundPaint.color = theme.micButtonBackground
                canvas.drawRoundRect(cellRect, dpPx(8f), dpPx(8f), backgroundPaint)
                textPaint.color = theme.micButtonIcon
            } else {
                textPaint.color = theme.keyText
            }
            val baseline = cellRect.centerY() - (textPaint.descent() + textPaint.ascent()) / 2
            canvas.drawText(state.variants[i], cellRect.centerX(), baseline, textPaint)
        }
    }

    private fun drawPreview(canvas: Canvas, state: PreviewState) {
        backgroundPaint.color = theme.keyBackground
        val radius = dpPx(10f)
        canvas.drawRoundRect(state.balloonRect, radius, radius, backgroundPaint)
        textPaint.color = theme.keyText
        textPaint.textSize = state.balloonRect.height() * 0.55f
        val baseline = state.balloonRect.centerY() -
            (textPaint.descent() + textPaint.ascent()) / 2
        canvas.drawText(state.char, state.balloonRect.centerX(), baseline, textPaint)
    }

    /** Translate a rect from keyboard-view coords into overlay coords. */
    private fun translate(rectInKeyboard: RectF): RectF =
        RectF(
            rectInKeyboard.left,
            rectInKeyboard.top + keyboardOffsetY,
            rectInKeyboard.right,
            rectInKeyboard.bottom + keyboardOffsetY,
        )

    private fun dpPx(value: Float): Float =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            resources.displayMetrics,
        )
}
