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
import android.util.TypedValue
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
    private var pressedKeyIndex: Pair<Int, Int>? = null // (row, col)
    private var returnLabel: String = "\u23CE"

    // Computed key rects for hit testing
    private val keyRects = mutableListOf<List<RectF>>()

    // Paints
    private val keyPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val keyTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface = Typeface.DEFAULT
    }
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
    // nowhere visible to put their preview balloon.
    private val longPressHandler = Handler(Looper.getMainLooper())
    private var longPressRunnable: Runnable? = null
    /// True after the long-press timer fires for any key — lets ACTION_UP
    /// suppress the trailing single-tap action (e.g. globe long-press shows
    /// the IME picker; the release shouldn't also switch keyboards).
    private var longPressDidFire = false
    private var overlay: KeyOverlayView? = null

    private companion object {
        private const val LONG_PRESS_THRESHOLD_MS = 400L
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
        invalidate()
    }

    fun showNumberLayout() {
        layoutMode = LayoutMode.NUMBERS
        currentRows = EchosKeyboardLayout.NUMBER_ROWS
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

    // -- Drawing --

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        // Draw keyboard background
        backgroundPaint.color = theme.keyboardBackground
        canvas.drawRect(0f, 0f, width.toFloat(), height.toFloat(), backgroundPaint)

        computeKeyRects()

        for (rowIdx in currentRows.indices) {
            val row = currentRows[rowIdx]
            for (colIdx in row.keys.indices) {
                val key = row.keys[colIdx]
                val rect = keyRects[rowIdx][colIdx]
                val isPressed = pressedKeyIndex?.first == rowIdx && pressedKeyIndex?.second == colIdx
                drawKey(canvas, key, rect, isPressed)
            }
        }
        // Popups (preview balloon + accent variants) draw in `KeyOverlayView`,
        // not here — see `setOverlay` for the wiring.
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

        keyTextPaint.color = textColor
        keyTextPaint.textSize = when (key.type) {
            EchosKeyboardLayout.KeyType.MODE_SWITCH,
            EchosKeyboardLayout.KeyType.SYMBOL_SWITCH -> keyTextSizeSpecial
            else -> keyTextSize
        }

        val displayLabel = when {
            key.type == EchosKeyboardLayout.KeyType.RETURN -> returnLabel
            key.type == EchosKeyboardLayout.KeyType.CHARACTER && shiftState != ShiftState.OFF ->
                key.label.uppercase()
            else -> key.label
        }

        val textX = rect.centerX()
        val textY = rect.centerY() - (keyTextPaint.descent() + keyTextPaint.ascent()) / 2
        canvas.drawText(displayLabel, textX, textY, keyTextPaint)

        // Top-row letters carry a small number in the top-right corner so the
        // user knows long-pressing types it (Gboard convention). Skip when
        // shift is engaged because the character is already shown in caps.
        if (key.type == EchosKeyboardLayout.KeyType.CHARACTER) {
            val number = AccentVariants.numberFor(key.label)
            if (number != null) {
                keyTextPaint.color = theme.keyTextSecondary
                keyTextPaint.textSize = dpPx(10f)
                canvas.drawText(
                    number,
                    rect.right - dpPx(7f),
                    rect.top + dpPx(12f),
                    keyTextPaint,
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
        val sizePx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            22f,
            resources.displayMetrics,
        ).toInt()
        val cx = rect.centerX().toInt()
        val cy = rect.centerY().toInt()
        drawable.setBounds(cx - sizePx / 2, cy - sizePx / 2, cx + sizePx / 2, cy + sizePx / 2)
        drawable.setTint(tint)
        drawable.draw(canvas)
    }

    // -- Touch Handling --

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                val hit = findKey(event.x, event.y)
                pressedKeyIndex = hit
                if (hit != null) {
                    performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    val key = currentRows[hit.first].keys[hit.second]
                    val keyRect = keyRects[hit.first][hit.second]
                    when {
                        key.type == EchosKeyboardLayout.KeyType.MIC -> listener?.onMicPress()
                        key.type == EchosKeyboardLayout.KeyType.DELETE -> deleteRepeater.start()
                        key.type == EchosKeyboardLayout.KeyType.GLOBE -> scheduleGlobeLongPress()
                        key.type == EchosKeyboardLayout.KeyType.CHARACTER -> {
                            val ch = if (shiftState != ShiftState.OFF) key.label.uppercase() else key.label
                            overlay?.showPreview(ch, keyRect)
                            if (AccentVariants.hasVariants(key.label)) {
                                scheduleAccentLongPress(keyRect, key)
                            }
                        }
                    }
                }
                invalidate()
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                overlay?.takeIf { it.hasVariants() }?.updateVariantsHighlight(event.x, event.y)
                return true
            }
            MotionEvent.ACTION_UP -> {
                cancelAccentLongPress()
                overlay?.clearPreview()
                val overlay = this.overlay
                if (overlay != null && overlay.hasVariants()) {
                    val selected = overlay.selectedVariant()
                    overlay.clearVariants()
                    pressedKeyIndex = null
                    longPressDidFire = false
                    if (selected != null) {
                        listener?.onKeyPress(selected)
                        if (shiftState == ShiftState.ON) {
                            shiftState = ShiftState.OFF
                        }
                    }
                    invalidate()
                    return true
                }
                val hit = pressedKeyIndex
                pressedKeyIndex = null
                val didFireLongPress = longPressDidFire
                longPressDidFire = false
                if (hit != null) {
                    val key = currentRows[hit.first].keys[hit.second]
                    when {
                        key.type == EchosKeyboardLayout.KeyType.DELETE -> {
                            // If the hold timer fired one or more repeats, treat
                            // this as the release of an auto-repeat — skip the
                            // trailing single-tap delete so we don't double up.
                            val didRepeat = deleteRepeater.didRepeat
                            deleteRepeater.cancel()
                            if (!didRepeat) listener?.onDeletePress()
                        }
                        // Long-press already triggered (globe picker shown):
                        // skip the regular tap action.
                        didFireLongPress -> Unit
                        else -> handleKeyAction(key)
                    }
                }
                invalidate()
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                cancelAccentLongPress()
                longPressDidFire = false
                overlay?.clearAll()
                pressedKeyIndex = null
                deleteRepeater.cancel()
                invalidate()
                return true
            }
        }
        return false
    }

    private fun scheduleAccentLongPress(
        keyRect: RectF,
        key: EchosKeyboardLayout.Key,
    ) {
        cancelAccentLongPress()
        val anchorRect = RectF(keyRect)
        val runnable = Runnable {
            val variants = AccentVariants.variants(
                key.label,
                shiftState != ShiftState.OFF,
            )
            if (variants.isNotEmpty()) {
                // The popup takes over visual feedback for the rest of the
                // press, so suppress the pressed-state highlight.
                longPressDidFire = true
                pressedKeyIndex = null
                overlay?.showVariants(anchorRect, variants)
                invalidate()
            }
        }
        longPressRunnable = runnable
        longPressHandler.postDelayed(runnable, LONG_PRESS_THRESHOLD_MS)
    }

    private fun scheduleGlobeLongPress() {
        cancelAccentLongPress()
        val runnable = Runnable {
            longPressDidFire = true
            listener?.onShowKeyboardPicker()
        }
        longPressRunnable = runnable
        longPressHandler.postDelayed(runnable, LONG_PRESS_THRESHOLD_MS)
    }

    private fun cancelAccentLongPress() {
        longPressRunnable?.let { longPressHandler.removeCallbacks(it) }
        longPressRunnable = null
    }

    private fun dpPx(value: Float): Float =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            resources.displayMetrics,
        )

    private fun findKey(x: Float, y: Float): Pair<Int, Int>? {
        for (rowIdx in keyRects.indices) {
            for (colIdx in keyRects[rowIdx].indices) {
                if (keyRects[rowIdx][colIdx].contains(x, y)) {
                    return Pair(rowIdx, colIdx)
                }
            }
        }
        return null
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
                requestLayout()
                invalidate()
            }
            EchosKeyboardLayout.KeyType.SYMBOL_SWITCH -> {
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
                requestLayout()
                invalidate()
            }
        }
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
