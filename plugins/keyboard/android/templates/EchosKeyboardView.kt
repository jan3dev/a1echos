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
    }

    private var listener: KeyboardActionListener? = null
    private var currentRows: List<EchosKeyboardLayout.Row> = EchosKeyboardLayout.LETTER_ROWS
    private var layoutMode: LayoutMode = LayoutMode.LETTERS
    private var shiftState: ShiftState = ShiftState.OFF
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
    )
    private val pointers = SparseArray<PointerState>()

    // Computed key rects for hit testing
    private val keyRects = mutableListOf<List<RectF>>()

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
        private const val LONG_PRESS_THRESHOLD_MS = 400L

        /// Tag used by the optional perf logger. Toggle on a connected
        /// device with `adb shell setprop log.tag.EchosImePerf DEBUG`.
        /// Off by default — `Log.isLoggable` is a fast check.
        private const val PERF_TAG = "EchosImePerf"

        /// 24ms ≈ 1.5× a 60Hz vsync interval. Frames longer than this are
        /// what the user perceives as jank when typing.
        private const val SLOW_FRAME_NS = 24_000_000L
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

    enum class LayoutMode { LETTERS, NUMBERS, SYMBOLS }
    enum class ShiftState { OFF, ON, CAPS_LOCK }

    init {
        isFocusable = true
        isFocusableInTouchMode = true
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES

        loadDimensions()
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
        shiftState = ShiftState.OFF
        keyRectsValid = false
        invalidate()
    }

    fun showNumberLayout() {
        layoutMode = LayoutMode.NUMBERS
        currentRows = EchosKeyboardLayout.NUMBER_ROWS
        keyRectsValid = false
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
        val rowCount = currentRows.size
        val totalHeight = (rowCount * keyHeight + (rowCount - 1) * keyVGap + keyVGap + paddingBottom).toInt()
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

        for (rowIdx in currentRows.indices) {
            val row = currentRows[rowIdx]
            for (colIdx in row.keys.indices) {
                val key = row.keys[colIdx]
                val rect = keyRects[rowIdx][colIdx]
                drawKey(canvas, key, rect, isKeyPressed(rowIdx, colIdx))
            }
        }
        // Popups (preview balloon + accent variants) draw in `KeyOverlayView`,
        // not here — see `setOverlay` for the wiring.
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

    private fun computeKeyRects() {
        keyRects.clear()
        val availableWidth = width.toFloat() - 2 * paddingH
        var y = keyVGap / 2f

        for (row in currentRows) {
            val totalWeight = row.keys.sumOf { it.widthWeight.toDouble() }.toFloat()
            val totalGaps = (row.keys.size - 1) * keyHGap
            val unitWidth = (availableWidth - totalGaps) / totalWeight

            val rowRects = mutableListOf<RectF>()
            var x = paddingH

            for (key in row.keys) {
                val keyWidth = unitWidth * key.widthWeight
                rowRects.add(RectF(x, y, x + keyWidth, y + keyHeight))
                x += keyWidth + keyHGap
            }

            keyRects.add(rowRects)
            y += keyHeight + keyVGap
        }
    }

    private fun drawKey(canvas: Canvas, key: EchosKeyboardLayout.Key, rect: RectF, isPressed: Boolean) {
        // Shift becomes "active" while uppercase or caps-lock is engaged —
        // we light up its background (using the brighter regular-key tone)
        // so the user can tell at a glance which mode they're in.
        val isShiftActive = key.type == EchosKeyboardLayout.KeyType.SHIFT
            && shiftState != ShiftState.OFF
        val bgColor = when {
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
            key.type == EchosKeyboardLayout.KeyType.GLOBE ||
            key.type == EchosKeyboardLayout.KeyType.EMOJI -> {
                if (isPressed) theme.specialKeyBackgroundPressed else theme.specialKeyBackground
            }
            key.type == EchosKeyboardLayout.KeyType.RETURN -> {
                theme.micButtonBackground // Accent color for return
            }
            else -> {
                if (isPressed) theme.keyBackgroundPressed else theme.keyBackground
            }
        }

        keyPaint.color = bgColor
        canvas.drawRoundRect(rect, keyCornerRadius, keyCornerRadius, keyPaint)

        // Draw key label
        val textColor = when {
            key.type == EchosKeyboardLayout.KeyType.MIC ||
            key.type == EchosKeyboardLayout.KeyType.RETURN -> theme.micButtonIcon
            else -> theme.keyText
        }

        // Resolve the icon name first — shift swaps between `ic_shift` and
        // `ic_capslock` based on state; everything else uses the static
        // `iconName` from the key definition. Falling back to text if the
        // drawable can't be resolved keeps the keyboard usable on devices
        // where the resource hasn't been bundled for some reason.
        val iconName = when {
            key.type == EchosKeyboardLayout.KeyType.SHIFT && shiftState == ShiftState.CAPS_LOCK -> "ic_capslock"
            else -> key.iconName
        }
        val iconDrawable = iconName?.let { resolveIcon(it) }
        if (iconDrawable != null) {
            drawIcon(canvas, iconDrawable, rect, textColor)
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
            key.type == EchosKeyboardLayout.KeyType.CHARACTER && shiftState != ShiftState.OFF ->
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

            // Variants popover takes over the drag for its owning pointer —
            // forward and skip everything else (no row/col re-detection,
            // no drag-correct).
            if (state.ownsVariants && variantsActive) {
                ov?.updateVariantsHighlight(x, y)
                continue
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

            val newKey = currentRows[newRow].keys[newCol]
            val oldKey = currentRows[state.rowIdx].keys[state.colIdx]

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
            val displayLabel = if (shiftState != ShiftState.OFF) {
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
            type == EchosKeyboardLayout.KeyType.COMMA ||
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
        val key = currentRows[rowIdx].keys[colIdx]
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
        )
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
            EchosKeyboardLayout.KeyType.CHARACTER -> {
                val ch = if (shiftState != ShiftState.OFF) {
                    uppercaseLabelCache[key.label] ?: key.label.uppercase()
                } else {
                    key.label
                }
                // Latest pointer wins the preview balloon (overlay shows
                // only one at a time). The variants popup is exclusive too:
                // if another pointer already owns it, don't schedule a
                // competing long-press.
                overlay?.showPreview(ch, keyRect)
                if (AccentVariants.hasVariants(key.label) && !anyPointerOwnsVariants()) {
                    scheduleAccentLongPress(state, keyRect, key)
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

        val key = currentRows[state.rowIdx].keys[state.colIdx]

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
                if (shiftState == ShiftState.ON) {
                    shiftState = ShiftState.OFF
                }
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
                shiftState != ShiftState.OFF,
            )
            if (variants.isNotEmpty()) {
                // The popup takes over visual feedback for the rest of the
                // press, so this pointer claims the variants slot and
                // releases its pressed-state highlight.
                state.longPressFired = true
                state.ownsVariants = true
                overlay?.showVariants(anchorRect, variants)
                invalidate()
            }
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
        // Fast path: direct hit.
        for (rowIdx in keyRects.indices) {
            for (colIdx in keyRects[rowIdx].indices) {
                if (keyRects[rowIdx][colIdx].contains(x, y)) {
                    return (rowIdx shl 16) or colIdx
                }
            }
        }

        // Pick the row whose vertical band the touch lies in, or the row
        // with the nearest vertical edge if the touch is between rows.
        val candidateRow = nearestRowIndex(y)
        if (candidateRow < 0) return -1

        // Find the nearest key in that row by squared distance-to-rect.
        var bestCol = -1
        var bestDistSq = Float.MAX_VALUE
        val row = keyRects[candidateRow]
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

    /// Index of the row whose vertical span best matches `y`; falls back to
    /// the row with the nearest vertical edge if the touch is between rows.
    /// Returns -1 only when `keyRects` is empty.
    private fun nearestRowIndex(y: Float): Int {
        if (keyRects.isEmpty()) return -1
        var bestRow = -1
        var bestDist = Float.MAX_VALUE
        for (rowIdx in keyRects.indices) {
            val rowRects = keyRects[rowIdx]
            if (rowRects.isEmpty()) continue
            val ref = rowRects[0]
            if (y in ref.top..ref.bottom) return rowIdx
            val d = minOf(kotlin.math.abs(y - ref.top), kotlin.math.abs(y - ref.bottom))
            if (d < bestDist) {
                bestDist = d
                bestRow = rowIdx
            }
        }
        return bestRow
    }

    private fun handleKeyAction(key: EchosKeyboardLayout.Key) {
        when (key.type) {
            EchosKeyboardLayout.KeyType.CHARACTER -> {
                val char = if (shiftState != ShiftState.OFF) key.label.uppercase() else key.label
                listener?.onKeyPress(char)
                if (shiftState == ShiftState.ON) {
                    shiftState = ShiftState.OFF
                    invalidate()
                }
            }
            EchosKeyboardLayout.KeyType.DELETE -> listener?.onDeletePress()
            EchosKeyboardLayout.KeyType.SPACE -> listener?.onSpacePress()
            EchosKeyboardLayout.KeyType.RETURN -> listener?.onReturnPress()
            EchosKeyboardLayout.KeyType.COMMA -> listener?.onKeyPress(",")
            EchosKeyboardLayout.KeyType.PERIOD -> listener?.onKeyPress(".")
            EchosKeyboardLayout.KeyType.MIC -> listener?.onMicRelease()
            EchosKeyboardLayout.KeyType.EMOJI -> listener?.onEmojiPress()
            EchosKeyboardLayout.KeyType.GLOBE -> listener?.onSwitchKeyboard()
            EchosKeyboardLayout.KeyType.SHIFT -> {
                shiftState = when (shiftState) {
                    ShiftState.OFF -> ShiftState.ON
                    ShiftState.ON -> ShiftState.CAPS_LOCK
                    ShiftState.CAPS_LOCK -> ShiftState.OFF
                }
                invalidate()
            }
            EchosKeyboardLayout.KeyType.MODE_SWITCH -> {
                // Any still-held pointers' rowIdx/colIdx index into the old
                // layout — drop them before swapping `currentRows` so we
                // don't commit a stale (and probably wrong) key on release.
                cancelOtherActivePointers()
                when (layoutMode) {
                    LayoutMode.LETTERS -> {
                        layoutMode = LayoutMode.NUMBERS
                        currentRows = EchosKeyboardLayout.NUMBER_ROWS
                    }
                    LayoutMode.NUMBERS, LayoutMode.SYMBOLS -> {
                        layoutMode = LayoutMode.LETTERS
                        currentRows = EchosKeyboardLayout.LETTER_ROWS
                    }
                }
                keyRectsValid = false
                requestLayout()
                invalidate()
            }
            EchosKeyboardLayout.KeyType.SYMBOL_SWITCH -> {
                cancelOtherActivePointers()
                when (layoutMode) {
                    LayoutMode.NUMBERS -> {
                        layoutMode = LayoutMode.SYMBOLS
                        currentRows = EchosKeyboardLayout.SYMBOL_ROWS
                    }
                    LayoutMode.SYMBOLS -> {
                        layoutMode = LayoutMode.NUMBERS
                        currentRows = EchosKeyboardLayout.NUMBER_ROWS
                    }
                    else -> {}
                }
                keyRectsValid = false
                requestLayout()
                invalidate()
            }
        }
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
