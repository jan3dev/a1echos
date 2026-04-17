package com.a1lab.echos.ime

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.AttributeSet
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
        fun onSpacePress()
        fun onReturnPress()
        fun onMicPress()
        fun onMicRelease()
        fun onSwitchKeyboard()
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
        val bgColor = when {
            key.type == EchosKeyboardLayout.KeyType.MIC -> {
                when (micState) {
                    MicState.RECORDING -> theme.micButtonRecording
                    MicState.TRANSCRIBING -> theme.micButtonBackground
                    MicState.IDLE -> theme.micButtonBackground
                }
            }
            key.type == EchosKeyboardLayout.KeyType.SHIFT ||
            key.type == EchosKeyboardLayout.KeyType.DELETE ||
            key.type == EchosKeyboardLayout.KeyType.MODE_SWITCH ||
            key.type == EchosKeyboardLayout.KeyType.SYMBOL_SWITCH ||
            key.type == EchosKeyboardLayout.KeyType.GLOBE -> {
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
    }

    // -- Touch Handling --

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                val hit = findKey(event.x, event.y)
                pressedKeyIndex = hit
                if (hit != null) {
                    performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    val key = currentRows[hit.first].keys[hit.second]
                    if (key.type == EchosKeyboardLayout.KeyType.MIC) {
                        listener?.onMicPress()
                    }
                }
                invalidate()
                return true
            }
            MotionEvent.ACTION_UP -> {
                val hit = pressedKeyIndex
                pressedKeyIndex = null
                if (hit != null) {
                    val key = currentRows[hit.first].keys[hit.second]
                    handleKeyAction(key)
                }
                invalidate()
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                pressedKeyIndex = null
                invalidate()
                return true
            }
        }
        return false
    }

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
