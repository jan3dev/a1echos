package com.a1lab.echos.ime

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat

/**
 * Horizontal bar rendered above the key rows. Left: Echos wave-mark logo +
 * "Echos" wordmark. Right: record / stop button that drives transcription.
 * Mirrors the iOS `KeyboardTopBar` so both platforms stay visually in sync.
 */
class EchosKeyboardTopBar @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : LinearLayout(context, attrs) {

    interface Listener {
        fun onRecordClick()
    }

    private val logoView: ImageView
    private val labelView: TextView
    private val recordButton: ImageButton
    private val recordBackground: GradientDrawable
    private val theme = KeyTheme(context)
    private var listener: Listener? = null
    private var micState: MicState = MicState.IDLE

    // Figma brand accent (#5773EF) and recording red (same as iOS
    // `scarlet500`). Kept literal so the top bar stays on-brand regardless
    // of the system Material You palette.
    private val brandAccent: Int = Color.parseColor("#5773EF")
    private val recordingRed: Int = Color.parseColor("#FF3B13")

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        val paddingPx = dim("keyboard_top_bar_horizontal_padding", 12)
        setPadding(paddingPx, 0, paddingPx, 0)

        val logoWidth = dim("keyboard_top_bar_logo_width", 18)
        val logoHeight = dim("keyboard_top_bar_logo_height", 24)
        logoView = ImageView(context).apply {
            layoutParams = LayoutParams(logoWidth, logoHeight)
            scaleType = ImageView.ScaleType.FIT_CENTER
            setImageResource(drawable("ic_echos_logo"))
            imageTintList = android.content.res.ColorStateList.valueOf(theme.keyText)
        }
        addView(logoView)

        labelView = TextView(context).apply {
            text = "Echos"
            setTextColor(theme.keyText)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
            val lp = LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT)
            lp.leftMargin = dim("key_horizontal_gap", 6)
            layoutParams = lp
        }
        addView(labelView)

        // Spacer to push the record button to the trailing edge.
        addView(
            View(context).apply {
                layoutParams = LayoutParams(0, 0, 1f)
            },
        )

        val recordSize = dim("keyboard_top_bar_record_size", 32)
        recordBackground = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dim("keyboard_top_bar_record_corner_radius", 16).toFloat()
            setColor(brandAccent)
        }
        recordButton = ImageButton(context).apply {
            layoutParams = LayoutParams(recordSize, recordSize)
            background = recordBackground
            imageTintList = android.content.res.ColorStateList.valueOf(Color.WHITE)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            val iconPad = (recordSize - dim("keyboard_top_bar_record_icon_size", 16)) / 2
            setPadding(iconPad, iconPad, iconPad, iconPad)
            contentDescription = "Start recording"
            setImageResource(drawable("ic_mic"))
            setOnClickListener { listener?.onRecordClick() }
        }
        addView(recordButton)
    }

    fun setListener(listener: Listener) {
        this.listener = listener
    }

    fun setMicState(state: MicState) {
        if (state == micState) return
        micState = state
        when (state) {
            MicState.IDLE -> {
                recordBackground.setColor(brandAccent)
                recordButton.setImageResource(drawable("ic_mic"))
                recordButton.contentDescription = "Start recording"
                recordButton.isEnabled = true
            }
            MicState.RECORDING -> {
                recordBackground.setColor(recordingRed)
                recordButton.setImageResource(drawable("ic_stop"))
                recordButton.contentDescription = "Stop recording"
                recordButton.isEnabled = true
            }
            MicState.TRANSCRIBING -> {
                recordBackground.setColor((brandAccent and 0x00FFFFFF) or 0xB0000000.toInt())
                recordButton.setImageResource(drawable("ic_mic"))
                recordButton.contentDescription = "Transcribing"
                recordButton.isEnabled = false
            }
        }
    }

    // --- helpers ---

    private fun dim(name: String, fallbackDp: Int): Int {
        val id = context.resources.getIdentifier(name, "dimen", context.packageName)
        return if (id != 0) {
            context.resources.getDimensionPixelSize(id)
        } else {
            TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                fallbackDp.toFloat(),
                context.resources.displayMetrics,
            ).toInt()
        }
    }

    private fun drawable(name: String): Int =
        context.resources.getIdentifier(name, "drawable", context.packageName)
}
