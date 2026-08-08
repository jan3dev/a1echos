package com.a1lab.echos.ime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.util.AttributeSet
import android.util.TypedValue
import android.view.MotionEvent
import android.view.View

/**
 * Overlay drawn on top of the emoji picker to show the long-press
 * skin-tone variants for a single toneable emoji. Modeled on
 * [KeyOverlayView.drawVariants] for visual parity with the letter
 * accent picker — same rounded background, same highlighted-cell
 * treatment.
 *
 * Two interaction phases:
 *
 *  1. **Initial long-press gesture** — the originating cell captured
 *     ACTION_DOWN, so the cell's `OnTouchListener` continues to receive
 *     ACTION_MOVE / ACTION_UP and forwards drag into [updateHighlight].
 *     On release the picker checks [isDraggedSelection]: if the user
 *     dragged, commit; otherwise the popup stays open.
 *
 *  2. **Post-release sticky phase** — any new gesture starts via
 *     dispatch through this view (since it sits at the top of the
 *     FrameLayout's z-order). Tapping a cell commits via [onCommit];
 *     tapping outside the popup background dismisses without commit.
 */
class SkinTonePopupView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    private val theme = KeyTheme(context)
    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
    }

    private data class State(
        val variants: List<String>,
        val backgroundRect: RectF,
        val cellRects: List<RectF>,
        var selectedIndex: Int,
        /// Pointer X (this view's coords) when the popup opened. Used to
        /// detect the first "real" horizontal drag — see [updateHighlight].
        val openX: Float,
        var userHasDragged: Boolean,
    )

    private var state: State? = null

    /// Invoked from [onTouchEvent] when the user taps a cell in the
    /// post-release sticky phase. The picker installs this to wire up
    /// the same commit path used for drag-select-on-release.
    var onCommit: ((String) -> Unit)? = null

    init {
        isClickable = false
        isFocusable = false
        setWillNotDraw(false)
        visibility = GONE
    }

    /**
     * Opens the popup above [anchorRect] (the cell's bounds in *this*
     * view's coordinate space). [initialIndex] is the cell highlighted
     * on open — the picker passes the index matching the user's
     * current default tone so a long-press + immediate release commits
     * what the user perceived as "the highlighted glyph" (matches
     * Gboard and the letter accent picker's index-0 default behavior
     * at `KeyOverlayView.kt:122-126`).
     */
    fun show(
        anchorRect: RectF,
        variants: List<String>,
        initialIndex: Int,
        pointerX: Float,
    ) {
        val cellW = dpPx(CELL_WIDTH_DP)
        val cellH = dpPx(CELL_HEIGHT_DP)
        val pad = dpPx(POPUP_PADDING_DP)
        val totalW = variants.size * cellW + 2 * pad
        val totalH = cellH + 2 * pad

        var bgLeft = anchorRect.centerX() - totalW / 2
        if (bgLeft < 0f) bgLeft = 0f
        if (bgLeft + totalW > width) bgLeft = (width - totalW).coerceAtLeast(0f)
        // Always above the anchor — clamp to the top of the view if
        // there isn't room (tiny screen / oversized variant set).
        val bgTop = (anchorRect.top - totalH - dpPx(4f)).coerceAtLeast(0f)

        val cellRects = (0 until variants.size).map { i ->
            val cellLeft = bgLeft + pad + i * cellW
            RectF(cellLeft, bgTop + pad, cellLeft + cellW, bgTop + pad + cellH)
        }
        state = State(
            variants = variants,
            backgroundRect = RectF(bgLeft, bgTop, bgLeft + totalW, bgTop + totalH),
            cellRects = cellRects,
            selectedIndex = initialIndex.coerceIn(0, variants.size - 1),
            openX = pointerX,
            userHasDragged = false,
        )
        visibility = VISIBLE
        invalidate()
    }

    /** True while the popup is showing. */
    fun isOpen(): Boolean = state != null

    /**
     * Updates the highlighted cell from a touch in this view's coords.
     * Holds the initial highlight until the user actually drags past
     * [VARIANT_DRAG_THRESHOLD_DP] so a long-press + immediate release
     * commits the default rather than whichever cell sits under the
     * finger when ACTION_MOVE first fires.
     */
    fun updateHighlight(x: Float, @Suppress("UNUSED_PARAMETER") y: Float) {
        val s = state ?: return
        if (!s.userHasDragged) {
            if (kotlin.math.abs(x - s.openX) < dpPx(VARIANT_DRAG_THRESHOLD_DP)) return
            s.userHasDragged = true
        }
        if (x < s.backgroundRect.left || x > s.backgroundRect.right) return
        for ((i, r) in s.cellRects.withIndex()) {
            if (x >= r.left && x <= r.right) {
                if (i != s.selectedIndex) {
                    s.selectedIndex = i
                    KeyFeedback.performTickHaptic(this)
                    invalidate()
                }
                return
            }
        }
    }

    /** Currently highlighted variant, or null if the popup is closed. */
    fun selectedVariant(): String? =
        state?.let { it.variants.getOrNull(it.selectedIndex) }

    /// True if the user dragged on the popup during the initial
    /// long-press gesture. The picker uses this to decide between
    /// "drag-select-and-release commits" vs "release-with-no-drag
    /// keeps the popup open so the user can pick by tapping".
    fun isDraggedSelection(): Boolean = state?.userHasDragged == true

    fun dismiss() {
        if (state != null) {
            state = null
            visibility = GONE
            invalidate()
        }
    }

    /**
     * Consumes touches once the popup is up so the post-release sticky
     * phase can route taps:
     *  - Touch inside the popup background → highlight under finger,
     *    commit on UP via [onCommit].
     *  - Touch outside the popup → dismiss without commit.
     *
     * During the initial long-press gesture this method is never called
     * because the originating cell captured ACTION_DOWN and Android
     * routes the rest of the stream directly to it.
     */
    override fun onTouchEvent(event: MotionEvent): Boolean {
        val s = state ?: return false
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                if (!s.backgroundRect.contains(event.x, event.y)) {
                    // Tap outside — cancel.
                    dismiss()
                    return true
                }
                val idx = cellIndexAt(event.x, s)
                if (idx >= 0 && idx != s.selectedIndex) {
                    s.selectedIndex = idx
                    invalidate()
                }
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (s.backgroundRect.contains(event.x, event.y)) {
                    val idx = cellIndexAt(event.x, s)
                    if (idx >= 0 && idx != s.selectedIndex) {
                        s.selectedIndex = idx
                        KeyFeedback.performTickHaptic(this)
                        invalidate()
                    }
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                val idx = if (s.backgroundRect.contains(event.x, event.y)) {
                    cellIndexAt(event.x, s)
                } else {
                    -1
                }
                val variant = if (idx >= 0) s.variants[idx] else null
                dismiss()
                if (variant != null) onCommit?.invoke(variant)
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                dismiss()
                return true
            }
        }
        return false
    }

    private fun cellIndexAt(x: Float, s: State): Int {
        for ((i, r) in s.cellRects.withIndex()) {
            if (x >= r.left && x <= r.right) return i
        }
        return -1
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val s = state ?: return
        backgroundPaint.color = theme.specialKeyBackground
        val radius = dpPx(10f)
        canvas.drawRoundRect(s.backgroundRect, radius, radius, backgroundPaint)
        textPaint.textSize = dpPx(24f)
        for ((i, r) in s.cellRects.withIndex()) {
            if (i == s.selectedIndex) {
                backgroundPaint.color = theme.micButtonBackground
                canvas.drawRoundRect(r, dpPx(8f), dpPx(8f), backgroundPaint)
                textPaint.color = theme.micButtonIcon
            } else {
                textPaint.color = theme.keyText
            }
            val baseline = r.centerY() - (textPaint.descent() + textPaint.ascent()) / 2
            canvas.drawText(s.variants[i], r.centerX(), baseline, textPaint)
        }
    }

    private fun dpPx(value: Float): Float = TypedValue.applyDimension(
        TypedValue.COMPLEX_UNIT_DIP,
        value,
        resources.displayMetrics,
    )

    companion object {
        private const val CELL_WIDTH_DP = 40f
        private const val CELL_HEIGHT_DP = 44f
        private const val POPUP_PADDING_DP = 6f
        /// Minimum horizontal travel (dp) before the popup starts
        /// snapping its highlight under the finger — ~8dp matches
        /// Gboard's tolerance and the letter accent picker's threshold.
        private const val VARIANT_DRAG_THRESHOLD_DP = 8f
    }
}
