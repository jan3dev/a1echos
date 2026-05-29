package com.a1lab.echos.ime

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.AttributeSet
import android.util.Log
import android.util.SparseArray
import android.util.TypedValue
import android.view.Choreographer
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.accessibility.AccessibilityEvent
import android.view.inputmethod.EditorInfo
import androidx.core.content.ContextCompat

/**
 * Custom keyboard view that draws keys on a Canvas for maximum performance.
 * Handles touch input, shift state, layout mode switching, and mic button.
 */
class EchosKeyboardView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    interface KeyboardActionListener {
        fun onKeyPress(char: String)
        fun onDeletePress()
        /// Fires while the user holds the delete key past the word-deletion
        /// threshold. Matches the iOS behaviour where long holds escalate
        /// from per-character to per-word deletion.
        fun onDeleteWord()
        fun onSpacePress()
        fun onReturnPress()
        fun onMicPress()
        fun onMicRelease()
        fun onEmojiPress()
        fun onSwitchKeyboard()
        /// Long-press on the globe key — surfaces the system keyboard
        /// picker so the user can pick a different IME entirely.
        fun onShowKeyboardPicker()

        /// Tapped shift. Returns true if the tap was consumed (e.g.
        /// recapitalizing a text selection, §4.7) so the view skips its
        /// normal shift-state cycle.
        fun onShiftTap(): Boolean
    }

    private var listener: KeyboardActionListener? = null
    private var currentRows: List<EchosKeyboardLayout.Row> = EchosKeyboardLayout.LETTER_ROWS
    /// Set when [layoutMode] is NUMPAD — otherwise null. NUMPAD switches
    /// the layout pipeline to a cell grid (operator stack + 3x3 digit
    /// grid + utility column + bottom row); everything else continues
    /// to use the row-based logic.
    private var currentCells: List<EchosKeyboardLayout.NumpadCell>? = null
    /// Per-cell visible band rect (untouched by scroll). Used for the
    /// VERTICAL_STACK operator column: the shared background draws to
    /// this rect, and rendering clips to this band so off-scroll
    /// operators don't bleed into adjacent rows.
    private val cellBounds = mutableListOf<RectF>()
    /// NUMPAD operator-column scroll offset (px). 0 = stack at top
    /// (`+ - * /` visible). Positive = scrolled down, revealing brackets.
    private var opScrollY: Float = 0f
    private var layoutMode: LayoutMode = LayoutMode.LETTERS
    private var shiftState: ShiftState = ShiftState.OFF

    /// Timestamp (SystemClock.uptimeMillis) of the previous shift tap.
    /// A second tap within `SHIFT_DOUBLE_TAP_WINDOW_MS` escalates to
    /// caps lock. 0 = no shift tap pending.
    private var lastShiftTapAt: Long = 0L

    /// §4.9 symbols auto-return — set when the user types a non-space
    /// symbol from the NUMBERS / SYMBOLS layout, consumed on the next
    /// space or enter to flip back to letters. Reset on every explicit
    /// layout switch so the next space after a manual swap doesn't
    /// jump the user somewhere they didn't ask for.
    private var typedNonSpaceInSymbols: Boolean = false
    private var micState: MicState = MicState.IDLE
    private var returnLabel: String = "\u23CE"
    /// When true, the RETURN key renders as a checkmark \u2014 the IME flips
    /// this on while in emoji-search mode so the return key reads as
    /// "done / dismiss search" (matching native iOS). The blue accent
    /// background stays on because the return-key already uses it.
    private var returnAsCheckmark: Boolean = false

    /// Per-pointer state. Each finger touching the keyboard gets its own
    /// entry keyed by Android's stable `pointerId`, which is what unlocks
    /// roll-typing: when finger B lands while finger A is still down, B's
    /// `ACTION_POINTER_DOWN` lands its own row/col here without disturbing
    /// A's existing entry, and either pointer's release commits its own
    /// character. Without this map, only the gesture-leader pointer was
    /// tracked and every overlapping press was silently dropped.
    ///
    /// `rowIdx` / `colIdx` are mutable — `ACTION_MOVE` re-detects the key
    /// under each pointer with hysteresis (LatinIME's
    /// `isMajorEnoughMoveToBeOnNewKey`) so a slightly-mis-aimed press can
    /// slide onto the intended key before release. Without this drag-to-
    /// correct, fast typing on the QWERTY-row boundary still loses keys
    /// even with per-pointer tracking.
    private data class PointerState(
        var rowIdx: Int,
        var colIdx: Int,
        var touchDownNs: Long,
        var longPressRunnable: Runnable?,
        var longPressFired: Boolean,
        var ownsVariants: Boolean,
        var ownsDeleteRepeat: Boolean,
        /// Most recent pointer X in keyboard-view coords. Updated in
        /// `handlePointerDown` and `handleMoveEvent`. Read when the accent
        /// long-press fires so the popup can seed its highlight to whatever
        /// cell lies under the finger at that exact moment.
        var lastX: Float,
        /// NUMPAD operator-column scroll state. When the user presses on
        /// the operator stack (cell 0) and drags vertically, this pointer
        /// owns the scroll: `opScrollStartY` is the touch's Y at down,
        /// `opScrollInitial` is `opScrollY` at down. Set non-null only
        /// for the pointer that engaged the scroll.
        var opScrollStartY: Float = 0f,
        var opScrollInitial: Float = 0f,
        var ownsOpScroll: Boolean = false,
    )
    private val pointers = SparseArray<PointerState>()

    // Drawn key rects (used by onDraw). Mirror shape of `currentRows`.
    private val keyRects = mutableListOf<List<RectF>>()

    // Hit-test rects: same shape as `keyRects`, but the outermost keys'
    // rects are stretched into the keyboard's outer padding (§1.4 edge-key
    // hitbox extension). Drawing always uses `keyRects`; hit detection
    // (`findKey` / `nearestRowIndex`) uses these so margin taps resolve to
    // the nearest edge key without visibly enlarging the keys.
    private val hitRects = mutableListOf<List<RectF>>()

    // Paints. Three pre-configured text paints \u2014 one per text size \u2014 so
    // `drawKey` never mutates `textSize` mid-frame. Mutating textSize forces
    // Skia to recompute font metrics and invalidates the glyph cache; with
    // ~30 keys redrawn per frame the cost adds up. Each paint also caches
    // its baseline offset so we don't re-call `descent + ascent` per
    // `drawText`.
    private val keyPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val keyTextPaintRegular = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT
    }
    private val keyTextPaintSpecial = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT
    }
    private val keyTextPaintNumber = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT
    }
    private var regularBaselineOffset = 0f
    private var specialBaselineOffset = 0f
    private val backgroundPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    // Dimensions (loaded from resources)
    private var keyHeight = 0f
    private var keyHGap = 0f
    private var keyVGap = 0f
    private var keyCornerRadius = 0f
    private var keyTextSize = 0f
    private var keyTextSizeSpecial = 0f
    private var paddingH = 0f
    private var paddingBottom = 0f

    // Pre-computed dp-converted constants used inside the per-frame draw
    // loop. Computing them via `dpPx()` for every key on every redraw is
    // wasteful — at ~30 character keys × 60Hz mic-pulse-driven redraws
    // that's thousands of needless `applyDimension` calls per second.
    private var numberLabelTextSize = 0f
    private var numberLabelOffsetRight = 0f
    private var numberLabelOffsetTop = 0f
    private var iconSizePx = 0

    // Caches that turn per-frame work in `drawKey` into one-time map
    // lookups: avoids re-allocating uppercase strings and re-resolving
    // accent-number lookups for every redraw.
    private val uppercaseLabelCache = mutableMapOf<String, String>()
    private val numberLabelCache = mutableMapOf<String, String?>()

    /// Whether `keyRects` is up-to-date for the current `width` / `currentRows`.
    /// Set false on size or layout-mode changes; recomputed lazily on the
    /// next draw. Avoids re-allocating ~30 `RectF` instances per frame.
    private var keyRectsValid = false

    // Colors
    private val theme = KeyTheme(context)

    // Mic pulse animation
    private var micPulseAnimator: ObjectAnimator? = null
    private var micPulseAlpha: Float = 1f

    // Cached drawables for icon-rendered keys (shift / delete / return /
    // emoji). Loading the vector drawable on every onDraw would be wasteful;
    // a per-name cache is enough since icons never change after init.
    private val iconCache = mutableMapOf<String, Drawable?>()

    // Long-press accent variants (à, á, â… on `a`) + top-row numbers. The
    // popups themselves render in `KeyOverlayView` (a sibling on top of the
    // IME's FrameLayout) so they can extend above the keyboard's row area
    // into the top-bar's vertical band — top-row keys would otherwise have
    // nowhere visible to put their preview balloon. Each pointer schedules
    // its own runnable on this shared handler; only one popup can be on
    // screen at a time, owned by whichever pointer fired its long-press
    // first (`PointerState.ownsVariants`).
    private val longPressHandler = Handler(Looper.getMainLooper())
    private var overlay: KeyOverlayView? = null

    private companion object {
        // Accent / emoji long-press default — 300 ms matches LatinIME.
        private const val LONG_PRESS_THRESHOLD_MS = 300L

        /// LatinIME's `keyboard_lock_timeout` — long-press shift this long
        /// jumps straight to caps lock, bypassing the regular tap cycle.
        private const val SHIFT_LONG_PRESS_TO_LOCK_MS = 1200L

        /// `getDoubleTapTimeout()` default on Android is 300 ms. Two shift
        /// taps inside this window escalate to caps lock.
        private const val SHIFT_DOUBLE_TAP_WINDOW_MS = 300L

        /// Tag used by the optional perf logger. Toggle on a connected
        /// device with `adb shell setprop log.tag.EchosImePerf DEBUG`.
        /// Off by default — `Log.isLoggable` is a fast check.
        private const val PERF_TAG = "EchosImePerf"

        /// 24ms ≈ 1.5× a 60Hz vsync interval. Frames longer than this are
        /// what the user perceives as jank when typing.
        private const val SLOW_FRAME_NS = 24_000_000L

        /// How many operator keys fit in the visible NUMPAD column at
        /// once. The full key list is longer — the column scrolls
        /// vertically to reveal the overflow (brackets).
        private const val NUMPAD_OP_VISIBLE = 4
    }

    /// Frame-drop logger. Re-posts itself while attached and the perf tag
    /// is enabled. Logs whenever the gap between consecutive frames
    /// exceeds `SLOW_FRAME_NS`.
    private var lastFrameNs: Long = 0L
    private val perfFrameCallback: Choreographer.FrameCallback =
        Choreographer.FrameCallback { frameTimeNs ->
            val prev = lastFrameNs
            lastFrameNs = frameTimeNs
            if (prev != 0L) {
                val delta = frameTimeNs - prev
                if (delta > SLOW_FRAME_NS) {
                    Log.d(PERF_TAG, "slow frame: ${delta / 1_000_000}ms")
                }
            }
            if (isAttachedToWindow && Log.isLoggable(PERF_TAG, Log.DEBUG)) {
                Choreographer.getInstance().postFrameCallback(perfFrameCallback)
            } else {
                lastFrameNs = 0L
            }
        }

    // Delete-key auto-repeat: matches the iOS keyboard's cadence — char-rate
    // after a 0.4 s hold, escalating to word-rate past ~1.5 s. Suppresses the
    // trailing single-tap delete on `ACTION_UP` if a repeat already fired.
    private val deleteRepeater = KeyDeleteRepeater(
        onCharDelete = { listener?.onDeletePress() },
        onWordDelete = { listener?.onDeleteWord() },
    )

    enum class LayoutMode { LETTERS, NUMBERS, SYMBOLS, NUMPAD }
    /**
     * LatinIME-style 6-state shift machine. `AUTOMATIC` is rendered the
     * same as `ON` but drops to `OFF` after one keystroke without feeling
     * like the user undid a deliberate shift. `MANUAL_FROM_AUTO` is the
     * transient "user cancelled the auto-shift" state; rendered as OFF.
     */
    enum class ShiftState {
        OFF, ON, AUTOMATIC, MANUAL_FROM_AUTO, CAPS_LOCK;
        /** Character keys commit uppercase when this is true. */
        val isShifted: Boolean get() = when (this) {
            OFF, MANUAL_FROM_AUTO -> false
            ON, AUTOMATIC, CAPS_LOCK -> true
        }
    }

    init {
        isFocusable = true
        isFocusableInTouchMode = true
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES

        loadDimensions()
    }

    /**
     * Re-reads `keyboard_dimens.xml` and rebuilds the per-paint metric
     * caches. Call after a configuration change (e.g. rotation) so the
     * landscape `values-land/` overrides take effect — Android keeps
     * the IME's input view across rotations by default, so dimensions
     * read at init time would otherwise stay stale.
     */
    fun reloadDimensions() {
        loadDimensions()
        keyRectsValid = false
        requestLayout()
        invalidate()
    }

    private fun loadDimensions() {
        val res = context.resources
        keyHeight = res.getDimension(res.getIdentifier("key_height", "dimen", context.packageName))
        keyHGap = res.getDimension(res.getIdentifier("key_horizontal_gap", "dimen", context.packageName))
        keyVGap = res.getDimension(res.getIdentifier("key_vertical_gap", "dimen", context.packageName))
        keyCornerRadius = res.getDimension(res.getIdentifier("key_corner_radius", "dimen", context.packageName))
        keyTextSize = res.getDimension(res.getIdentifier("key_text_size", "dimen", context.packageName))
        keyTextSizeSpecial = res.getDimension(res.getIdentifier("key_text_size_special", "dimen", context.packageName))
        paddingH = res.getDimension(res.getIdentifier("keyboard_padding_horizontal", "dimen", context.packageName))
        paddingBottom = res.getDimension(res.getIdentifier("keyboard_padding_bottom", "dimen", context.packageName))

        // Constants the draw loop uses for the small number label drawn in
        // the corner of each top-row letter key. Computed once here so the
        // per-frame loop is allocation-free.
        numberLabelTextSize = dpPx(10f)
        numberLabelOffsetRight = dpPx(7f)
        numberLabelOffsetTop = dpPx(12f)
        iconSizePx = dpPx(22f).toInt()
        // ~10dp is roughly LatinIME's default hysteresis on phone-sized
        // keys — small enough that the user can drift mid-press, large
        // enough that boundary jitter doesn't constantly re-detect.
        keyHysteresisPx = dpPx(10f)

        // Pre-configure the three text paints with their final text sizes.
        // Setting `textSize` triggers font-metric recomputation, so we want
        // to do it exactly once per paint at init rather than every draw.
        keyTextPaintRegular.textSize = keyTextSize
        keyTextPaintSpecial.textSize = keyTextSizeSpecial
        keyTextPaintNumber.textSize = numberLabelTextSize
        regularBaselineOffset =
            -(keyTextPaintRegular.descent() + keyTextPaintRegular.ascent()) / 2
        specialBaselineOffset =
            -(keyTextPaintSpecial.descent() + keyTextPaintSpecial.ascent()) / 2

        prewarmLabelCaches()
    }

    /// Pre-fill the uppercase / accent-number caches by walking every layout
    /// once. The set of unique key labels across LETTERS / NUMBERS / SYMBOLS
    /// is ~50, so this is trivial work — and it pays back every draw of
    /// every shifted character key.
    private fun prewarmLabelCaches() {
        val allRows = EchosKeyboardLayout.LETTER_ROWS +
            EchosKeyboardLayout.NUMBER_ROWS +
            EchosKeyboardLayout.SYMBOL_ROWS
        for (row in allRows) {
            for (key in row.keys) {
                if (key.type != EchosKeyboardLayout.KeyType.CHARACTER) continue
                if (!uppercaseLabelCache.containsKey(key.label)) {
                    uppercaseLabelCache[key.label] = key.label.uppercase()
                }
                if (!numberLabelCache.containsKey(key.label)) {
                    numberLabelCache[key.label] = AccentVariants.numberFor(key.label)
                }
            }
        }
    }

    fun setKeyboardActionListener(listener: KeyboardActionListener) {
        this.listener = listener
    }

    fun setOverlay(overlay: KeyOverlayView) {
        this.overlay = overlay
    }

    fun showLetterLayout() {
        layoutMode = LayoutMode.LETTERS
        currentRows = EchosKeyboardLayout.LETTER_ROWS
        currentCells = null
        opScrollY = 0f
        shiftState = ShiftState.OFF
        typedNonSpaceInSymbols = false
        keyRectsValid = false
        requestLayout()
        invalidate()
    }

    fun showNumberLayout() {
        layoutMode = LayoutMode.NUMBERS
        currentRows = EchosKeyboardLayout.NUMBER_ROWS
        currentCells = null
        opScrollY = 0f
        typedNonSpaceInSymbols = false
        keyRectsValid = false
        requestLayout()
        invalidate()
    }

    fun showNumpadLayout() {
        layoutMode = LayoutMode.NUMPAD
        currentCells = EchosKeyboardLayout.NUMPAD_CELLS
        opScrollY = 0f
        typedNonSpaceInSymbols = false
        // currentRows is left as-is; the cell pipeline owns layout.
        keyRectsValid = false
        requestLayout()
        invalidate()
    }

    /// Toggle the visual checkmark/return glyph on the RETURN key. Used by
    /// the IME service to flag emoji-search dismiss behaviour without
    /// adding a new key type or repurposing `updateReturnKeyType`.
    fun setReturnAsCheckmark(enabled: Boolean) {
        if (returnAsCheckmark == enabled) return
        returnAsCheckmark = enabled
        invalidate()
    }

    fun updateReturnKeyType(imeAction: Int) {
        returnLabel = when (imeAction) {
            EditorInfo.IME_ACTION_GO -> "Go"
            EditorInfo.IME_ACTION_SEARCH -> "\uD83D\uDD0D"
            EditorInfo.IME_ACTION_SEND -> "Send"
            EditorInfo.IME_ACTION_NEXT -> "Next"
            EditorInfo.IME_ACTION_DONE -> "Done"
            else -> "\u23CE"
        }
        invalidate()
    }

    fun setMicState(state: MicState) {
        micState = state
        when (state) {
            MicState.RECORDING -> startMicPulse()
            else -> stopMicPulse()
        }
        invalidate()
    }

    fun showMicError(message: String) {
        announceForAccessibility(message)
        // TODO: Show toast or inline error
    }

    // -- Measurement --

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val totalHeight = if (currentCells != null) {
            // NUMPAD body matches a 4-row letter layout exactly so the
            // IME doesn't visibly resize when the user toggles modes.
            val bodyHeight = 4 * keyHeight + 3 * keyVGap
            (bodyHeight + keyVGap + paddingBottom).toInt()
        } else {
            val rowCount = currentRows.size
            val totalRowHeight = currentRows.sumOf { (keyHeight * it.heightMultiplier).toDouble() }.toFloat()
            (totalRowHeight + (rowCount - 1) * keyVGap + keyVGap + paddingBottom).toInt()
        }
        setMeasuredDimension(width, totalHeight)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        keyRectsValid = false
    }

    // -- Drawing --

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // Draw keyboard background
        backgroundPaint.color = theme.keyboardBackground
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backgroundPaint)

        if (!keyRectsValid) {
            computeKeyRects()
            keyRectsValid = true
        }

        val cells = currentCells
        if (cells != null) {
            // NUMPAD mode: keyRects[cellIdx] holds the rect(s) for cell
            // `cellIdx`. Single-key cells produce one rect; VERTICAL_STACK
            // and HORIZONTAL_SPLIT produce multiple. The list-of-lists
            // shape lets `findKey`, `isKeyPressed`, and pointer tracking
            // keep working uniformly.
            for (cellIdx in cells.indices) {
                drawNumpadCell(canvas, cells[cellIdx], cellIdx)
            }
        } else {
            for (rowIdx in currentRows.indices) {
                val row = currentRows[rowIdx]
                for (colIdx in row.keys.indices) {
                    val key = row.keys[colIdx]
                    val rect = keyRects[rowIdx][colIdx]
                    drawKey(canvas, key, rect, isKeyPressed(rowIdx, colIdx))
                }
            }
        }
        // Popups (preview balloon + accent variants) draw in `KeyOverlayView`,
        // not here — see `setOverlay` for the wiring.
    }

    /// Lookup the Key at the given outer/inner index. Row-based modes
    /// (LETTERS/NUMBERS/SYMBOLS) use outer=row, inner=col. NUMPAD uses
    /// outer=cell index, inner=sub-key (0 for SINGLE cells, 0..N-1 for
    /// VERTICAL_STACK or HORIZONTAL_SPLIT cells). `keyRects` mirrors this
    /// shape, so the rest of the pointer pipeline stays unchanged.
    private fun keyAt(outer: Int, inner: Int): EchosKeyboardLayout.Key? {
        val cells = currentCells
        return if (cells != null) {
            cells.getOrNull(outer)?.keys?.getOrNull(inner)
        } else {
            currentRows.getOrNull(outer)?.keys?.getOrNull(inner)
        }
    }

    /// True if any active pointer is currently down on this row/col. Linear
    /// scan, but `pointers` rarely holds more than 2-3 entries during real
    /// typing, so this is faster than a secondary index.
    private fun isKeyPressed(rowIdx: Int, colIdx: Int): Boolean {
        for (i in 0 until pointers.size()) {
            val state = pointers.valueAt(i)
            if (state.rowIdx == rowIdx && state.colIdx == colIdx) return true
        }
        return false
    }

    /// Cell-anchored layout. Every row in `currentRows` declares its content
    /// in fractional cells of a single shared grid; `cellsPerRow` is the
    /// widest row's total (typically 10). One cell occupies `cellPitch` of
    /// horizontal space, where `cellPitch = u + g` (key visual width + one
    /// inter-key gap). A key with weight w renders as `w*cellPitch - g`,
    /// which means w=1 -> u, w=1.5 -> 1.5u + 0.5g (so SHIFT reaches exactly
    /// to the right edge of "a"), and w=4 -> 4u + 3g (spacebar spans c-v-b-n
    /// including the gaps it covers).
    private fun computeKeyRects() {
        keyRects.clear()
        hitRects.clear()
        val availableWidth = width.toFloat() - 2 * paddingH

        val cells = currentCells
        if (cells != null) {
            computeCellKeyRects(cells, availableWidth)
            // NUMPAD keeps hit rects identical to draw rects — the cell grid
            // owns its own geometry and scroll bands, so no edge extension.
            for (row in keyRects) hitRects.add(row.map { RectF(it) })
            return
        }

        var y = keyVGap / 2f

        val cellsPerRow = currentRows.maxOf { row ->
            val keyCells = row.keys.sumOf { it.widthWeight.toDouble() }.toFloat()
            row.leadingPadCells + keyCells + row.trailingPadCells
        }
        val cellPitch = (availableWidth + keyHGap) / cellsPerRow

        for (row in currentRows) {
            val rowRects = mutableListOf<RectF>()
            var x = paddingH + row.leadingPadCells * cellPitch
            val rowHeight = keyHeight * row.heightMultiplier
            for (key in row.keys) {
                val keyWidth = key.widthWeight * cellPitch - keyHGap
                rowRects.add(RectF(x, y, x + keyWidth, y + rowHeight))
                x += key.widthWeight * cellPitch
            }
            keyRects.add(rowRects)
            y += rowHeight + keyVGap
        }

        // Build the hit tiles from the drawn rects: tile the whole keyboard
        // body edge to edge so every touch resolves to exactly one key — the
        // inter-key gaps, the outer side margins, and the bands above the top
        // row / below the bottom row (§1.4) are all absorbed, with the inter-
        // row split pulled up by the averaged sweet-spot bias so the lower row
        // claims most of the gap (§1.5). The drawn rects stay untouched.
        buildHitTiles(width.toFloat(), height.toFloat())
    }

    /// Fills `hitRects` (parallel to the already-built `keyRects`) with a gap-
    /// free tiling of the keyboard body — see [computeKeyRects]. Columns split
    /// at the inter-key gap midpoint and the first / last key runs to the side
    /// edge; rows split at the inter-row gap midpoint pulled up by the averaged
    /// sweet-spot bias, the top row reaching y=0 and the bottom row the view
    /// bottom. With no gaps, every touch on the body lands on exactly one key,
    /// so the nearest-key fallback in `findKey` only ever fires for NUMPAD.
    private fun buildHitTiles(viewW: Float, viewH: Float) {
        val rowCount = keyRects.size

        // Shared vertical edge of row `i` (above) and row `i + 1` (below): the
        // inter-row gap midpoint pulled up by the averaged sweet-spot bias.
        fun interRowSplit(i: Int): Float {
            val upper = keyRects[i][0]
            val lower = keyRects[i + 1][0]
            val midpoint = (upper.bottom + lower.top) / 2f
            val bias = (rowYBias(i, upper.height()) + rowYBias(i + 1, lower.height())) / 2f
            return midpoint - bias
        }

        for (rowIdx in keyRects.indices) {
            val row = keyRects[rowIdx]
            if (row.isEmpty()) { hitRects.add(emptyList()); continue }
            val top = if (rowIdx == 0) 0f else interRowSplit(rowIdx - 1)
            val bottom = if (rowIdx == rowCount - 1) viewH else interRowSplit(rowIdx)
            val lastCol = row.size - 1
            val rowHit = mutableListOf<RectF>()
            for (colIdx in row.indices) {
                val left = if (colIdx == 0) 0f
                    else (row[colIdx - 1].right + row[colIdx].left) / 2f
                val right = if (colIdx == lastCol) viewW
                    else (row[colIdx].right + row[colIdx + 1].left) / 2f
                rowHit.add(RectF(left, top, right, bottom))
            }
            hitRects.add(rowHit)
        }
    }

    /// Cell-based layout (NUMPAD). Lays out a fixed 5-col × 4-row grid
    /// using [EchosKeyboardLayout.NUMPAD_COL_WEIGHTS], then walks
    /// [EchosKeyboardLayout.NUMPAD_CELLS] to assign each cell to its
    /// grid rectangle. SINGLE cells produce one rect; VERTICAL_STACK
    /// (the operator column) splits its cell into N equal-height
    /// rectangles with no inter-key gap; HORIZONTAL_SPLIT (the
    /// bottom-row pairs) splits with the usual horizontal gap.
    private fun computeCellKeyRects(
        cells: List<EchosKeyboardLayout.NumpadCell>,
        availableWidth: Float,
    ) {
        cellBounds.clear()
        val colWeights = EchosKeyboardLayout.NUMPAD_COL_WEIGHTS
        // Match a 4-row regular layout exactly so toggling LETTERS <->
        // NUMPAD doesn't visibly resize the IME.
        val bodyHeight = 4 * keyHeight + 3 * keyVGap
        // Vertical inter-row gap matches the horizontal inter-key gap so
        // the 3×3 digit grid reads as a uniform mesh (instead of the
        // letter-layout's wider vertical rhythm).
        val vGap = keyHGap
        // Bottom function row stays at the standard letter-key height.
        // The three digit rows absorb the remainder so the number keys
        // are as tall as the tighter vertical spacing allows.
        val bottomRowH = keyHeight
        val digitRowH = (bodyHeight - 3 * vGap - bottomRowH) / 3
        val rowHeights = floatArrayOf(digitRowH, digitRowH, digitRowH, bottomRowH)

        val totalColWeight = colWeights.sum()
        val totalHGap = (colWeights.size - 1) * keyHGap
        val colUnit = (availableWidth - totalHGap) / totalColWeight

        val colLefts = FloatArray(colWeights.size + 1)
        colLefts[0] = paddingH
        for (i in colWeights.indices) {
            colLefts[i + 1] = colLefts[i] + colWeights[i] * colUnit + keyHGap
        }
        val rowTops = FloatArray(rowHeights.size + 1)
        rowTops[0] = keyVGap / 2f
        for (i in rowHeights.indices) {
            rowTops[i + 1] = rowTops[i] + rowHeights[i] + vGap
        }

        for (cell in cells) {
            val left = colLefts[cell.col]
            val right = colLefts[cell.col + cell.colSpan] - keyHGap
            val top = rowTops[cell.row]
            val bottom = rowTops[cell.row + cell.rowSpan] - vGap

            cellBounds.add(RectF(left, top, right, bottom))

            val rects = when (cell.layout) {
                EchosKeyboardLayout.CellLayout.SINGLE ->
                    listOf(RectF(left, top, right, bottom))
                EchosKeyboardLayout.CellLayout.VERTICAL_STACK -> {
                    // Operator column: NO inter-key vertical gaps, so the
                    // stack reads as one connected pill. Only the first
                    // `NUMPAD_OP_VISIBLE` slots take the visible band;
                    // the rest extend below and are revealed by
                    // `opScrollY` (vertical drag inside the column).
                    val visible = NUMPAD_OP_VISIBLE
                    val keyH = (bottom - top) / visible
                    val n = cell.keys.size
                    List(n) { i ->
                        val ty = top + i * keyH - opScrollY
                        RectF(left, ty, right, ty + keyH)
                    }
                }
                EchosKeyboardLayout.CellLayout.HORIZONTAL_SPLIT -> {
                    val n = cell.keys.size
                    val weights = cell.subWidthWeights ?: FloatArray(n) { 1f }
                    val totalWeight = weights.sum()
                    val totalGaps = (n - 1) * keyHGap
                    val unitW = (right - left - totalGaps) / totalWeight
                    var x = left
                    List(n) { i ->
                        val w = weights[i] * unitW
                        val r = RectF(x, top, x + w, bottom)
                        x += w + keyHGap
                        r
                    }
                }
            }
            keyRects.add(rects)
        }
    }

    /// Max value of [opScrollY]. Computed from the operator cell's
    /// visible band (in [cellBounds]) and the total number of operators.
    private fun opScrollMax(): Float {
        val cells = currentCells ?: return 0f
        val opCell = cells.firstOrNull {
            it.layout == EchosKeyboardLayout.CellLayout.VERTICAL_STACK
        } ?: return 0f
        val band = cellBounds.getOrNull(cells.indexOf(opCell)) ?: return 0f
        val visible = NUMPAD_OP_VISIBLE
        val total = opCell.keys.size
        if (total <= visible) return 0f
        val keyH = band.height() / visible
        return (total - visible) * keyH
    }

    /// Draws one key. `drawBackground = false` lets the caller share a
    /// single backing rectangle across multiple sub-keys — used by the
    /// NUMPAD's operator stack so the four ops render as one connected
    /// pill instead of four separate keys.
    private fun drawKey(
        canvas: Canvas,
        key: EchosKeyboardLayout.Key,
        rect: RectF,
        isPressed: Boolean,
        drawBackground: Boolean = true,
    ) {
        // Shift becomes "active" while uppercase or caps-lock is engaged —
        // we light up its background (using the brighter regular-key tone)
        // so the user can tell at a glance which mode they're in.
        val isShiftActive = key.type == EchosKeyboardLayout.KeyType.SHIFT
            && shiftState.isShifted
        // NUMPAD diverges from the regular bg rules: the operator column,
        // ABC, comma, ".", "%", space, delete, and return are all
        // "light" (specialKeyBackground); the digit keys, "=", and "!?#"
        // stay on the standard keyBackground. We special-case this up
        // front and skip the regular `when` ladder.
        val bgColor = if (currentCells != null) {
            val darkInNumpad = isNumpadDarkKey(key)
            if (darkInNumpad) {
                if (isPressed) theme.keyBackgroundPressed else theme.keyBackground
            } else {
                if (isPressed) theme.specialKeyBackgroundPressed else theme.specialKeyBackground
            }
        } else when {
            key.type == EchosKeyboardLayout.KeyType.MIC -> {
                when (micState) {
                    MicState.RECORDING -> theme.micButtonRecording
                    MicState.TRANSCRIBING -> theme.micButtonBackground
                    MicState.IDLE -> theme.micButtonBackground
                }
            }
            isShiftActive -> {
                if (isPressed) theme.keyBackgroundPressed else theme.keyBackground
            }
            key.type == EchosKeyboardLayout.KeyType.SHIFT ||
            key.type == EchosKeyboardLayout.KeyType.DELETE ||
            key.type == EchosKeyboardLayout.KeyType.MODE_SWITCH ||
            key.type == EchosKeyboardLayout.KeyType.SYMBOL_SWITCH ||
            key.type == EchosKeyboardLayout.KeyType.NUMPAD_SWITCH ||
            key.type == EchosKeyboardLayout.KeyType.GLOBE ||
            key.type == EchosKeyboardLayout.KeyType.EMOJI_COMMA ||
            key.type == EchosKeyboardLayout.KeyType.PERIOD -> {
                if (isPressed) theme.specialKeyBackgroundPressed else theme.specialKeyBackground
            }
            key.type == EchosKeyboardLayout.KeyType.RETURN -> {
                theme.micButtonBackground // Accent color for return
            }
            else -> {
                if (isPressed) theme.keyBackgroundPressed else theme.keyBackground
            }
        }

        // Only the two outer keys in the bottom row (?123 / ABC and the
        // return key) get the pill shape — everything else keeps the
        // standard 8dp corner, matching Gboard. Shift, delete, globe,
        // emoji_comma all sit at the same radius as letter keys.
        val cornerRadius = when (key.type) {
            EchosKeyboardLayout.KeyType.MODE_SWITCH,
            EchosKeyboardLayout.KeyType.RETURN -> rect.height() / 2f
            else -> keyCornerRadius
        }

        if (drawBackground) {
            keyPaint.color = bgColor
            canvas.drawRoundRect(rect, cornerRadius, cornerRadius, keyPaint)
        }

        // Draw key label. NUMPAD returns sit on the lighter (gray) bg, so
        // they keep the standard `keyText` foreground; everywhere else the
        // return key uses the accent bg and needs the contrast color.
        val textColor = when {
            key.type == EchosKeyboardLayout.KeyType.MIC -> theme.micButtonIcon
            key.type == EchosKeyboardLayout.KeyType.RETURN && currentCells == null -> theme.micButtonIcon
            else -> theme.keyText
        }

        // Resolve the icon name first — shift swaps between `ic_shift` and
        // `ic_capslock` based on state; everything else uses the static
        // `iconName` from the key definition. Falling back to text if the
        // drawable can't be resolved keeps the keyboard usable on devices
        // where the resource hasn't been bundled for some reason.
        val iconName = when {
            key.type == EchosKeyboardLayout.KeyType.SHIFT -> when (shiftState) {
                ShiftState.OFF, ShiftState.MANUAL_FROM_AUTO -> "ic_shift_outline"
                ShiftState.ON, ShiftState.AUTOMATIC -> "ic_shift"
                ShiftState.CAPS_LOCK -> "ic_capslock"
            }
            key.type == EchosKeyboardLayout.KeyType.RETURN && returnAsCheckmark -> "ic_check"
            else -> key.iconName
        }
        val iconDrawable = iconName?.let { resolveIcon(it) }
        if (iconDrawable != null) {
            if (key.type == EchosKeyboardLayout.KeyType.EMOJI_COMMA) {
                drawEmojiCommaKey(canvas, iconDrawable, rect, textColor, key.label)
            } else {
                drawIcon(canvas, iconDrawable, rect, textColor)
            }
            return
        }

        if (key.type == EchosKeyboardLayout.KeyType.NUMPAD_SWITCH) {
            drawNumpadSwitchKey(canvas, rect, textColor)
            return
        }

        val isSpecial = key.type == EchosKeyboardLayout.KeyType.MODE_SWITCH ||
            key.type == EchosKeyboardLayout.KeyType.SYMBOL_SWITCH
        val labelPaint = if (isSpecial) keyTextPaintSpecial else keyTextPaintRegular
        val labelBaselineOffset = if (isSpecial) specialBaselineOffset else regularBaselineOffset
        labelPaint.color = textColor

        val displayLabel = when {
            key.type == EchosKeyboardLayout.KeyType.RETURN ->
                if (returnAsCheckmark) "✓" else returnLabel
            key.type == EchosKeyboardLayout.KeyType.CHARACTER && shiftState.isShifted ->
                uppercaseLabelCache[key.label] ?: key.label.uppercase()
            else -> key.label
        }

        val textX = rect.centerX()
        val textY = rect.centerY() + labelBaselineOffset
        canvas.drawText(displayLabel, textX, textY, labelPaint)

        // Top-row letters carry a small number in the top-right corner so the
        // user knows long-pressing types it (Gboard convention). Skip when
        // shift is engaged because the character is already shown in caps.
        if (key.type == EchosKeyboardLayout.KeyType.CHARACTER) {
            val number = numberLabelCache[key.label]
            if (number != null) {
                keyTextPaintNumber.color = theme.keyTextSecondary
                canvas.drawText(
                    number,
                    rect.right - numberLabelOffsetRight,
                    rect.top + numberLabelOffsetTop,
                    keyTextPaintNumber,
                )
            }
        }
    }

    private fun resolveIcon(name: String): Drawable? {
        if (iconCache.containsKey(name)) return iconCache[name]
        val resId = resources.getIdentifier(name, "drawable", context.packageName)
        val drawable = if (resId == 0) null else ContextCompat.getDrawable(context, resId)
        iconCache[name] = drawable
        return drawable
    }

    private fun drawIcon(canvas: Canvas, drawable: Drawable, rect: RectF, tint: Int) {
        val cx = rect.centerX().toInt()
        val cy = rect.centerY().toInt()
        drawable.setBounds(
            cx - iconSizePx / 2,
            cy - iconSizePx / 2,
            cx + iconSizePx / 2,
            cy + iconSizePx / 2,
        )
        drawable.setTint(tint)
        drawable.draw(canvas)
    }

    /// Returns true for NUMPAD keys that should render on the dark
    /// background: the digits 0-9, "=", and "!?#" (the symbol switch).
    /// Everything else in NUMPAD reads as "light" (operators, ABC,
    /// comma, ".", "%", space, delete, return).
    private fun isNumpadDarkKey(key: EchosKeyboardLayout.Key): Boolean {
        if (key.type == EchosKeyboardLayout.KeyType.SYMBOL_SWITCH) return true
        if (key.type != EchosKeyboardLayout.KeyType.CHARACTER) return false
        if (key.label == "=") return true
        return key.label.length == 1 && key.label[0].isDigit()
    }

    /// NUMPAD cell renderer. Walks the cell's sub-rects and draws each
    /// rendered key. VERTICAL_STACK cells share a single rounded bg pill
    /// (so the four operators look connected — no inter-key gaps); the
    /// sub-keys then draw only their text on top with `drawBackground=false`.
    private fun drawNumpadCell(
        canvas: Canvas,
        cell: EchosKeyboardLayout.NumpadCell,
        outer: Int,
    ) {
        val rects = keyRects[outer]
        when (cell.layout) {
            EchosKeyboardLayout.CellLayout.SINGLE,
            EchosKeyboardLayout.CellLayout.HORIZONTAL_SPLIT -> {
                for (inner in cell.keys.indices) {
                    drawKey(canvas, cell.keys[inner], rects[inner], isKeyPressed(outer, inner))
                }
            }
            EchosKeyboardLayout.CellLayout.VERTICAL_STACK -> {
                // The shared bg covers the visible band only (not the
                // scrolled-off operators that extend beyond it).
                val band = cellBounds[outer]
                keyPaint.color = theme.specialKeyBackground
                canvas.drawRoundRect(band, keyCornerRadius, keyCornerRadius, keyPaint)
                // Clip subsequent draws to the visible band so the
                // operators scrolling in/out of view get clipped at the
                // band's edges.
                val saveCount = canvas.save()
                canvas.clipRect(band)
                val pressedInner = (0 until cell.keys.size).firstOrNull { isKeyPressed(outer, it) }
                if (pressedInner != null) {
                    keyPaint.color = theme.specialKeyBackgroundPressed
                    canvas.drawRoundRect(
                        rects[pressedInner],
                        keyCornerRadius * 0.5f,
                        keyCornerRadius * 0.5f,
                        keyPaint,
                    )
                }
                for (inner in cell.keys.indices) {
                    drawKey(
                        canvas,
                        cell.keys[inner],
                        rects[inner],
                        isKeyPressed(outer, inner),
                        drawBackground = false,
                    )
                }
                canvas.restoreToCount(saveCount)
            }
        }
    }

    /// "1234" key — renders digits in a 2x2 grid so users recognize the
    /// numeric-pad shortcut at a glance, matching Gboard's glyph.
    private fun drawNumpadSwitchKey(canvas: Canvas, rect: RectF, tint: Int) {
        keyTextPaintSpecial.color = tint
        val cx = rect.centerX()
        val dx = rect.width() * 0.18f
        val dy = rect.height() * 0.18f
        canvas.drawText("1", cx - dx, rect.centerY() - dy + specialBaselineOffset, keyTextPaintSpecial)
        canvas.drawText("2", cx + dx, rect.centerY() - dy + specialBaselineOffset, keyTextPaintSpecial)
        canvas.drawText("3", cx - dx, rect.centerY() + dy + specialBaselineOffset, keyTextPaintSpecial)
        canvas.drawText("4", cx + dx, rect.centerY() + dy + specialBaselineOffset, keyTextPaintSpecial)
    }

    /// Renders the combined emoji+comma key the way Gboard does: smiley
    /// scaled down ~70% and pushed into the top third, with a "," label
    /// sitting below at the same weight as a normal special-key glyph.
    /// Tap commits the label; long-press opens the emoji picker.
    private fun drawEmojiCommaKey(
        canvas: Canvas,
        drawable: Drawable,
        rect: RectF,
        tint: Int,
        label: String,
    ) {
        val iconSide = (iconSizePx * 0.7f).toInt()
        val cx = rect.centerX().toInt()
        val iconCy = (rect.top + rect.height() * 0.32f).toInt()
        drawable.setBounds(
            cx - iconSide / 2,
            iconCy - iconSide / 2,
            cx + iconSide / 2,
            iconCy + iconSide / 2,
        )
        drawable.setTint(tint)
        drawable.draw(canvas)

        keyTextPaintSpecial.color = tint
        canvas.drawText(
            label,
            rect.centerX(),
            rect.bottom - rect.height() * 0.14f,
            keyTextPaintSpecial,
        )
    }

    // -- Touch Handling --

    /// Multi-touch dispatch. Each `MotionEvent` carries up to N pointers,
    /// and Android assigns each finger a stable `pointerId` for the duration
    /// of its press. Routing every pointer through the same per-pointer
    /// path is what makes roll-typing work — touch B's `ACTION_POINTER_DOWN`
    /// commits B independently of A's still-held `ACTION_DOWN`. Single-touch
    /// dispatch (which is what this view used to do) silently drops the
    /// `POINTER_DOWN/UP` events, which is exactly the "skipped key" the
    /// user feels when typing fast.
    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> {
                val pIdx = event.actionIndex
                handlePointerDown(
                    event.getPointerId(pIdx),
                    event.getX(pIdx),
                    event.getY(pIdx),
                )
                invalidate()
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                // Demux every active pointer (LatinIME pattern: see
                // `PointerTracker.processMotionEvent` ACTION_MOVE branch).
                // A single MotionEvent carries up-to-N pointer positions —
                // missing the non-actionIndex pointers here is what makes
                // a slow drag on one finger feel "stuck" when another finger
                // is also down. The variants-drag routing was the only
                // ACTION_MOVE handling before; now every pointer gets its
                // own re-detection pass.
                handleMoveEvent(event)
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP -> {
                val pIdx = event.actionIndex
                handlePointerUp(event.getPointerId(pIdx))
                invalidate()
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                cancelAllPointers()
                invalidate()
                return true
            }
        }
        return false
    }

    /// Drag-to-correct hysteresis (LatinIME's
    /// `getKeyHysteresisDistanceSquared`). The finger has to leave the
    /// pressed key's frame by at least this many pixels before we transfer
    /// the press — otherwise tiny jitter on the boundary would cause a
    /// constant ping-pong between adjacent keys. Computed lazily in
    /// `loadDimensions` once dp scale is known.
    private var keyHysteresisPx = 0f

    private fun handleMoveEvent(event: MotionEvent) {
        val ov = overlay
        val variantsActive = ov?.hasVariants() == true
        var needsRedraw = false

        val pointerCount = event.pointerCount
        for (i in 0 until pointerCount) {
            val pointerId = event.getPointerId(i)
            val state = pointers.get(pointerId) ?: continue
            val x = event.getX(i)
            val y = event.getY(i)
            state.lastX = x

            // Variants popover takes over the drag for its owning pointer —
            // forward and skip everything else (no row/col re-detection,
            // no drag-correct).
            if (state.ownsVariants && variantsActive) {
                ov?.updateVariantsHighlight(x, y)
                continue
            }

            // NUMPAD operator-column scroll: if the touch started on the
            // operator stack (cell 0, VERTICAL_STACK) and the user
            // dragged vertically past the activation threshold, claim
            // the pointer for scrolling and start tracking it. Once
            // owned, subsequent moves keep updating opScrollY until
            // release.
            val cells = currentCells
            val onOpStack = cells != null && state.rowIdx == 0 &&
                cells.getOrNull(0)?.layout == EchosKeyboardLayout.CellLayout.VERTICAL_STACK
            if (onOpStack) {
                val dy = y - state.opScrollStartY
                if (!state.ownsOpScroll && kotlin.math.abs(dy) > dpPx(8f)) {
                    state.ownsOpScroll = true
                    state.longPressFired = true // Suppress the press's tap.
                    state.longPressRunnable?.let { longPressHandler.removeCallbacks(it) }
                    state.longPressRunnable = null
                }
                if (state.ownsOpScroll) {
                    opScrollY = (state.opScrollInitial - dy)
                        .coerceIn(0f, opScrollMax())
                    keyRectsValid = false
                    invalidate()
                    continue
                }
            }

            // Long-press already fired (e.g. globe picker shown): drift is
            // just noise — don't re-target.
            if (state.longPressFired) continue
            // Delete keeps repeating regardless of where the finger drifts.
            if (state.ownsDeleteRepeat) continue

            val currentRect = keyRectAtOrNull(state.rowIdx, state.colIdx)
                ?: continue
            // Inflate the current key's rect by the hysteresis margin —
            // a pointer still inside this inflated rect is considered to
            // remain on its original key. Cheap proxy for LatinIME's
            // `squaredDistanceToEdge >= keyHysteresisDistanceSquared`.
            if (x >= currentRect.left - keyHysteresisPx &&
                x <= currentRect.right + keyHysteresisPx &&
                y >= currentRect.top - keyHysteresisPx &&
                y <= currentRect.bottom + keyHysteresisPx
            ) continue

            val packed = findKey(x, y)
            if (packed < 0) continue
            val newRow = packed ushr 16
            val newCol = packed and 0xFFFF
            if (newRow == state.rowIdx && newCol == state.colIdx) continue

            val newKey = keyAt(newRow, newCol) ?: continue
            val oldKey = keyAt(state.rowIdx, state.colIdx) ?: continue

            // Only slide between character-ish keys. Sliding from `q` onto
            // shift / delete / return would do more harm than good — and
            // sliding off shift was never the user's intent.
            if (!isSlideable(oldKey.type) || !isSlideable(newKey.type)) continue

            // Cancel any pending long-press for the old key — the drag-
            // correct is a fresh press, not a held one.
            state.longPressRunnable?.let { longPressHandler.removeCallbacks(it) }
            state.longPressRunnable = null

            state.rowIdx = newRow
            state.colIdx = newCol
            needsRedraw = true

            val newKeyRect = keyRects[newRow][newCol]
            val displayLabel = if (shiftState.isShifted) {
                uppercaseLabelCache[newKey.label] ?: newKey.label.uppercase()
            } else newKey.label
            overlay?.showPreview(displayLabel, newKeyRect)

            if (newKey.type == EchosKeyboardLayout.KeyType.CHARACTER &&
                AccentVariants.hasVariants(newKey.label) &&
                !anyPointerOwnsVariants()
            ) {
                scheduleAccentLongPress(state, newKeyRect, newKey)
            }
        }

        if (needsRedraw) invalidate()
    }

    private fun isSlideable(type: EchosKeyboardLayout.KeyType): Boolean =
        type == EchosKeyboardLayout.KeyType.CHARACTER ||
            type == EchosKeyboardLayout.KeyType.PERIOD

    private fun keyRectAtOrNull(rowIdx: Int, colIdx: Int): RectF? {
        if (rowIdx < 0 || rowIdx >= keyRects.size) return null
        val row = keyRects[rowIdx]
        if (colIdx < 0 || colIdx >= row.size) return null
        return row[colIdx]
    }

    private fun handlePointerDown(pointerId: Int, x: Float, y: Float) {
        // keyRects are normally computed lazily inside onDraw, but a touch
        // can arrive in the narrow window between layout and the first
        // frame — in which case `keyRects` may be empty or stale, and
        // findKey would return -1 even on a perfectly aimed press. Force a
        // recompute here so the first touch after every layout swap is
        // reliable.
        if (!keyRectsValid) {
            computeKeyRects()
            keyRectsValid = true
        }
        val packed = findKey(x, y)
        if (packed < 0) return
        val rowIdx = packed ushr 16
        val colIdx = packed and 0xFFFF
        val key = keyAt(rowIdx, colIdx) ?: return
        val keyRect = keyRects[rowIdx][colIdx]

        performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)

        val state = PointerState(
            rowIdx = rowIdx,
            colIdx = colIdx,
            touchDownNs = if (Log.isLoggable(PERF_TAG, Log.DEBUG)) System.nanoTime() else 0L,
            longPressRunnable = null,
            longPressFired = false,
            ownsVariants = false,
            ownsDeleteRepeat = false,
            lastX = x,
        )
        // NUMPAD operator-column: capture the touch's Y at press so a
        // subsequent vertical drag can engage the scroll without
        // additional state.
        val cells = currentCells
        if (cells != null && rowIdx == 0 &&
            cells.getOrNull(0)?.layout == EchosKeyboardLayout.CellLayout.VERTICAL_STACK
        ) {
            state.opScrollStartY = y
            state.opScrollInitial = opScrollY
        }
        pointers.put(pointerId, state)

        when (key.type) {
            EchosKeyboardLayout.KeyType.MIC -> listener?.onMicPress()
            EchosKeyboardLayout.KeyType.DELETE -> {
                // Only the first delete-pointer drives the auto-repeat. A
                // second finger tapping delete while the first is still held
                // commits a single delete on its release (handled in
                // `handlePointerUp`), matching Gboard.
                if (!anyPointerOwnsDeleteRepeat()) {
                    state.ownsDeleteRepeat = true
                    deleteRepeater.start()
                }
            }
            EchosKeyboardLayout.KeyType.GLOBE -> scheduleGlobeLongPress(state)
            EchosKeyboardLayout.KeyType.EMOJI_COMMA -> {
                // Short tap commits a comma; long-press opens the emoji
                // picker. Suppress the typewriter balloon on press so
                // the user doesn't see a smiley pop up for what is
                // primarily a comma key — matches Gboard.
                scheduleEmojiLongPress(state)
            }
            EchosKeyboardLayout.KeyType.SHIFT -> scheduleShiftLongPress(state)
            EchosKeyboardLayout.KeyType.CHARACTER -> {
                val ch = if (shiftState.isShifted) {
                    uppercaseLabelCache[key.label] ?: key.label.uppercase()
                } else {
                    key.label
                }
                // NUMPAD suppresses the typewriter balloon for digits,
                // operators, "=", and "!?#" — only the comma surfaces a
                // preview (and PERIOD, which uses its own key type).
                val showPreview = currentCells == null || key.label == ","
                if (showPreview) {
                    overlay?.showPreview(ch, keyRect)
                }
                if (AccentVariants.hasVariants(key.label) && !anyPointerOwnsVariants()) {
                    scheduleAccentLongPress(state, keyRect, key)
                }
            }
            EchosKeyboardLayout.KeyType.PERIOD -> {
                // Period in NUMPAD shows a preview just like comma and keeps
                // its calculator behaviour (no popup). In letter/number/symbol
                // layouts a long-press surfaces a punctuation more-keys popup
                // (LatinIME §3.11); a short tap still types ".".
                if (currentCells != null) {
                    overlay?.showPreview(".", keyRect)
                } else if (!anyPointerOwnsVariants()) {
                    schedulePunctuationLongPress(state, keyRect)
                }
            }
            else -> Unit
        }
    }

    private fun handlePointerUp(pointerId: Int) {
        val state = pointers.get(pointerId) ?: return
        pointers.remove(pointerId)

        // Cancel this pointer's pending long-press runnable, if any.
        state.longPressRunnable?.let { longPressHandler.removeCallbacks(it) }
        state.longPressRunnable = null

        val key = keyAt(state.rowIdx, state.colIdx) ?: return

        // Hide the preview balloon once the last pointer lifts. Earlier
        // releases keep it up so the user still sees feedback for whatever
        // finger is still on the keyboard.
        if (pointers.size() == 0) {
            overlay?.clearPreview()
        }

        // Variants popup release: only the owning pointer commits the
        // selected variant. Other pointers' releases ignore the popup.
        if (state.ownsVariants) {
            val ov = overlay
            val selected = ov?.selectedVariant()
            ov?.clearVariants()
            if (selected != null) {
                listener?.onKeyPress(selected)
                dropTransientShiftAfterCharacterCommit()
            }
            logTouchLatency(state, key.type)
            return
        }

        when {
            state.ownsDeleteRepeat -> {
                // If the hold timer fired one or more repeats, treat this
                // as the release of an auto-repeat — skip the trailing
                // single-tap delete so we don't double up.
                val didRepeat = deleteRepeater.didRepeat
                deleteRepeater.cancel()
                state.ownsDeleteRepeat = false
                if (!didRepeat) listener?.onDeletePress()
            }
            // Long-press already triggered (globe picker shown): skip
            // the regular tap action.
            state.longPressFired -> Unit
            else -> handleKeyAction(key)
        }

        logTouchLatency(state, key.type)
    }

    private fun cancelAllPointers() {
        for (i in 0 until pointers.size()) {
            val state = pointers.valueAt(i)
            state.longPressRunnable?.let { longPressHandler.removeCallbacks(it) }
        }
        pointers.clear()
        overlay?.clearAll()
        deleteRepeater.cancel()
    }

    /// Drops every pointer state without firing release actions. Used right
    /// before swapping `currentRows` on mode/symbol switch, since any held
    /// pointer's `rowIdx`/`colIdx` indexes into the old layout's rows. The
    /// "other" in the name: by the time this fires from `handleKeyAction`,
    /// the pointer that triggered the switch is already out of the map.
    private fun cancelOtherActivePointers() {
        if (pointers.size() == 0) return
        for (i in 0 until pointers.size()) {
            val state = pointers.valueAt(i)
            state.longPressRunnable?.let { longPressHandler.removeCallbacks(it) }
        }
        pointers.clear()
        overlay?.clearAll()
        deleteRepeater.cancel()
    }

    private fun anyPointerOwnsVariants(): Boolean {
        for (i in 0 until pointers.size()) {
            if (pointers.valueAt(i).ownsVariants) return true
        }
        return false
    }

    private fun anyPointerOwnsDeleteRepeat(): Boolean {
        for (i in 0 until pointers.size()) {
            if (pointers.valueAt(i).ownsDeleteRepeat) return true
        }
        return false
    }

    private fun logTouchLatency(state: PointerState, keyType: EchosKeyboardLayout.KeyType) {
        if (state.touchDownNs == 0L) return
        if (!Log.isLoggable(PERF_TAG, Log.DEBUG)) return
        val latencyMs = (System.nanoTime() - state.touchDownNs) / 1_000_000
        Log.d(PERF_TAG, "touch→commit: ${latencyMs}ms ($keyType)")
    }

    private fun scheduleAccentLongPress(
        state: PointerState,
        keyRect: RectF,
        key: EchosKeyboardLayout.Key,
    ) {
        val anchorRect = RectF(keyRect)
        val runnable = Runnable {
            val variants = AccentVariants.variants(
                key.label,
                shiftState.isShifted,
            )
            if (variants.isNotEmpty()) {
                // The popup takes over visual feedback for the rest of the
                // press, so this pointer claims the variants slot and
                // releases its pressed-state highlight.
                state.longPressFired = true
                state.ownsVariants = true
                overlay?.showVariants(anchorRect, variants, state.lastX)
                invalidate()
            }
        }
        state.longPressRunnable = runnable
        longPressHandler.postDelayed(runnable, LONG_PRESS_THRESHOLD_MS)
    }

    /// Long-press the period key -> punctuation more-keys popup (LatinIME
    /// §3.11). Reuses the accent-variants popup + slide-pick machinery.
    private fun schedulePunctuationLongPress(state: PointerState, keyRect: RectF) {
        val anchorRect = RectF(keyRect)
        val runnable = Runnable {
            state.longPressFired = true
            state.ownsVariants = true
            overlay?.showVariants(anchorRect, AccentVariants.punctuationForPeriod(), state.lastX)
            invalidate()
        }
        state.longPressRunnable = runnable
        longPressHandler.postDelayed(runnable, LONG_PRESS_THRESHOLD_MS)
    }

    private fun scheduleGlobeLongPress(state: PointerState) {
        val runnable = Runnable {
            state.longPressFired = true
            listener?.onShowKeyboardPicker()
        }
        state.longPressRunnable = runnable
        longPressHandler.postDelayed(runnable, LONG_PRESS_THRESHOLD_MS)
    }

    private fun scheduleEmojiLongPress(state: PointerState) {
        val runnable = Runnable {
            state.longPressFired = true
            listener?.onEmojiPress()
        }
        state.longPressRunnable = runnable
        longPressHandler.postDelayed(runnable, LONG_PRESS_THRESHOLD_MS)
    }

    /// Long-press shift -> caps-lock (LatinIME pattern at 1200 ms). The
    /// release handler ignores the tap when `longPressFired` is set, so
    /// caps-lock sticks after the user lifts.
    private fun scheduleShiftLongPress(state: PointerState) {
        val runnable = Runnable {
            state.longPressFired = true
            shiftState = ShiftState.CAPS_LOCK
            lastShiftTapAt = 0L
            invalidate()
        }
        state.longPressRunnable = runnable
        longPressHandler.postDelayed(runnable, SHIFT_LONG_PRESS_TO_LOCK_MS)
    }

    private fun dpPx(value: Float): Float =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            resources.displayMetrics,
        )

    /// Returns `(rowIdx shl 16) or colIdx` for the key whose rect contains
    /// the touch, or — when the touch lands in the inter-key gap — the
    /// nearest key in the row that vertically contains the touch. Returns
    /// `-1` only when no row is close enough.
    ///
    /// Without this fallback the ~6dp horizontal gap between keys is a
    /// literal dead zone: `contains(x, y)` misses, `handlePointerDown`
    /// returns early, and the entire press is lost — which the user feels
    /// as "the keyboard skipped a key" especially after a few words of
    /// fast roll-typing where gap-landings statistically accumulate.
    ///
    /// Constraining the nearest search to the touch's row keeps a slightly
    /// low thumb from snapping up to the row above. This mirrors the iOS
    /// `hitTestKeyButton` fix and Archagon's `ForwardingView.findNearestView`.
    private fun findKey(x: Float, y: Float): Int {
        // Fast path: direct hit. Uses `hitRects` (edge-extended) so taps in
        // the outer padding land on the nearest edge key.
        val cells = currentCells
        for (rowIdx in hitRects.indices) {
            // NUMPAD VERTICAL_STACK cells lay out *all* operator keys —
            // including the overflow ones (e.g. "(", ")") that only
            // appear after the user scrolls the column. Those overflow
            // rects extend below the visible band and would otherwise
            // claim hits that belong to the row 3 cell sitting under
            // the stack (the ABC mode-switch). Clip hit-testing to the
            // cell's [cellBounds] band so an unscrolled tap on ABC
            // doesn't fall through to "(".
            val band = if (cells != null) {
                val cell = cells.getOrNull(rowIdx)
                if (cell?.layout == EchosKeyboardLayout.CellLayout.VERTICAL_STACK) {
                    cellBounds.getOrNull(rowIdx)
                } else null
            } else null
            if (band != null && (y < band.top || y > band.bottom)) continue
            for (colIdx in hitRects[rowIdx].indices) {
                if (hitRects[rowIdx][colIdx].contains(x, y)) {
                    return (rowIdx shl 16) or colIdx
                }
            }
        }

        // Pick the row whose vertical band the touch lies in, or the row
        // with the nearest vertical edge if the touch is between rows.
        // In NUMPAD (column mode), the outer index is a column, so we
        // pick by horizontal proximity instead.
        // NUMPAD (cell-based) has 4 visual rows just like row-based
        // layouts, so the row-major nearest-row fallback works. The
        // direct-hit path covers most touches; this fallback only fires
        // when a touch lands in inter-cell space.
        val candidateRow = nearestRowIndex(y)
        if (candidateRow < 0) return -1

        // Find the nearest key in that row by squared distance-to-rect.
        var bestCol = -1
        var bestDistSq = Float.MAX_VALUE
        val row = hitRects[candidateRow]
        for (colIdx in row.indices) {
            val r = row[colIdx]
            val dx = when {
                x < r.left -> r.left - x
                x > r.right -> x - r.right
                else -> 0f
            }
            val dy = when {
                y < r.top -> r.top - y
                y > r.bottom -> y - r.bottom
                else -> 0f
            }
            val d = dx * dx + dy * dy
            if (d < bestDistSq) {
                bestDistSq = d
                bestCol = colIdx
            }
        }
        if (bestCol < 0) return -1

        // Cap the snap distance so far-off touches still fall through
        // (e.g. a thumb that scrolled past the keyboard onto the suggestion
        // bar). ~1.5 × the key's smaller side, in squared form.
        val cap = row[bestCol].height() * 1.5f
        if (bestDistSq > cap * cap) return -1

        return (candidateRow shl 16) or bestCol
    }

    /// Index of the row whose vertical span best matches `y`; falls back
    /// to the row with the nearest vertical edge if the touch is between
    /// rows. Returns -1 only when `hitRects` is empty. Uses the edge-extended
    /// hit rects so the top/bottom rows' bands reach the keyboard edges, plus
    /// a small per-row sweet-spot bias (§1.5) that nudges the effective Y down
    /// on the lower rows so an ambiguous inter-row tap resolves to the
    /// intended lower row instead of snapping up.
    private fun nearestRowIndex(y: Float): Int {
        if (hitRects.isEmpty()) return -1
        var bestRow = -1
        var bestDist = Float.MAX_VALUE
        for (rowIdx in hitRects.indices) {
            val rowRects = hitRects[rowIdx]
            if (rowRects.isEmpty()) continue
            val ref = rowRects[0]
            val effY = y + rowYBias(rowIdx, ref.height())
            val d = when {
                effY < ref.top -> ref.top - effY
                effY > ref.bottom -> effY - ref.bottom
                else -> 0f
            }
            if (d < bestDist) {
                bestDist = d
                bestRow = rowIdx
            }
        }
        return bestRow
    }

    /// Per-row sweet-spot Y bias (§1.5): fractions of row height mirroring
    /// LatinIME's touch-position correction (top ~0, mid 0.038, bottom
    /// 0.088), indexed by QWERTY letter row. Pulls ambiguous inter-row taps
    /// toward the intended lower row.
    private fun rowYBias(rowIdx: Int, rowHeight: Float): Float = when (rowIdx) {
        1 -> 0.038f * rowHeight
        2 -> 0.088f * rowHeight
        else -> 0f
    }

    private fun handleKeyAction(key: EchosKeyboardLayout.Key) {
        when (key.type) {
            EchosKeyboardLayout.KeyType.CHARACTER -> {
                val char = if (shiftState.isShifted) key.label.uppercase() else key.label
                listener?.onKeyPress(char)
                dropTransientShiftAfterCharacterCommit()
                markSymbolTypedIfApplicable()
            }
            EchosKeyboardLayout.KeyType.DELETE -> listener?.onDeletePress()
            EchosKeyboardLayout.KeyType.SPACE -> {
                listener?.onSpacePress()
                autoReturnToLettersIfApplicable()
            }
            EchosKeyboardLayout.KeyType.RETURN -> {
                listener?.onReturnPress()
                autoReturnToLettersIfApplicable()
            }
            EchosKeyboardLayout.KeyType.PERIOD -> {
                listener?.onKeyPress(".")
                markSymbolTypedIfApplicable()
            }
            EchosKeyboardLayout.KeyType.MIC -> listener?.onMicRelease()
            EchosKeyboardLayout.KeyType.EMOJI_COMMA -> {
                listener?.onKeyPress(",")
                markSymbolTypedIfApplicable()
            }
            EchosKeyboardLayout.KeyType.GLOBE -> listener?.onSwitchKeyboard()
            EchosKeyboardLayout.KeyType.SHIFT -> {
                // A live text selection turns shift into a recapitalize
                // gesture (§4.7); the service owns the InputConnection, so it
                // decides. Otherwise run the normal shift-state cycle.
                if (listener?.onShiftTap() != true) handleShiftTap()
            }
            EchosKeyboardLayout.KeyType.MODE_SWITCH -> {
                // Any still-held pointers' rowIdx/colIdx index into the old
                // layout — drop them before swapping `currentRows` so we
                // don't commit a stale (and probably wrong) key on release.
                cancelOtherActivePointers()
                typedNonSpaceInSymbols = false
                when (layoutMode) {
                    LayoutMode.LETTERS -> {
                        layoutMode = LayoutMode.NUMBERS
                        currentRows = EchosKeyboardLayout.NUMBER_ROWS
                        currentCells = null
                    }
                    LayoutMode.NUMBERS, LayoutMode.SYMBOLS, LayoutMode.NUMPAD -> {
                        layoutMode = LayoutMode.LETTERS
                        currentRows = EchosKeyboardLayout.LETTER_ROWS
                        currentCells = null
                    }
                }
                opScrollY = 0f
                keyRectsValid = false
                requestLayout()
                invalidate()
            }
            EchosKeyboardLayout.KeyType.SYMBOL_SWITCH -> {
                cancelOtherActivePointers()
                typedNonSpaceInSymbols = false
                when (layoutMode) {
                    LayoutMode.NUMBERS, LayoutMode.NUMPAD -> {
                        layoutMode = LayoutMode.SYMBOLS
                        currentRows = EchosKeyboardLayout.SYMBOL_ROWS
                        currentCells = null
                    }
                    LayoutMode.SYMBOLS -> {
                        layoutMode = LayoutMode.NUMBERS
                        currentRows = EchosKeyboardLayout.NUMBER_ROWS
                        currentCells = null
                    }
                    else -> {}
                }
                opScrollY = 0f
                keyRectsValid = false
                requestLayout()
                invalidate()
            }
            EchosKeyboardLayout.KeyType.NUMPAD_SWITCH -> {
                cancelOtherActivePointers()
                typedNonSpaceInSymbols = false
                // Tap from numbers/symbols -> calculator layout. Tap again
                // (from inside numpad) returns to numbers.
                if (layoutMode == LayoutMode.NUMPAD) {
                    layoutMode = LayoutMode.NUMBERS
                    currentRows = EchosKeyboardLayout.NUMBER_ROWS
                    currentCells = null
                } else {
                    layoutMode = LayoutMode.NUMPAD
                    currentCells = EchosKeyboardLayout.NUMPAD_CELLS
                }
                opScrollY = 0f
                keyRectsValid = false
                requestLayout()
                invalidate()
            }
        }
    }

    /** Latches "user committed a non-space symbol in 123/symbols". */
    private fun markSymbolTypedIfApplicable() {
        if (layoutMode == LayoutMode.NUMBERS || layoutMode == LayoutMode.SYMBOLS) {
            typedNonSpaceInSymbols = true
        }
    }

    /**
     * Auto-return to letters when the user committed a symbol then a
     * space or enter (§4.9). Guarded so two spaces in a row, or a
     * space immediately after entering symbols, don't flip layouts
     * unexpectedly. NUMPAD intentionally opts out — it's a dedicated
     * calculator surface and the user expects to stay.
     */
    private fun autoReturnToLettersIfApplicable() {
        if (!typedNonSpaceInSymbols) return
        if (layoutMode != LayoutMode.NUMBERS && layoutMode != LayoutMode.SYMBOLS) return
        cancelOtherActivePointers()
        typedNonSpaceInSymbols = false
        layoutMode = LayoutMode.LETTERS
        currentRows = EchosKeyboardLayout.LETTER_ROWS
        currentCells = null
        opScrollY = 0f
        keyRectsValid = false
        requestLayout()
        invalidate()
    }

    /**
     * LatinIME-style 6-state shift cycle on every tap, with a 300 ms
     * double-tap window that escalates to caps lock. Long-press shift
     * to caps lock is wired separately via [scheduleShiftLongPress].
     */
    private fun handleShiftTap() {
        val now = SystemClock.uptimeMillis()
        val withinDoubleTap = lastShiftTapAt != 0L &&
            (now - lastShiftTapAt) <= SHIFT_DOUBLE_TAP_WINDOW_MS
        lastShiftTapAt = now

        shiftState = when (shiftState) {
            ShiftState.OFF -> ShiftState.ON
            ShiftState.ON -> if (withinDoubleTap) ShiftState.CAPS_LOCK else ShiftState.OFF
            // User cancels the auto-shift; second tap in the window
            // escalates straight to caps lock.
            ShiftState.AUTOMATIC -> ShiftState.MANUAL_FROM_AUTO
            ShiftState.MANUAL_FROM_AUTO ->
                if (withinDoubleTap) ShiftState.CAPS_LOCK else ShiftState.ON
            ShiftState.CAPS_LOCK -> ShiftState.OFF
        }
        invalidate()
    }

    /**
     * Drops the transient one-shot shift states after any character
     * commit. Caps lock stays sticky.
     */
    private fun dropTransientShiftAfterCharacterCommit() {
        val next = when (shiftState) {
            ShiftState.ON, ShiftState.AUTOMATIC, ShiftState.MANUAL_FROM_AUTO ->
                ShiftState.OFF
            ShiftState.OFF, ShiftState.CAPS_LOCK -> shiftState
        }
        if (next != shiftState) {
            shiftState = next
            invalidate()
        }
        // Any non-shift key invalidates the double-tap window.
        lastShiftTapAt = 0L
    }

    /**
     * Drives the shift state from outside (the IME service calls this
     * from its auto-cap engine when the cursor sits at a sentence
     * boundary). A no-op when the user has made an explicit choice
     * (caps lock, manual on, or manual cancel of auto).
     */
    fun applyAutoShift(shouldCapitalize: Boolean) {
        when (shiftState) {
            ShiftState.CAPS_LOCK, ShiftState.ON, ShiftState.MANUAL_FROM_AUTO -> return
            ShiftState.OFF, ShiftState.AUTOMATIC -> {
                val next = if (shouldCapitalize) ShiftState.AUTOMATIC else ShiftState.OFF
                if (next != shiftState) {
                    shiftState = next
                    invalidate()
                }
            }
        }
    }

    /** Clears any pending double-tap state — called when the cursor moves. */
    fun resetShiftDoubleTap() {
        lastShiftTapAt = 0L
    }

    // -- Lifecycle --

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (Log.isLoggable(PERF_TAG, Log.DEBUG)) {
            lastFrameNs = 0L
            Choreographer.getInstance().postFrameCallback(perfFrameCallback)
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        Choreographer.getInstance().removeFrameCallback(perfFrameCallback)
        lastFrameNs = 0L
    }

    // -- Mic Pulse Animation --

    private fun startMicPulse() {
        stopMicPulse()
        micPulseAnimator = ObjectAnimator.ofFloat(this, "micPulseAlpha", 1f, 0.5f).apply {
            duration = 1000
            repeatMode = ObjectAnimator.REVERSE
            repeatCount = ObjectAnimator.INFINITE
            start()
        }
    }

    private fun stopMicPulse() {
        micPulseAnimator?.cancel()
        micPulseAnimator = null
        micPulseAlpha = 1f
    }

    @Suppress("unused") // Used by ObjectAnimator
    fun setMicPulseAlpha(alpha: Float) {
        micPulseAlpha = alpha
        invalidate()
    }

    @Suppress("unused")
    fun getMicPulseAlpha(): Float = micPulseAlpha

    // -- Accessibility --

    override fun onPopulateAccessibilityEvent(event: AccessibilityEvent) {
        super.onPopulateAccessibilityEvent(event)
        event.className = EchosKeyboardView::class.java.name
    }
}
