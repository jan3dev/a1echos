package com.a1lab.echos.ime

import android.content.Context
import android.graphics.Color
import android.graphics.PorterDuff
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView

/**
 * Horizontal bar rendered above the key rows. Left: Echos wave-mark logo +
 * "Echos" wordmark. Center: animated three-wave-lines visualizer. Right:
 * record / stop button that drives transcription. Mirrors the iOS
 * `KeyboardTopBar` so both platforms stay visually in sync.
 */
class EchosKeyboardTopBar @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {

    interface Listener {
        fun onRecordClick()
    }

    private val logoView: ImageView
    private val labelView: TextView
    private val waveform: EchosWaveformView
    private val recordButton: ImageButton
    private val recordSpinner: ProgressBar
    private val recordBackground: GradientDrawable
    private val theme = KeyTheme(context)
    private var listener: Listener? = null
    private var micState: MicState = MicState.IDLE

    // Figma "Echos Button" gray pill (#707171) — matches the iOS
    // `KeyboardTopBar.recordButton.backgroundColor` exactly. The pill stays
    // gray across all states; only the inner glyph and an alpha dimming
    // signal recording vs transcribing.
    private val pillColor: Int = Color.parseColor("#707171")

    init {
        val paddingPx = dim("keyboard_top_bar_horizontal_padding", 12)

        // Three-wave visualizer spans the full width of the bar so it can
        // sit behind the logo and record button — the foreground row is
        // added last so it draws on top. 36dp matches the iOS waveform
        // height so amplitude clamping reads the same on both platforms.
        val waveformHeight = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, 36f, resources.displayMetrics,
        ).toInt()
        waveform = EchosWaveformView(context).apply {
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT, waveformHeight, Gravity.CENTER,
            )
            visibility = INVISIBLE
            // Fade to transparent at both edges so the wave reads cleanly
            // behind the logo and record button. 0.32 mirrors the iOS
            // `installEdgeFadeMask` default — the fade BEGINS well inside
            // of the logo/button so the wave is already mostly transparent
            // by the time it reaches the foreground controls.
            setEdgeFadeFraction(0.32f)
        }
        addView(waveform)

        // Foreground row: logo + wordmark on the left, record button on
        // the right. Wrapped in a horizontal `LinearLayout` so the inner
        // gravity stays consistent regardless of waveform state.
        val foreground = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(paddingPx, 0, paddingPx, 0)
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT,
            )
        }
        addView(foreground)

        val logoWidth = dim("keyboard_top_bar_logo_width", 18)
        val logoHeight = dim("keyboard_top_bar_logo_height", 24)
        logoView = ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(logoWidth, logoHeight)
            scaleType = ImageView.ScaleType.FIT_CENTER
            setImageResource(drawable("ic_echos_logo"))
            imageTintList = android.content.res.ColorStateList.valueOf(theme.keyText)
        }
        foreground.addView(logoView)

        labelView = TextView(context).apply {
            text = "Echos"
            setTextColor(theme.keyText)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = android.graphics.Typeface.create(
                android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD,
            )
            val lp = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT,
            )
            lp.leftMargin = dim("key_horizontal_gap", 6)
            layoutParams = lp
        }
        foreground.addView(labelView)

        // Spacer pushes the record button to the right edge — the waveform
        // beneath stays full-width so it spans the entire header.
        val spacer = View(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, 1f,
            )
        }
        foreground.addView(spacer)

        // 72×40 pill with 20dp corner radius — matches the iOS record button
        // shape so the keyboard reads as the same product on both platforms.
        val recordWidth = dim("keyboard_top_bar_record_width", 72)
        val recordHeight = dim("keyboard_top_bar_record_height", 40)
        val recordIconSize = dim("keyboard_top_bar_record_icon_size", 18)
        recordBackground = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dim("keyboard_top_bar_record_corner_radius", 20).toFloat()
            setColor(pillColor)
        }
        // Wrap the gray pill in a translucent-white ripple so taps register
        // visually even though the pill itself doesn't change color.
        val rippleColor = android.content.res.ColorStateList.valueOf(0x55FFFFFF)
        val rippleBackground = RippleDrawable(rippleColor, recordBackground, null)
        // Wrap the record button in a `FrameLayout` so the indeterminate
        // `ProgressBar` shown during transcription can stack on top of the
        // pill at the same 72×40 footprint without disturbing the
        // foreground row's `LinearLayout` flow.
        val recordContainer = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(recordWidth, recordHeight)
        }
        foreground.addView(recordContainer)

        recordButton = ImageButton(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            background = rippleBackground
            imageTintList = android.content.res.ColorStateList.valueOf(Color.WHITE)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            val padH = (recordWidth - recordIconSize) / 2
            val padV = (recordHeight - recordIconSize) / 2
            setPadding(padH, padV, padH, padV)
            contentDescription = "Start recording"
            setImageResource(drawable("ic_mic"))
            setOnClickListener { listener?.onRecordClick() }
        }
        recordContainer.addView(recordButton)

        // Indeterminate spinner shown while transcribing — replaces the
        // heavy waveform animation in that state. Built-in `ProgressBar`
        // is GPU-accelerated and effectively free compared to the
        // per-frame `BlurMaskFilter` + `LinearGradient` masking the
        // waveform runs.
        val spinnerSize = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, 20f, resources.displayMetrics,
        ).toInt()
        recordSpinner = ProgressBar(context).apply {
            isIndeterminate = true
            layoutParams = FrameLayout.LayoutParams(
                spinnerSize, spinnerSize, Gravity.CENTER,
            )
            indeterminateDrawable?.setColorFilter(
                Color.WHITE, PorterDuff.Mode.SRC_IN,
            )
            visibility = INVISIBLE
        }
        recordContainer.addView(recordSpinner)
    }

    fun setListener(listener: Listener) {
        this.listener = listener
    }

    fun setMicState(state: MicState) {
        if (state == micState) return
        micState = state
        // Pill stays gray across all states (matches iOS); only the glyph
        // and its alpha change.
        recordBackground.setColor(pillColor)
        when (state) {
            MicState.IDLE -> {
                recordButton.setImageResource(drawable("ic_mic"))
                recordButton.imageAlpha = 0xFF
                recordButton.visibility = VISIBLE
                recordSpinner.visibility = INVISIBLE
                recordButton.contentDescription = "Start recording"
                recordButton.isEnabled = true
                waveform.stopAnimating()
                waveform.visibility = INVISIBLE
            }
            MicState.RECORDING -> {
                recordButton.setImageResource(drawable("ic_stop"))
                recordButton.imageAlpha = 0xFF
                recordButton.visibility = VISIBLE
                recordSpinner.visibility = INVISIBLE
                recordButton.contentDescription = "Stop recording"
                recordButton.isEnabled = true
                waveform.setMode(EchosWaveformView.Mode.RECORDING)
                waveform.visibility = VISIBLE
                waveform.startAnimating()
            }
            MicState.TRANSCRIBING -> {
                // Swap the mic glyph for an indeterminate spinner and
                // stop the waveform entirely. The waveform's per-frame
                // `BlurMaskFilter` + `LinearGradient` masking is the
                // heaviest thing the keyboard runs; the spinner is both
                // cheaper and a clearer signal that we're waiting.
                recordSpinner.visibility = VISIBLE
                recordButton.setImageDrawable(null)
                recordButton.imageAlpha = 0x80
                recordButton.contentDescription = "Transcribing"
                recordButton.isEnabled = false
                waveform.stopAnimating()
                waveform.visibility = INVISIBLE
            }
        }
    }

    /** Latest input amplitude (0…1) from the recorder's metering loop.
     *  Forwarded to the waveform; safe to call from any thread. */
    fun setAudioLevel(level: Double) {
        waveform.setAudioLevel(level)
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
