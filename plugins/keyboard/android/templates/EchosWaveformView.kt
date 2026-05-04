package com.a1lab.echos.ime

import android.content.Context
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Shader
import android.util.AttributeSet
import android.view.Choreographer
import android.view.View
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Three sine-curve lines that flow across the keyboard top bar. Mirrors the
 * iOS `RecordingWaveformView` and the main app's `ThreeWaveLines.tsx` — same
 * per-wave profiles, smoothing, color identity, and transcribing oscillation
 * — so the brand visualizer reads identically across all three surfaces.
 *
 * Driven by `Choreographer` (the Android equivalent of `CADisplayLink`).
 * Numeric design constants come from the JS reference and are scaled by
 * display density at use so the wave keeps the same physical size on every
 * device.
 */
class EchosWaveformView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

    /** Active animation mode — `RECORDING` is the audio-reactive default,
     *  `TRANSCRIBING` switches to the slow phase-inverting breathing
     *  pattern that signals "processing" in `ThreeWaveLines.tsx`. */
    enum class Mode { RECORDING, TRANSCRIBING }

    private data class WaveProfile(
        val basePhaseSpeed: Double,
        val frequency: Double,
        val verticalOffset: Float,
        val amplitudeMultiplier: Double,
        val strokeWidthDp: Float,
        val energyFloor: Double,
        val audioAmplitudeReactivity: Double,
        val transcribingAmplitude: Double,
        val transcribingPhaseOffset: Double,
        val color: Int,
    )

    private data class WaveState(
        var phase: Double,
        var displayLevel: Double = 0.0,
        var phaseSpeedMultiplier: Double = 0.6,
        var smoothedBaseEnergy: Double = 0.5,
        var smoothedAmplitudeMultiplier: Double,
        var smoothedOpacity: Double = 1.0,
        /** Seconds spent in transcribing mode — drives the slow
         *  `sin(t·π/3)` breathing oscillation. Resets back to 0 once the
         *  oscillation has fully decayed after leaving transcribing. */
        var transcribingTime: Double = 0.0,
        /** 0…1 ramp that fades the transcribing oscillation in and out so
         *  the transition from recording reads as smooth rather than
         *  snapping into an inverted wave. */
        var oscillationStrength: Double = 0.0,
    )

    private val density = resources.displayMetrics.density.toDouble()

    private val profiles = listOf(
        WaveProfile(
            basePhaseSpeed = 0.04, frequency = 2.2, verticalOffset = -3.2f,
            amplitudeMultiplier = 0.35, strokeWidthDp = 3.0f,
            energyFloor = 0.06, audioAmplitudeReactivity = 0.7,
            transcribingAmplitude = 0.6, transcribingPhaseOffset = 0.0,
            color = Color.parseColor("#F7931A"), // waveOrange
        ),
        WaveProfile(
            basePhaseSpeed = 0.07, frequency = 3.1, verticalOffset = 0.0f,
            amplitudeMultiplier = 0.55, strokeWidthDp = 3.0f,
            energyFloor = 0.05, audioAmplitudeReactivity = 1.0,
            transcribingAmplitude = 0.7, transcribingPhaseOffset = Math.PI,
            color = Color.parseColor("#5773EF"), // accentBrand
        ),
        WaveProfile(
            basePhaseSpeed = 0.09, frequency = 2.5, verticalOffset = 3.6f,
            amplitudeMultiplier = 0.75, strokeWidthDp = 3.0f,
            energyFloor = 0.04, audioAmplitudeReactivity = 0.55,
            transcribingAmplitude = 0.8,
            transcribingPhaseOffset = 2.0 * Math.PI / 3.0,
            color = Color.parseColor("#16BAC5"), // waveCyan
        ),
    )

    private val states = profiles.mapIndexed { i, p ->
        WaveState(
            phase = i.toDouble() * Math.PI,
            smoothedAmplitudeMultiplier = p.amplitudeMultiplier,
        )
    }.toMutableList()

    /// Sharp pass — never blurred. Visible only in the segments where the
    /// per-wave horizontal alpha gradient (see `sharpGradientColors`) is
    /// opaque. Combined with the blurred pass below, this produces the
    /// alternating crisp/blurred segments the Figma design uses along
    /// each wave.
    private val sharpPaints = profiles.map { p ->
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = p.strokeWidthDp * density.toFloat()
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            color = p.color
        }
    }

    /// Blurred pass — Gaussian-blurred 3px stroke, the Android equivalent
    /// of the Figma SVG's `feGaussianBlur stdDeviation=2.5`. Visible only
    /// in the segments where the inverse gradient is opaque.
    private val blurredPaints = profiles.map { p ->
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = p.strokeWidthDp * density.toFloat()
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            color = p.color
            maskFilter = BlurMaskFilter(
                BLUR_RADIUS_DP * density.toFloat(),
                BlurMaskFilter.Blur.NORMAL,
            )
        }
    }

    private val paths = profiles.map { Path() }

    @Volatile private var audioLevel: Double = 0.0
    private var mode: Mode = Mode.RECORDING

    private var animating = false
    private var lastFrameNs: Long = 0
    // Explicit type breaks the recursive type-inference loop caused by the
    // lambda referencing the property it initializes.
    private val frameCallback: Choreographer.FrameCallback =
        Choreographer.FrameCallback { now ->
            if (!animating) return@FrameCallback
            tick(now)
            Choreographer.getInstance().postFrameCallback(frameCallback)
        }

    init {
        // The waveform is a passive overlay — never steal touches from the
        // record button it sits next to.
        isClickable = false
        isFocusable = false
        setWillNotDraw(false)
        // `BlurMaskFilter` is unsupported on hardware-accelerated layers
        // before API 28 and silently degrades. Render this view via the
        // software pipeline so the halo looks identical on every device;
        // the cost (60Hz software paths × 3 strokes × 60 points) is well
        // within budget.
        setLayerType(LAYER_TYPE_SOFTWARE, null)
    }

    /** Latest input amplitude (0…1) from the recorder's metering loop.
     *  Stored as the next tick target — the per-frame smoother handles
     *  the lerp. Safe to call from the audio capture thread. */
    fun setAudioLevel(level: Double) {
        audioLevel = level.coerceIn(0.0, 1.0)
    }

    /** Switch between the recording (audio-reactive) and transcribing
     *  (slow phase-inverting breathing) animations. Safe to call while
     *  the choreographer is running — the amplitude/opacity smoothers
     *  handle the cross-fade so the wave doesn't snap visually. */
    fun setMode(newMode: Mode) {
        mode = newMode
    }

    fun startAnimating() {
        if (animating) return
        animating = true
        lastFrameNs = System.nanoTime()
        Choreographer.getInstance().postFrameCallback(frameCallback)
    }

    fun stopAnimating() {
        if (!animating) return
        animating = false
        Choreographer.getInstance().removeFrameCallback(frameCallback)
        audioLevel = 0.0
        mode = Mode.RECORDING
        for (i in states.indices) {
            val p = profiles[i]
            states[i] = WaveState(
                phase = i.toDouble() * Math.PI,
                smoothedAmplitudeMultiplier = p.amplitudeMultiplier,
            )
            paths[i].reset()
            sharpPaints[i].alpha = 255
            blurredPaints[i].alpha = 255
        }
        invalidate()
    }

    override fun onDetachedFromWindow() {
        stopAnimating()
        super.onDetachedFromWindow()
    }

    private fun tick(nowNs: Long) {
        val w = width.toDouble()
        val h = height.toDouble()
        if (w <= 0 || h <= 0) {
            // View hasn't been laid out yet — keep the loop alive and try
            // again next frame.
            invalidate()
            return
        }

        val dt = max(0.0, (nowNs - lastFrameNs) / 1_000_000_000.0)
        lastFrameNs = nowNs
        // Normalise to a 30Hz reference frame so smoothing rates stay
        // consistent regardless of the device's display refresh.
        val dtFactor = dt / (1.0 / 30.0)

        val centerY = h / 2.0
        val minAmplitude = MIN_AMPLITUDE * density
        val baseRange = (BASE_MAX_AMPLITUDE - MIN_AMPLITUDE) * density
        val recordingRange = (RECORDING_MAX_AMPLITUDE - MIN_AMPLITUDE) * density
        val isTranscribing = mode == Mode.TRANSCRIBING

        for (i in profiles.indices) {
            val profile = profiles[i]
            val state = states[i]

            // Audio is irrelevant while transcribing — collapse the
            // displayLevel target so the recording-only "voice boost" and
            // amplitude bump stay quiet during the breathing animation.
            val target = if (isTranscribing) 0.0 else audioLevel
            val diff = target - state.displayLevel
            val lerpSpeed = if (diff > 0) 0.08 else 0.04
            state.displayLevel = (state.displayLevel + diff * lerpSpeed * dtFactor)
                .coerceIn(0.0, 1.4)

            // Phase speed: fast/loud while recording, drifts back to the
            // 0.6 base in idle/transcribing so the breathing reads slow.
            val targetSpeedMult = if (isTranscribing) 0.6
            else 1.0 + state.displayLevel * 4.5
            val speedLerp = if (isTranscribing) 0.04 else 0.08
            state.phaseSpeedMultiplier +=
                (targetSpeedMult - state.phaseSpeedMultiplier) * speedLerp * dtFactor

            val dl = state.displayLevel

            // Mode-specific targets for the three smoothed channels.
            // Recording: audio-reactive. Transcribing: pinned to the
            // profile's transcribing constants so all three waves pulse
            // together at half opacity.
            val targetEnergy: Double
            val targetAmpMult: Double
            val targetOpacity: Double
            if (isTranscribing) {
                targetEnergy = 1.0
                targetAmpMult = profile.transcribingAmplitude
                targetOpacity = 0.4
            } else {
                val voiceBoost = if (dl > VOICE_THRESHOLD)
                    (dl - VOICE_THRESHOLD) * 0.5 * profile.audioAmplitudeReactivity
                else 0.0
                val audioReactiveEnergy = dl.coerceIn(0.0, 1.0)
                targetEnergy = (profile.energyFloor
                    + audioReactiveEnergy * profile.audioAmplitudeReactivity
                    + voiceBoost).coerceAtMost(1.2)
                targetAmpMult = profile.amplitudeMultiplier
                targetOpacity = FIGMA_OPACITY_CEILING
            }
            val smoothLerp = 0.08 * dtFactor
            state.smoothedBaseEnergy += (targetEnergy - state.smoothedBaseEnergy) * smoothLerp
            state.smoothedAmplitudeMultiplier +=
                (targetAmpMult - state.smoothedAmplitudeMultiplier) * smoothLerp
            state.smoothedOpacity += (targetOpacity - state.smoothedOpacity) * smoothLerp

            // Oscillation strength fades the breathing in over ~0.3s when
            // entering transcribing and back out when leaving, so the
            // crossfade with recording isn't jarring.
            if (isTranscribing) {
                state.transcribingTime += dt
                state.oscillationStrength =
                    (state.oscillationStrength + 0.1 * dtFactor).coerceAtMost(1.0)
            } else if (state.oscillationStrength > 0.0) {
                state.oscillationStrength =
                    (state.oscillationStrength - 0.1 * dtFactor).coerceAtLeast(0.0)
                if (state.oscillationStrength == 0.0) state.transcribingTime = 0.0
            }

            state.phase = (state.phase
                + profile.basePhaseSpeed * state.phaseSpeedMultiplier * dtFactor)
                .rem(2.0 * Math.PI)

            // Build the curve.
            val freqTwoPi = profile.frequency * 2.0 * Math.PI
            val baseEnergy = state.smoothedBaseEnergy
            val ampMult = state.smoothedAmplitudeMultiplier
            val phase = state.phase
            val edgePadding = max(2.0 * density, sharpPaints[i].strokeWidth.toDouble())
            val adjustedCenterY = centerY + profile.verticalOffset * density
            val maxAmp = max(0.0, min(
                adjustedCenterY - edgePadding,
                h - adjustedCenterY - edgePadding,
            ))

            // Slow sin(t·π/3) modulation per wave (with a per-wave phase
            // offset) flips the sine sign over time, producing the
            // "breathing" pulse that signals the transcribing state.
            val oscillation = sin(state.transcribingTime * Math.PI / 3.0
                + profile.transcribingPhaseOffset)
            val phaseInversion = 1.0 + (oscillation - 1.0) * state.oscillationStrength

            val path = paths[i]
            path.reset()

            var prevX = 0.0
            var prevY = adjustedCenterY

            for (j in 0 until POINT_COUNT) {
                val normalizedX = j.toDouble() / (POINT_COUNT - 1)
                val x = normalizedX * w

                val rawAmplitude = baseEnergy * ampMult
                val normalizedAmplitude = rawAmplitude.coerceIn(0.0, 1.0)
                val recordingBoost = dl * (recordingRange - baseRange)
                val amplitudeRange = baseRange + recordingBoost
                val amplitude = min(maxAmp,
                    minAmplitude + normalizedAmplitude * amplitudeRange)

                val sine = sin(freqTwoPi * normalizedX + phase)
                val energyFactor = 0.65 + normalizedAmplitude * 0.35
                val y = adjustedCenterY + amplitude * energyFactor * sine * phaseInversion

                if (j == 0) {
                    path.moveTo(x.toFloat(), y.toFloat())
                } else {
                    // Smooth cubic between adjacent samples — same 1/3, 2/3
                    // control points the Skia-rendered version uses.
                    val dx = x - prevX
                    val dy = y - prevY
                    path.cubicTo(
                        (prevX + dx * 0.33).toFloat(),
                        (prevY + dy * 0.33).toFloat(),
                        (prevX + dx * 0.66).toFloat(),
                        (prevY + dy * 0.66).toFloat(),
                        x.toFloat(), y.toFloat(),
                    )
                }
                prevX = x
                prevY = y
            }

            val alpha =
                (state.smoothedOpacity.coerceIn(0.0, FIGMA_OPACITY_CEILING) * 255.0).toInt()
            sharpPaints[i].alpha = alpha
            blurredPaints[i].alpha = alpha
        }

        invalidate()
    }

    /// When non-zero, fades the waveform's alpha from 0 at each horizontal
    /// edge to fully opaque at `edgeFadeFraction` from the edge. Used when
    /// the wave spans the full keyboard header so the logo and record
    /// button sit on a transparent fall-off behind them.
    private var edgeFadeFraction: Float = 0f
    private val maskPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
    }

    /** Enable a horizontal alpha gradient that fades the wave to
     *  transparent at both edges. `fraction` is the portion of the view
     *  width consumed by the fade on each side (e.g. 0.18 → wave is fully
     *  opaque between 18% and 82% of the width). Pass 0 to disable. */
    fun setEdgeFadeFraction(fraction: Float) {
        edgeFadeFraction = fraction.coerceIn(0f, 0.5f)
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        // Wrap the entire wave drawing in a single saveLayer when the edge
        // fade is enabled so the horizontal fade applies uniformly across
        // both the sharp and blurred passes.
        val outerLayer = if (edgeFadeFraction > 0f) {
            canvas.saveLayer(0f, 0f, w, h, null)
        } else {
            -1
        }

        for (i in paths.indices) {
            // Each wave gets its own off-screen layer so the per-pass
            // horizontal alpha gradient (sharp vs blurred) only masks
            // that wave's strokes, not the previously drawn ones.
            val sharpLayer = canvas.saveLayer(0f, 0f, w, h, null)
            canvas.drawPath(paths[i], sharpPaints[i])
            applyHorizontalGradientMask(
                canvas, w, h,
                GRADIENT_POSITIONS[i], SHARP_VISIBILITY[i],
                inverse = false,
            )
            canvas.restoreToCount(sharpLayer)

            val blurredLayer = canvas.saveLayer(0f, 0f, w, h, null)
            canvas.drawPath(paths[i], blurredPaints[i])
            applyHorizontalGradientMask(
                canvas, w, h,
                GRADIENT_POSITIONS[i], SHARP_VISIBILITY[i],
                inverse = true,
            )
            canvas.restoreToCount(blurredLayer)
        }

        if (outerLayer >= 0) {
            // Apply the edge fade across the composed wave image.
            maskPaint.shader = LinearGradient(
                0f, 0f, w, 0f,
                intArrayOf(Color.TRANSPARENT, Color.WHITE, Color.WHITE, Color.TRANSPARENT),
                floatArrayOf(0f, edgeFadeFraction, 1f - edgeFadeFraction, 1f),
                Shader.TileMode.CLAMP,
            )
            canvas.drawRect(0f, 0f, w, h, maskPaint)
            canvas.restoreToCount(outerLayer)
        }
    }

    /** Punch the previously drawn wave with a horizontal alpha gradient
     *  so it's only visible where `visibility` matches the requested
     *  pass (sharp or its inverse for the blurred pass). The visibility
     *  pattern carries the wave's two blurred-spot positions per
     *  `SHARP_VISIBILITY[i]`. */
    private fun applyHorizontalGradientMask(
        canvas: Canvas,
        w: Float,
        h: Float,
        positions: FloatArray,
        visibility: IntArray,
        inverse: Boolean,
    ) {
        val opaque = Color.WHITE
        val clear = Color.TRANSPARENT
        val colors = IntArray(visibility.size) { i ->
            val v = if (inverse) 1 - visibility[i] else visibility[i]
            if (v == 1) opaque else clear
        }
        maskPaint.shader = LinearGradient(
            0f, 0f, w, 0f, colors, positions, Shader.TileMode.CLAMP,
        )
        canvas.drawRect(0f, 0f, w, h, maskPaint)
    }

    companion object {
        private const val POINT_COUNT = 60
        private const val BASE_MAX_AMPLITUDE = 20.0
        private const val RECORDING_MAX_AMPLITUDE = 32.0
        private const val MIN_AMPLITUDE = 2.0
        private const val VOICE_THRESHOLD = 0.38
        /// Matches `BlurMask blur={2.5}` in `ThreeWaveLines.tsx` and the
        /// `feGaussianBlur stdDeviation=2.5` filter in the Figma source.
        private const val BLUR_RADIUS_DP = 2.5f
        /// Mirrors `opacity="0.8"` on the Figma group definition.
        private const val FIGMA_OPACITY_CEILING = 0.8

        /// Per-wave horizontal gradient stops + visibility pattern that
        /// drives which segments of the wave render as a sharp 3pt
        /// stroke vs. a Gaussian-blurred stroke. Each wave has TWO
        /// blurred spots at distinctly different x positions so the
        /// three lines never all soften at the same place. Mirrors
        /// `WAVE_GRADIENTS` in `ThreeWaveLines.tsx`.
        ///
        /// Approximate blur centers:
        ///   Wave 0 (orange): ~32%, ~92%
        ///   Wave 1 (blue) : ~10%, ~70%  (inverted pattern)
        ///   Wave 2 (cyan) : ~51%, ~88%
        private val GRADIENT_POSITIONS = arrayOf(
            floatArrayOf(0f, 0.18f, 0.25f, 0.40f, 0.55f, 0.75f, 0.85f, 1f),
            floatArrayOf(0f, 0.20f, 0.30f, 0.50f, 0.62f, 0.78f, 0.85f, 1f),
            floatArrayOf(0f, 0.32f, 0.45f, 0.58f, 0.65f, 0.72f, 0.80f, 0.92f),
        )
        private val SHARP_VISIBILITY = arrayOf(
            intArrayOf(1, 1, 0, 0, 1, 1, 0, 0),
            intArrayOf(0, 0, 1, 1, 0, 0, 1, 1),
            intArrayOf(1, 1, 0, 0, 1, 1, 0, 0),
        )
    }
}
