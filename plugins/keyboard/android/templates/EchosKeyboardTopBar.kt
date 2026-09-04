package com.a1lab.echos.ime

import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PathMeasure
import android.graphics.RectF
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout

/**
 * Horizontal bar rendered above the key rows. Right: record / stop button
 * that drives transcription, always visible. Left of it: the suggestion strip
 * while composing. Behind both: the animated three-wave-lines visualizer while
 * recording. Mirrors the iOS `KeyboardTopBar` so both platforms stay in sync.
 */
class EchosKeyboardTopBar @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : FrameLayout(context, attrs) {

    interface Listener {
        fun onRecordClick()
        /** A suggestion slot in the strip was tapped (§5.5). */
        fun onSuggestionTapped(slot: SuggestionSlot)
    }

    private val waveform: EchosWaveformView
    private val recordButton: ImageButton
    private val recordSpinner: ImageView
    /// Bright white border that rings the record button while recording and
    /// depletes counter-clockwise over the 30s recording cap, so the user can
    /// see when the keyboard will auto-stop and transcribe. Mirrors the iOS
    /// `KeyboardTopBar.countdownRing`.
    private val countdownRing: CountdownRingView
    /// Foreground row (suggestion strip + record button).
    private val foreground: LinearLayout
    /// Suggestion strip (§5.5). Invisible by default; shown left of the record
    /// button while composing a word, never while recording.
    private val suggestionStrip: SuggestionStripView
    /// Continuous rotation that drives the loading-spinner glyph while
    /// transcribing. Started/stopped with the view's visibility so the
    /// keyboard isn't paying for an animator while idle.
    private var spinnerAnimator: ObjectAnimator? = null
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
        // Paint the same opaque keyboard background under the bar so it
        // never goes transparent when the host app sits behind it (some
        // apps, and light-mode transitions, would otherwise let host content
        // bleed through here).
        setBackgroundColor(theme.keyboardBackground)

        val paddingPx = dim("keyboard_top_bar_horizontal_padding", 8)

        // Three-wave visualizer spans the full width of the bar so it can
        // sit behind the record button — the foreground row is added last
        // so it draws on top. 36dp matches the iOS waveform
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
            // behind the record button. 0.32 mirrors the iOS
            // `installEdgeFadeMask` default — the fade BEGINS well inside
            // of the button so the wave is already mostly transparent by
            // the time it reaches it.
            setEdgeFadeFraction(0.32f)
        }
        addView(waveform)

        // Foreground row: suggestion strip fills the left, record button on
        // the right.
        foreground = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(paddingPx, 0, paddingPx, 0)
            layoutParams = LayoutParams(
                LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT,
            )
        }
        addView(foreground)

        suggestionStrip = SuggestionStripView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.MATCH_PARENT, 1f,
            ).apply { marginEnd = paddingPx }
            visibility = INVISIBLE
            setListener { slot -> listener?.onSuggestionTapped(slot) }
        }
        foreground.addView(suggestionStrip)

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
            setOnClickListener {
                KeyFeedback.performKeyHaptic(it)
                listener?.onRecordClick()
            }
        }
        recordContainer.addView(recordButton)

        // Countdown ring overlay — same 72×40 footprint, rides the pill edge.
        countdownRing = CountdownRingView(context).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT,
            )
            cornerRadiusPx = dim("keyboard_top_bar_record_corner_radius", 20).toFloat()
            visibility = INVISIBLE
        }
        recordContainer.addView(countdownRing)

        // Loading spinner shown while transcribing — replaces the heavy
        // waveform animation in that state. Uses the design system's
        // `ic_spinner_loading` glyph rotated continuously by an
        // `ObjectAnimator`, so the visual matches the iOS keyboard and
        // the rest of the Echos app exactly.
        val spinnerSize = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, 20f, resources.displayMetrics,
        ).toInt()
        recordSpinner = ImageView(context).apply {
            setImageResource(drawable("ic_spinner_loading"))
            imageTintList = ColorStateList.valueOf(Color.WHITE)
            scaleType = ImageView.ScaleType.CENTER_INSIDE
            layoutParams = FrameLayout.LayoutParams(
                spinnerSize, spinnerSize, Gravity.CENTER,
            )
            visibility = INVISIBLE
        }
        recordContainer.addView(recordSpinner)
    }

    fun setListener(listener: Listener) {
        this.listener = listener
    }

    /**
     * Shows the suggestion strip left of the record button while the user
     * composes a word. Hides it for an empty list or while recording /
     * transcribing — voice capture always owns the bar. INVISIBLE (not GONE)
     * so the record button never shifts.
     */
    fun setSuggestions(slots: List<SuggestionSlot>) {
        if (slots.isEmpty() || micState != MicState.IDLE) {
            suggestionStrip.visibility = INVISIBLE
            return
        }
        suggestionStrip.setSlots(slots)
        suggestionStrip.visibility = VISIBLE
    }

    fun setMicState(state: MicState) {
        if (state == micState) return
        micState = state
        // Recording / transcribing always owns the bar — clear the suggestion
        // strip before applying visuals.
        suggestionStrip.visibility = INVISIBLE
        // Pill stays gray across all states (matches iOS); only the glyph
        // and its alpha change.
        recordBackground.setColor(pillColor)
        when (state) {
            MicState.IDLE -> {
                recordButton.setImageResource(drawable("ic_mic"))
                recordButton.imageAlpha = 0xFF
                recordButton.visibility = VISIBLE
                recordSpinner.visibility = INVISIBLE
                stopSpinnerAnimation()
                recordButton.contentDescription = "Start recording"
                recordButton.isEnabled = true
                waveform.stopAnimating()
                waveform.visibility = INVISIBLE
                countdownRing.stop()
                countdownRing.visibility = INVISIBLE
            }
            MicState.RECORDING -> {
                recordButton.setImageResource(drawable("ic_stop"))
                recordButton.imageAlpha = 0xFF
                recordButton.visibility = VISIBLE
                recordSpinner.visibility = INVISIBLE
                stopSpinnerAnimation()
                recordButton.contentDescription = "Stop recording"
                recordButton.isEnabled = true
                waveform.setMode(EchosWaveformView.Mode.RECORDING)
                waveform.visibility = VISIBLE
                waveform.startAnimating()
                countdownRing.visibility = VISIBLE
                countdownRing.start()
            }
            MicState.TRANSCRIBING -> {
                // Swap the mic glyph for the design-system spinner glyph
                // (rotating) and stop the waveform entirely. The
                // waveform's per-frame `BlurMaskFilter` + `LinearGradient`
                // masking is the heaviest thing the keyboard runs; a
                // simple rotated vector drawable is far cheaper and a
                // clearer signal that we're waiting.
                recordSpinner.visibility = VISIBLE
                startSpinnerAnimation()
                recordButton.setImageDrawable(null)
                recordButton.imageAlpha = 0x80
                recordButton.contentDescription = "Transcribing"
                recordButton.isEnabled = false
                waveform.stopAnimating()
                waveform.visibility = INVISIBLE
                countdownRing.stop()
                countdownRing.visibility = INVISIBLE
            }
        }
    }

    /** Latest input amplitude (0…1) from the recorder's metering loop.
     *  Forwarded to the waveform; safe to call from any thread. */
    fun setAudioLevel(level: Double) {
        waveform.setAudioLevel(level)
    }

    // --- helpers ---

    private fun startSpinnerAnimation() {
        if (spinnerAnimator?.isRunning == true) return
        spinnerAnimator?.cancel()
        spinnerAnimator = ObjectAnimator.ofFloat(recordSpinner, View.ROTATION, 0f, 360f).apply {
            duration = 1000L
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            start()
        }
    }

    private fun stopSpinnerAnimation() {
        spinnerAnimator?.cancel()
        spinnerAnimator = null
        recordSpinner.rotation = 0f
    }

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

