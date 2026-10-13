package com.a1lab.echos.ime

import android.content.Context
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.graphics.Shader
import android.util.AttributeSet
import android.view.Choreographer
import android.view.View
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * Three sine-curve lines that flow across the keyboard top bar. Mirrors the
 * iOS `RecordingWaveformView` and the main app's `ThreeWaveLines.tsx` — same
 * per-wave profiles, smoothing and transcribing oscillation; color, stroke
 * and blur follow the keyboard DS Figma, matching the iOS keyboard.
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
            amplitudeMultiplier = 0.35, strokeWidthDp = 2.4375f,
            energyFloor = 0.06, audioAmplitudeReactivity = 0.7,
            transcribingAmplitude = 0.6, transcribingPhaseOffset = 0.0,
        ),
        WaveProfile(
            basePhaseSpeed = 0.07, frequency = 3.1, verticalOffset = 0.0f,
            amplitudeMultiplier = 0.55, strokeWidthDp = 2.4375f,
            energyFloor = 0.05, audioAmplitudeReactivity = 1.0,
            transcribingAmplitude = 0.7, transcribingPhaseOffset = Math.PI,
        ),
        WaveProfile(
            basePhaseSpeed = 0.09, frequency = 2.5, verticalOffset = 3.6f,
            amplitudeMultiplier = 0.75, strokeWidthDp = 2.4375f,
            energyFloor = 0.04, audioAmplitudeReactivity = 0.55,
            transcribingAmplitude = 0.8,
            transcribingPhaseOffset = 2.0 * Math.PI / 3.0,
        ),
    )

    private val states = profiles.mapIndexed { i, p ->
        WaveState(
            phase = i.toDouble() * Math.PI,
            smoothedAmplitudeMultiplier = p.amplitudeMultiplier,
        )
    }.toMutableList()

    /// Figma blurs each line progressively along its height (see
    /// `BLUR_RAMPS`). Approximated by crossfading a sharp and a fully blurred
    /// pass with a vertical alpha mask over the line's band.
    private val sharpPaints = profiles.map { p ->
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = p.strokeWidthDp * density.toFloat()
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
    }
    private val blurredPaints = profiles.map { p ->
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = p.strokeWidthDp * density.toFloat()
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
            maskFilter = BlurMaskFilter(
                BLUR_RADIUS_DP * density.toFloat(),
                BlurMaskFilter.Blur.NORMAL,
            )
        }
    }

    private val paths = profiles.map { Path() }

    /// Unit-length vertical gradients, one per wave, stretched onto each
    /// wave's band every frame via `setLocalMatrix` (no per-frame allocation).
    private val waveShaders = profiles.indices.map { i ->
        LinearGradient(
            0f, 0f, 0f, 1f,
            WAVE_LINE_GRADIENT, WAVE_LINE_GRADIENT_STOPS, Shader.TileMode.CLAMP,
        ).also {
            sharpPaints[i].shader = it
            blurredPaints[i].shader = it
        }
    }
    private val waveBands = profiles.map { RectF() }
    private val waveGradientMatrix = Matrix()

    /// Unit vertical alpha ramps (0 → 1) for the blur crossfade, mapped onto
    /// each band in `onDraw`.
    private val sharpMask = LinearGradient(
        0f, 0f, 0f, 1f, Color.WHITE, Color.TRANSPARENT, Shader.TileMode.CLAMP,
    )
    private val blurredMask = LinearGradient(
        0f, 0f, 0f, 1f, Color.TRANSPARENT, Color.WHITE, Shader.TileMode.CLAMP,
    )
    private val maskMatrix = Matrix()

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
            var prevSlope = 0.0

            for (j in 0 until POINT_COUNT) {
                val normalizedX = j.toDouble() / (POINT_COUNT - 1)
                val x = normalizedX * w

                val rawAmplitude = baseEnergy * ampMult
                val normalizedAmplitude = rawAmplitude.coerceIn(0.0, 1.0)
                val recordingBoost = dl * (recordingRange - baseRange)
                val amplitudeRange = baseRange + recordingBoost
                val amplitude = min(maxAmp,
                    minAmplitude + normalizedAmplitude * amplitudeRange)

                val theta = freqTwoPi * normalizedX + phase
                val energyFactor = 0.65 + normalizedAmplitude * 0.35
                val a = amplitude * energyFactor * phaseInversion
                val y = adjustedCenterY + a * sin(theta)
                val slope = a * cos(theta) * freqTwoPi / w

                if (j == 0) {
                    path.moveTo(x.toFloat(), y.toFloat())
                } else {
                    // Hermite cubic using the sine's exact slope at both ends,
                    // so crests stay round instead of faceting.
                    val third = (x - prevX) / 3.0
                    path.cubicTo(
                        (prevX + third).toFloat(),
                        (prevY + prevSlope * third).toFloat(),
                        (x - third).toFloat(),
                        (y - slope * third).toFloat(),
                        x.toFloat(), y.toFloat(),
                    )
                }
                prevX = x
                prevY = y
                prevSlope = slope
            }

            // Figma: the gradient starts at the wave's crest and spans twice
            // its crest-to-trough height, so crests read purple, troughs blue.
            val band = waveBands[i]
            path.computeBounds(band, true)
            waveGradientMatrix.setScale(1f, max(band.height(), 1f) * 2f)
            waveGradientMatrix.postTranslate(0f, band.top)
            waveShaders[i].setLocalMatrix(waveGradientMatrix)

            val alpha =
                (state.smoothedOpacity.coerceIn(0.0, FIGMA_OPACITY_CEILING) * 255.0).toInt()
            sharpPaints[i].alpha = alpha
            blurredPaints[i].alpha = alpha
        }

        invalidate()
    }

    /// When true, fades the wave in from the left edge and out before the
    /// record button (`EDGE_FADE_POSITIONS`). Used when the wave spans the
    /// full keyboard header.
    private var edgeFade = false
    private val maskPaint = Paint().apply {
        xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN)
    }

    fun setEdgeFade(enabled: Boolean) {
        edgeFade = enabled
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0f || h <= 0f) return

        // Wrap the wave drawing in a single saveLayer when the edge fade is
        // enabled so the horizontal fade applies across all three lines.
        val outerLayer = if (edgeFade) {
            canvas.saveLayer(0f, 0f, w, h, null)
        } else {
            -1
        }

        for (i in paths.indices) {
            val band = waveBands[i]
            val bandH = max(band.height(), 1f)
            val (start, end) = BLUR_RAMPS[i]
            maskMatrix.setScale(1f, (end - start) * bandH)
            maskMatrix.postTranslate(0f, band.top + start * bandH)
            drawMaskedPass(canvas, w, h, paths[i], sharpPaints[i], sharpMask)
            drawMaskedPass(canvas, w, h, paths[i], blurredPaints[i], blurredMask)
        }

        if (outerLayer >= 0) {
            // Apply the edge fade across the composed wave image.
            maskPaint.shader = LinearGradient(
                0f, 0f, w, 0f,
                intArrayOf(Color.TRANSPARENT, Color.WHITE, Color.WHITE, Color.TRANSPARENT),
                EDGE_FADE_POSITIONS,
                Shader.TileMode.CLAMP,
            )
            canvas.drawRect(0f, 0f, w, h, maskPaint)
            canvas.restoreToCount(outerLayer)
        }
    }

    private fun drawMaskedPass(
        canvas: Canvas, w: Float, h: Float, path: Path, paint: Paint, mask: Shader,
    ) {
        val layer = canvas.saveLayer(0f, 0f, w, h, null)
        canvas.drawPath(path, paint)
        mask.setLocalMatrix(maskMatrix)
        maskPaint.shader = mask
        canvas.drawRect(0f, 0f, w, h, maskPaint)
        canvas.restoreToCount(layer)
    }

    companion object {
        private const val POINT_COUNT = 60
        private const val BASE_MAX_AMPLITUDE = 20.0
        private const val RECORDING_MAX_AMPLITUDE = 32.0
        private const val MIN_AMPLITUDE = 2.0
        private const val VOICE_THRESHOLD = 0.38
        /// Figma `stdDeviation=2.03125`. Skia maps a `BlurMaskFilter` radius
        /// to sigma as 0.57735·r + 0.5, so r = (2.03125 − 0.5) / 0.57735.
        private const val BLUR_RADIUS_DP = 2.652f
        /// Mirrors `opacity="0.8"` on the Figma group definition.
        private const val FIGMA_OPACITY_CEILING = 0.8

        /// Figma progressive blur per line, as (sharp, fully blurred) offsets
        /// in the line's band (0 = crest, 1 = trough), linear in between:
        /// the small lines sharpen toward the crests, the big one toward the
        /// troughs.
        private val BLUR_RAMPS = arrayOf(0f to 1f, 0f to 1f, 1.0133f to 0.5067f)

        /// Figma "Transcription Waves" stroke gradient, same for all three
        /// lines: purple → blue → peach top to bottom.
        private val WAVE_LINE_GRADIENT = intArrayOf(
            Color.parseColor("#A54CFF"), Color.parseColor("#4588D2"), Color.parseColor("#FBCAB9"),
        )
        private val WAVE_LINE_GRADIENT_STOPS = floatArrayOf(0f, 0.5f, 1f)

        /// Figma "Waves" overlay: clear 12%–72%, fully faded from 81.25%.
        private val EDGE_FADE_POSITIONS = floatArrayOf(0f, 0.12f, 0.72f, 0.8125f)
    }
}