/**
 * Bright white capsule border that starts full and depletes counter-clockwise
 * over the 30s recording cap. Mirrors the iOS `KeyboardTopBar.countdownRing`
 * (a `CAShapeLayer` animating `strokeEnd` 1 → 0) — including its
 * counter-clockwise depletion. A linear `ValueAnimator` drives `progress`.
 */
private class CountdownRingView(context: Context) : View(context) {

    /// Corner radius of the capsule, in px — set to match the record pill.
    var cornerRadiusPx: Float = 0f

    private val density = resources.displayMetrics.density
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.WHITE
        strokeWidth = RING_STROKE_DP * density
        strokeCap = Paint.Cap.ROUND
    }

    private val fullPath = Path()
    private val drawPath = Path()
    private val pathMeasure = PathMeasure()
    private var pathLength = 0f

    /// 1 = full ring, 0 = empty. Drives how much of `fullPath` is drawn.
    private var progress = 1f
    private var animator: ValueAnimator? = null

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        if (w <= 0 || h <= 0) return
        val inset = paint.strokeWidth / 2f
        val rect = RectF(inset, inset, w - inset, h - inset)
        val radius = (cornerRadiusPx - inset).coerceAtLeast(0f)
        fullPath.reset()
        // CW winding: depleting the segment tail (`getSegment(0, len*progress)`
        // shrinking 1 → 0) then sweeps the remaining stroke counter-clockwise,
        // matching the iOS ring's depletion direction.
        fullPath.addRoundRect(rect, radius, radius, Path.Direction.CW)
        pathMeasure.setPath(fullPath, false)
        pathLength = pathMeasure.length
    }

    fun start() {
        animator?.cancel()
        progress = 1f
        animator = ValueAnimator.ofFloat(1f, 0f).apply {
            duration = COUNTDOWN_DURATION_MS
            interpolator = LinearInterpolator()
            addUpdateListener {
                progress = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    fun stop() {
        animator?.cancel()
        animator = null
        progress = 1f
        invalidate()
    }

    override fun onDetachedFromWindow() {
        stop()
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        if (pathLength <= 0f || progress <= 0f) return
        drawPath.reset()
        pathMeasure.getSegment(0f, pathLength * progress, drawPath, true)
        canvas.drawPath(drawPath, paint)
    }

    companion object {
        private const val RING_STROKE_DP = 2.5f
        /// Mirrors `recordingMaxSeconds` (iOS) / `MAX_RECORDING_SECONDS`
        /// (Android transcriber) — the hard cap the ring counts down against.
        private const val COUNTDOWN_DURATION_MS = 30_000L
    }
}
