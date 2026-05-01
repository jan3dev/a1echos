import UIKit

/// Top bar pinned above the key rows. Shows the Echos logo on the left and a
/// record / stop button on the right. In a later phase the space between them
/// will host the three-wave-lines recording visualizer.
protocol KeyboardTopBarDelegate: AnyObject {
    func topBarDidTapRecord(_ topBar: KeyboardTopBar)
}

final class KeyboardTopBar: UIView {

    /// 8pt padding above + 40pt button + 8pt padding below — matches the
    /// internal "padding: 8px 24px" the design system uses on the button
    /// component itself.
    static let preferredHeight: CGFloat = 56

    weak var delegate: KeyboardTopBarDelegate?

    private let logoView = EchosLogoView()
    private let logoLabel = UILabel()
    private let recordButton = UIButton(type: .system)
    private let recordIcon = RecordButtonIconView()
    private let waveform = RecordingWaveformView()
    private var micState: MicState = .idle

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    private func setup() {
        translatesAutoresizingMaskIntoConstraints = false
        backgroundColor = .clear

        logoView.translatesAutoresizingMaskIntoConstraints = false
        logoView.contentMode = .scaleAspectFit
        logoView.tintColor = .label
        logoView.isUserInteractionEnabled = false
        addSubview(logoView)

        logoLabel.translatesAutoresizingMaskIntoConstraints = false
        logoLabel.text = "Echos"
        logoLabel.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
        logoLabel.textColor = .label
        logoLabel.isUserInteractionEnabled = false
        addSubview(logoLabel)

        // Record button — gray capsule (Figma "Echos Button"). The custom
        // icon view inside swaps between a microphone glyph (idle) and a
        // rounded stop rectangle (recording).
        recordButton.translatesAutoresizingMaskIntoConstraints = false
        recordButton.backgroundColor = UIColor(hex: 0x707171)
        recordButton.layer.cornerRadius = 20
        recordButton.layer.cornerCurve = .continuous
        recordButton.addTarget(self, action: #selector(recordTapped), for: .touchUpInside)
        recordButton.accessibilityLabel = "Record"
        recordButton.accessibilityTraits = [.button, .startsMediaSession]
        addSubview(recordButton)

        recordIcon.translatesAutoresizingMaskIntoConstraints = false
        recordIcon.isUserInteractionEnabled = false
        recordButton.addSubview(recordIcon)

        waveform.translatesAutoresizingMaskIntoConstraints = false
        waveform.isUserInteractionEnabled = false
        waveform.isHidden = true
        addSubview(waveform)

        NSLayoutConstraint.activate([
            logoView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            logoView.centerYAnchor.constraint(equalTo: centerYAnchor),
            logoView.widthAnchor.constraint(equalToConstant: 18),
            logoView.heightAnchor.constraint(equalToConstant: 24),

            logoLabel.leadingAnchor.constraint(equalTo: logoView.trailingAnchor, constant: 6),
            logoLabel.centerYAnchor.constraint(equalTo: centerYAnchor),

            recordButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            recordButton.centerYAnchor.constraint(equalTo: centerYAnchor),
            recordButton.widthAnchor.constraint(equalToConstant: 72),
            recordButton.heightAnchor.constraint(equalToConstant: 40),

            recordIcon.centerXAnchor.constraint(equalTo: recordButton.centerXAnchor),
            recordIcon.centerYAnchor.constraint(equalTo: recordButton.centerYAnchor),
            recordIcon.widthAnchor.constraint(equalToConstant: 24),
            recordIcon.heightAnchor.constraint(equalToConstant: 24),

            waveform.leadingAnchor.constraint(equalTo: logoLabel.trailingAnchor, constant: 8),
            waveform.trailingAnchor.constraint(equalTo: recordButton.leadingAnchor, constant: -8),
            waveform.centerYAnchor.constraint(equalTo: centerYAnchor),
            waveform.heightAnchor.constraint(equalToConstant: RecordingWaveformView.preferredHeight),
        ])

        applyMicState()
    }

    // MARK: - Public

    func setMicState(_ state: MicState) {
        guard state != micState else { return }
        micState = state
        applyMicState()
    }

    /// Latest recorder amplitude (0…1) — drives the wave lines' phase
    /// speed and amplitude while recording. No-op when the waveform is
    /// hidden, so the value can be pushed unconditionally from the
    /// recorder's metering loop.
    func setAudioLevel(_ level: Double) {
        waveform.setAudioLevel(level)
    }

    // MARK: - Private

    @objc private func recordTapped() {
        delegate?.topBarDidTapRecord(self)
    }

    private func applyMicState() {
        switch micState {
        case .idle:
            recordIcon.state = .microphone
            recordIcon.alpha = 1
            recordButton.isEnabled = true
            waveform.stopAnimating()
            waveform.isHidden = true
            recordButton.accessibilityLabel = "Start recording"
        case .recording:
            recordIcon.state = .stop
            recordIcon.alpha = 1
            recordButton.isEnabled = true
            waveform.setMode(.recording)
            waveform.isHidden = false
            waveform.startAnimating()
            recordButton.accessibilityLabel = "Stop recording"
        case .transcribing:
            // Mic glyph dimmed and button non-actionable while audio
            // finishes transcribing; the waveform keeps animating with
            // the breathing oscillation that mirrors `ThreeWaveLines`'
            // transcribing mode in the main app.
            recordIcon.state = .microphone
            recordIcon.alpha = 0.5
            recordButton.isEnabled = false
            waveform.setMode(.transcribing)
            waveform.isHidden = false
            waveform.startAnimating()
            recordButton.accessibilityLabel = "Transcribing"
        }
    }
}

// MARK: - Echos Logo

/// Draws the three-wave Echos mark from the app's `echos_icon.svg` (17 × 24).
/// Uses the view's `tintColor` as the fill so it adapts to light/dark.
final class EchosLogoView: UIView {

    override var tintColor: UIColor! {
        didSet { setNeedsDisplay() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }

        // Fit the 17×24 viewBox into the given rect preserving aspect.
        let scale = min(rect.width / 17.0, rect.height / 24.0)
        let tx = (rect.width - 17.0 * scale) / 2
        let ty = (rect.height - 24.0 * scale) / 2
        ctx.saveGState()
        ctx.translateBy(x: tx, y: ty)
        ctx.scaleBy(x: scale, y: scale)

        tintColor.setFill()

        // Path 1 — tallest wave, rightmost.
        let p1 = UIBezierPath()
        p1.move(to: CGPoint(x: 11.2321, y: 0.246083))
        p1.addCurve(to: CGPoint(x: 11.6493, y: 0.0703058),
                    controlPoint1: CGPoint(x: 11.2322, y: 0.0285701),
                    controlPoint2: CGPoint(x: 11.4934, y: -0.0814099))
        p1.addLine(to: CGPoint(x: 11.8403, y: 0.255457))
        p1.addCurve(to: CGPoint(x: 11.6399, y: 23.9338),
                    controlPoint1: CGPoint(x: 18.5274, y: 6.76556),
                    controlPoint2: CGPoint(x: 18.4363, y: 17.5378))
        p1.addCurve(to: CGPoint(x: 11.2321, y: 23.758),
                    controlPoint1: CGPoint(x: 11.4855, y: 24.0789),
                    controlPoint2: CGPoint(x: 11.2325, y: 23.9699))
        p1.close()
        p1.fill()

        // Path 2 — middle wave.
        let p2 = UIBezierPath()
        p2.move(to: CGPoint(x: 5.12565, y: 2.81243))
        p2.addCurve(to: CGPoint(x: 5.5276, y: 2.62845),
                    controlPoint1: CGPoint(x: 5.12565, y: 2.60438),
                    controlPoint2: CGPoint(x: 5.37003, y: 2.49261))
        p2.addLine(to: CGPoint(x: 5.67525, y: 2.755))
        p2.addCurve(to: CGPoint(x: 5.51939, y: 21.4178),
                    controlPoint1: CGPoint(x: 11.3973, y: 7.6893),
                    controlPoint2: CGPoint(x: 11.3233, y: 16.58))
        p2.addCurve(to: CGPoint(x: 5.12565, y: 21.2338),
                    controlPoint1: CGPoint(x: 5.36327, y: 21.5478),
                    controlPoint2: CGPoint(x: 5.12601, y: 21.4369))
        p2.close()
        p2.fill()

        // Path 3 — innermost wave (leftmost).
        let p3 = UIBezierPath()
        p3.move(to: CGPoint(x: 0.130075, y: 7.2795))
        p3.addCurve(to: CGPoint(x: 0.128903, y: 17.0996),
                    controlPoint1: CGPoint(x: 5.00437, y: 8.74904),
                    controlPoint2: CGPoint(x: 5.01631, y: 15.6748))
        p3.addCurve(to: CGPoint(x: 0, y: 17.0035),
                    controlPoint1: CGPoint(x: 0.0648451, y: 17.1182),
                    controlPoint2: CGPoint(x: 0.000189691, y: 17.0701))
        p3.addLine(to: CGPoint(x: 0, y: 7.37559))
        p3.addCurve(to: CGPoint(x: 0.130075, y: 7.2795),
                    controlPoint1: CGPoint(x: 0.0, y: 7.30818),
                    controlPoint2: CGPoint(x: 0.0655311, y: 7.26005))
        p3.close()
        p3.fill()

        ctx.restoreGState()
    }
}

// MARK: - Record Button Icon

/// Icon shown inside the gray "Echos Button" pill on the top bar. Renders
/// the Figma `microphone-2` glyph (idle) or a stop rectangle (recording).
/// Both shapes are drawn into a 24 × 24 box; coordinates come straight
/// from the Figma SVG export so the look matches the design system 1:1.
final class RecordButtonIconView: UIView {

    enum State {
        case microphone
        case stop
    }

    var state: State = .microphone {
        didSet {
            guard state != oldValue else { return }
            setNeedsDisplay()
        }
    }

    /// Glyph fill — Figma `#F5F5F8` (off-white) for idle mic, `#FEFEFE`
    /// (near-white) for the stop rectangle. They're visually equivalent at
    /// this size, so we use a single color.
    private let glyphColor = UIColor(hex: 0xF5F5F8)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        contentMode = .redraw
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    override func draw(_ rect: CGRect) {
        guard let ctx = UIGraphicsGetCurrentContext() else { return }
        ctx.saveGState()

        // Fit the 24×24 design space into `rect` preserving aspect.
        let scale = min(rect.width / 24.0, rect.height / 24.0)
        let tx = (rect.width - 24.0 * scale) / 2
        let ty = (rect.height - 24.0 * scale) / 2
        ctx.translateBy(x: tx, y: ty)
        ctx.scaleBy(x: scale, y: scale)

        glyphColor.setFill()

        switch state {
        case .microphone:
            drawMicrophone()
        case .stop:
            drawStopRectangle()
        }

        ctx.restoreGState()
    }

    /// Stop indicator — 16 × 16 rounded square centered in the 24-box.
    /// Mirrors the Figma SVG's single rounded-rect path.
    private func drawStopRectangle() {
        let rect = CGRect(x: 4, y: 4, width: 16, height: 16)
        UIBezierPath(roundedRect: rect, cornerRadius: 4).fill()
    }

    /// Microphone glyph from the design system's `microphone-2` icon.
    /// The Figma SVG places the glyph at offset (24, 8) inside a 72 × 40
    /// pill, so each path coordinate is shifted by (-24, -8) here to land
    /// inside our 24 × 24 box.
    private func drawMicrophone() {
        // Stand: outer "U" arc + stem at the bottom.
        let stand = UIBezierPath()
        stand.move(to: CGPoint(x: 11.2504, y: 22))
        stand.addLine(to: CGPoint(x: 11.2504, y: 19.7139))
        stand.addCurve(to: CGPoint(x: 3.6, y: 11.3496),
                       controlPoint1: CGPoint(x: 6.9665, y: 19.3337),
                       controlPoint2: CGPoint(x: 3.6, y: 15.7311))
        stand.addLine(to: CGPoint(x: 3.6, y: 9.6504))
        stand.addCurve(to: CGPoint(x: 4.35, y: 8.9004),
                       controlPoint1: CGPoint(x: 3.6, y: 9.2362),
                       controlPoint2: CGPoint(x: 3.9358, y: 8.9004))
        stand.addCurve(to: CGPoint(x: 5.1, y: 9.6504),
                       controlPoint1: CGPoint(x: 4.7642, y: 8.9004),
                       controlPoint2: CGPoint(x: 5.1, y: 9.2362))
        stand.addLine(to: CGPoint(x: 5.1, y: 11.3496))
        stand.addCurve(to: CGPoint(x: 12.0004, y: 18.25),
                       controlPoint1: CGPoint(x: 5.1, y: 15.1554),
                       controlPoint2: CGPoint(x: 8.1946, y: 18.25))
        stand.addCurve(to: CGPoint(x: 18.8998, y: 11.3496),
                       controlPoint1: CGPoint(x: 15.806, y: 18.2498),
                       controlPoint2: CGPoint(x: 18.8998, y: 15.1553))
        stand.addLine(to: CGPoint(x: 18.8998, y: 9.6504))
        stand.addCurve(to: CGPoint(x: 19.6498, y: 8.9004),
                       controlPoint1: CGPoint(x: 18.8998, y: 9.2362),
                       controlPoint2: CGPoint(x: 19.2357, y: 8.9005))
        stand.addCurve(to: CGPoint(x: 20.3998, y: 9.6504),
                       controlPoint1: CGPoint(x: 20.064, y: 8.9004),
                       controlPoint2: CGPoint(x: 20.3998, y: 9.2362))
        stand.addLine(to: CGPoint(x: 20.3998, y: 11.3496))
        stand.addCurve(to: CGPoint(x: 12.7504, y: 19.7139),
                       controlPoint1: CGPoint(x: 20.3998, y: 15.7309),
                       controlPoint2: CGPoint(x: 17.0338, y: 19.3334))
        stand.addLine(to: CGPoint(x: 12.7504, y: 22))
        stand.addCurve(to: CGPoint(x: 12.0004, y: 22.75),
                       controlPoint1: CGPoint(x: 12.7504, y: 22.4141),
                       controlPoint2: CGPoint(x: 12.4144, y: 22.7498))
        stand.addCurve(to: CGPoint(x: 11.2504, y: 22),
                       controlPoint1: CGPoint(x: 11.5862, y: 22.75),
                       controlPoint2: CGPoint(x: 11.2504, y: 22.4142))
        stand.close()
        stand.fill()

        // Mic head — built from four subpaths matching the Figma SVG and
        // filled with the even-odd rule so the inner body subtracts a rim
        // hole and the two grille subpaths punch back through it.
        let head = UIBezierPath()

        // Outer body capsule.
        head.move(to: CGPoint(x: 16.7504, y: 11.5))
        head.addCurve(to: CGPoint(x: 12.0004, y: 16.25),
                      controlPoint1: CGPoint(x: 16.7504, y: 14.1241),
                      controlPoint2: CGPoint(x: 14.6244, y: 16.2498))
        head.addCurve(to: CGPoint(x: 7.2504, y: 11.5),
                      controlPoint1: CGPoint(x: 9.3762, y: 16.25),
                      controlPoint2: CGPoint(x: 7.2504, y: 14.1242))
        head.addLine(to: CGPoint(x: 7.2504, y: 6))
        head.addCurve(to: CGPoint(x: 12.0004, y: 1.25),
                      controlPoint1: CGPoint(x: 7.2504, y: 3.3758),
                      controlPoint2: CGPoint(x: 9.3762, y: 1.25))
        head.addCurve(to: CGPoint(x: 16.7504, y: 6),
                      controlPoint1: CGPoint(x: 14.6244, y: 1.2502),
                      controlPoint2: CGPoint(x: 16.7504, y: 3.3759))
        head.addLine(to: CGPoint(x: 16.7504, y: 11.5))
        head.close()

        // Inner body — carves the rim out of the outer capsule.
        head.move(to: CGPoint(x: 15.2504, y: 6))
        head.addCurve(to: CGPoint(x: 12.0004, y: 2.75),
                      controlPoint1: CGPoint(x: 15.2504, y: 4.2043),
                      controlPoint2: CGPoint(x: 13.796, y: 2.7502))
        head.addCurve(to: CGPoint(x: 8.7504, y: 6),
                      controlPoint1: CGPoint(x: 10.2046, y: 2.75),
                      controlPoint2: CGPoint(x: 8.7504, y: 4.2042))
        head.addLine(to: CGPoint(x: 8.7504, y: 11.5))
        head.addCurve(to: CGPoint(x: 12.0004, y: 14.75),
                      controlPoint1: CGPoint(x: 8.7504, y: 13.2958),
                      controlPoint2: CGPoint(x: 10.2046, y: 14.75))
        head.addCurve(to: CGPoint(x: 15.2504, y: 11.5),
                      controlPoint1: CGPoint(x: 13.796, y: 14.7498),
                      controlPoint2: CGPoint(x: 15.2504, y: 13.2957))
        head.addLine(to: CGPoint(x: 15.2504, y: 6))
        head.close()

        // Lower grille line — fills back inside the rim cutout.
        head.move(to: CGPoint(x: 11.0082, y: 7.8252))
        head.addCurve(to: CGPoint(x: 13.0013, y: 7.8252),
                      controlPoint1: CGPoint(x: 11.6637, y: 7.652),
                      controlPoint2: CGPoint(x: 12.3458, y: 7.6521))
        head.addCurve(to: CGPoint(x: 13.5355, y: 8.7412),
                      controlPoint1: CGPoint(x: 13.4017, y: 7.9309),
                      controlPoint2: CGPoint(x: 13.641, y: 8.3409))
        head.addCurve(to: CGPoint(x: 12.6185, y: 9.2754),
                      controlPoint1: CGPoint(x: 13.4297, y: 9.1417),
                      controlPoint2: CGPoint(x: 13.019, y: 9.3811))
        head.addCurve(to: CGPoint(x: 11.392, y: 9.2754),
                      controlPoint1: CGPoint(x: 12.2142, y: 9.1686),
                      controlPoint2: CGPoint(x: 11.7963, y: 9.1686))
        head.addCurve(to: CGPoint(x: 10.475, y: 8.7412),
                      controlPoint1: CGPoint(x: 10.9915, y: 9.3812),
                      controlPoint2: CGPoint(x: 10.5808, y: 9.1417))
        head.addCurve(to: CGPoint(x: 11.0082, y: 7.8252),
                      controlPoint1: CGPoint(x: 10.3695, y: 8.341),
                      controlPoint2: CGPoint(x: 10.608, y: 7.9311))
        head.close()

        // Upper grille line.
        head.move(to: CGPoint(x: 10.3519, y: 5.7256))
        head.addCurve(to: CGPoint(x: 13.6478, y: 5.7256),
                      controlPoint1: CGPoint(x: 11.4184, y: 5.3346),
                      controlPoint2: CGPoint(x: 12.5813, y: 5.3346))
        head.addCurve(to: CGPoint(x: 14.0941, y: 6.6885),
                      controlPoint1: CGPoint(x: 14.0367, y: 5.8682),
                      controlPoint2: CGPoint(x: 14.2367, y: 6.2996))
        head.addCurve(to: CGPoint(x: 13.1322, y: 7.1338),
                      controlPoint1: CGPoint(x: 13.9515, y: 7.0772),
                      controlPoint2: CGPoint(x: 13.521, y: 7.2762))
        head.addCurve(to: CGPoint(x: 10.8685, y: 7.1338),
                      controlPoint1: CGPoint(x: 12.3991, y: 6.865),
                      controlPoint2: CGPoint(x: 11.6017, y: 6.8651))
        head.addCurve(to: CGPoint(x: 9.9056, y: 6.6885),
                      controlPoint1: CGPoint(x: 10.4797, y: 7.2764),
                      controlPoint2: CGPoint(x: 10.0483, y: 7.0773))
        head.addCurve(to: CGPoint(x: 10.3519, y: 5.7256),
                      controlPoint1: CGPoint(x: 9.763, y: 6.2996),
                      controlPoint2: CGPoint(x: 9.963, y: 5.8682))
        head.close()

        head.usesEvenOddFillRule = true
        head.fill()
    }
}

// MARK: - Recording Waveform

/// Three sine-curve lines that flow across the top bar while recording,
/// reacting to voice input via the recorder's metering loop. Mirrors the
/// main app's `ThreeWaveLines.tsx` (same per-wave profiles, smoothing and
/// color identity) so the brand visualizer reads identically inside the
/// keyboard. Each wave is a `CAShapeLayer` whose `path` is rebuilt every
/// frame from a `CADisplayLink` tick.
final class RecordingWaveformView: UIView {

    /// Active animation mode — `.recording` is the audio-reactive default
    /// while `.transcribing` switches to the slow phase-inverting breathing
    /// pattern that signals "processing" in `ThreeWaveLines.tsx`.
    enum Mode {
        case recording
        case transcribing
    }

    /// Per-wave styling and behaviour. Values match `WAVE_PROFILES` in
    /// `components/shared/recording-controls/ThreeWaveLines.tsx`.
    private struct WaveProfile {
        let basePhaseSpeed: Double
        let frequency: Double
        let verticalOffset: CGFloat
        let amplitudeMultiplier: Double
        let strokeWidth: CGFloat
        let energyFloor: Double
        let audioAmplitudeReactivity: Double
        let transcribingAmplitude: Double
        let transcribingPhaseOffset: Double
        let color: UIColor
    }

    private static let profiles: [WaveProfile] = [
        WaveProfile(basePhaseSpeed: 0.04, frequency: 2.2, verticalOffset: -3.2,
                    amplitudeMultiplier: 0.35, strokeWidth: 3.0,
                    energyFloor: 0.06, audioAmplitudeReactivity: 0.7,
                    transcribingAmplitude: 0.6, transcribingPhaseOffset: 0.0,
                    color: UIColor(hex: 0xF7931A)), // waveOrange
        WaveProfile(basePhaseSpeed: 0.07, frequency: 3.1, verticalOffset: 0.0,
                    amplitudeMultiplier: 0.55, strokeWidth: 2.8,
                    energyFloor: 0.05, audioAmplitudeReactivity: 1.0,
                    transcribingAmplitude: 0.7, transcribingPhaseOffset: .pi,
                    color: UIColor(hex: 0x5773EF)), // accentBrand
        WaveProfile(basePhaseSpeed: 0.09, frequency: 2.5, verticalOffset: 3.6,
                    amplitudeMultiplier: 0.75, strokeWidth: 2.5,
                    energyFloor: 0.04, audioAmplitudeReactivity: 0.55,
                    transcribingAmplitude: 0.8,
                    transcribingPhaseOffset: 2 * .pi / 3,
                    color: UIColor(hex: 0x16BAC5)), // waveCyan
    ]

    private static let pointCount = 60
    private static let baseMaxAmplitude: Double = 20.0
    private static let recordingMaxAmplitude: Double = 32.0
    private static let minAmplitude: Double = 2.0
    private static let voiceThreshold: Double = 0.38

    static let preferredHeight: CGFloat = 36

    private struct WaveState {
        var phase: Double
        var displayLevel: Double = 0
        var phaseSpeedMultiplier: Double = 0.6
        var smoothedBaseEnergy: Double = 0.5
        var smoothedAmplitudeMultiplier: Double
        var smoothedOpacity: Double = 1.0
        /// Seconds spent in transcribing mode — drives the slow `sin(t·π/3)`
        /// breathing oscillation. Resets back to 0 once the oscillation
        /// has fully decayed after leaving transcribing mode.
        var transcribingTime: Double = 0
        /// 0…1 ramp that fades the transcribing oscillation in and out so
        /// the transition from recording reads as smooth rather than
        /// snapping into an inverted wave.
        var oscillationStrength: Double = 0
    }

    private var states: [WaveState]
    private var shapeLayers: [CAShapeLayer] = []
    private var displayLink: CADisplayLink?
    private var lastFrameTime: CFTimeInterval = 0
    private var audioLevel: Double = 0
    private var mode: Mode = .recording

    override init(frame: CGRect) {
        // Seed phases with offsets of 0, π, 2π so the three waves start
        // out of phase rather than aligned in a flat line.
        states = (0..<Self.profiles.count).map { i in
            WaveState(
                phase: Double(i) * .pi,
                smoothedAmplitudeMultiplier: Self.profiles[i].amplitudeMultiplier
            )
        }
        super.init(frame: frame)
        backgroundColor = .clear
        isUserInteractionEnabled = false
        for profile in Self.profiles {
            let layer = CAShapeLayer()
            layer.fillColor = nil
            layer.strokeColor = profile.color.cgColor
            layer.lineWidth = profile.strokeWidth
            layer.lineCap = .round
            layer.lineJoin = .round
            self.layer.addSublayer(layer)
            shapeLayers.append(layer)
        }
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    deinit {
        // CADisplayLink retains its target — invalidate so the view can
        // actually dealloc if it's torn down mid-recording.
        displayLink?.invalidate()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        for layer in shapeLayers {
            layer.frame = bounds
        }
    }

    /// Latest input amplitude (0…1) from the recorder's metering loop.
    /// Stored as the next `tick` target — the per-frame smoother handles
    /// the lerp.
    func setAudioLevel(_ level: Double) {
        audioLevel = max(0, min(1, level))
    }

    /// Switch between the recording (audio-reactive) and transcribing
    /// (slow phase-inverting breathing) animations. Safe to call while
    /// the display link is running — the amplitude/opacity smoothers
    /// handle the cross-fade so the wave doesn't snap visually.
    func setMode(_ newMode: Mode) {
        mode = newMode
    }

    func startAnimating() {
        guard displayLink == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
        link.add(to: .main, forMode: .common)
        displayLink = link
        lastFrameTime = CACurrentMediaTime()
    }

    func stopAnimating() {
        displayLink?.invalidate()
        displayLink = nil
        audioLevel = 0
        mode = .recording
        // Reset per-wave smoothers so the next recording session starts
        // from a calm baseline rather than wherever the previous one
        // left off.
        for i in 0..<states.count {
            states[i].displayLevel = 0
            states[i].phaseSpeedMultiplier = 0.6
            states[i].smoothedBaseEnergy = 0.5
            states[i].smoothedAmplitudeMultiplier = Self.profiles[i].amplitudeMultiplier
            states[i].smoothedOpacity = 1.0
            states[i].transcribingTime = 0
            states[i].oscillationStrength = 0
        }
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        for layer in shapeLayers {
            layer.path = nil
            layer.opacity = 1.0
        }
        CATransaction.commit()
    }

    @objc private func tick(_ link: CADisplayLink) {
        let now = link.targetTimestamp
        let dt = now - lastFrameTime
        lastFrameTime = now
        // Normalise to a 30Hz reference frame so smoothing rates stay
        // consistent regardless of the device's display refresh.
        let dtFactor = dt / (1.0 / 30.0)

        let w = Double(bounds.width)
        let h = Double(bounds.height)
        guard w > 0, h > 0 else { return }

        let centerY = h / 2
        let pc = Self.pointCount
        let pointsMinusOne = Double(pc - 1)
        let baseRange = Self.baseMaxAmplitude - Self.minAmplitude
        let recordingRange = Self.recordingMaxAmplitude - Self.minAmplitude

        let isTranscribing = mode == .transcribing

        for (i, profile) in Self.profiles.enumerated() {
            var state = states[i]

            // Audio is irrelevant while transcribing — collapse the
            // displayLevel target so the recording-only "voice boost" and
            // amplitude bump stay quiet during the breathing animation.
            let target = isTranscribing ? 0 : audioLevel
            let diff = target - state.displayLevel
            let lerpSpeed = diff > 0 ? 0.08 : 0.04
            state.displayLevel = max(0, min(1.4,
                state.displayLevel + diff * lerpSpeed * dtFactor))

            // Phase speed: fast/loud while recording, drifts back to the
            // 0.6 base in idle/transcribing so the breathing reads slow.
            let targetSpeedMult = isTranscribing
                ? 0.6
                : 1.0 + state.displayLevel * 4.5
            let speedLerp = isTranscribing ? 0.04 : 0.08
            state.phaseSpeedMultiplier +=
                (targetSpeedMult - state.phaseSpeedMultiplier) * speedLerp * dtFactor

            let dl = state.displayLevel

            // Mode-specific targets for the three smoothed channels.
            // Recording: audio-reactive. Transcribing: pinned to the
            // profile's transcribing constants so all three waves pulse
            // together at half opacity.
            let targetEnergy: Double
            let targetAmpMult: Double
            let targetOpacity: Double
            if isTranscribing {
                targetEnergy = 1.0
                targetAmpMult = profile.transcribingAmplitude
                targetOpacity = 0.5
            } else {
                let voiceBoost = dl > Self.voiceThreshold
                    ? (dl - Self.voiceThreshold) * 0.5 * profile.audioAmplitudeReactivity
                    : 0
                let audioReactiveEnergy = max(0, min(1, dl))
                targetEnergy = min(1.2,
                    profile.energyFloor
                    + audioReactiveEnergy * profile.audioAmplitudeReactivity
                    + voiceBoost)
                targetAmpMult = profile.amplitudeMultiplier
                targetOpacity = 1.0
            }
            let smoothLerp = 0.08 * dtFactor
            state.smoothedBaseEnergy +=
                (targetEnergy - state.smoothedBaseEnergy) * smoothLerp
            state.smoothedAmplitudeMultiplier +=
                (targetAmpMult - state.smoothedAmplitudeMultiplier) * smoothLerp
            state.smoothedOpacity +=
                (targetOpacity - state.smoothedOpacity) * smoothLerp

            // Oscillation strength fades the breathing in over ~0.3s when
            // entering transcribing and back out when leaving, so the
            // crossfade with recording isn't jarring.
            if isTranscribing {
                state.transcribingTime += dt
                state.oscillationStrength = min(1.0,
                    state.oscillationStrength + 0.1 * dtFactor)
            } else if state.oscillationStrength > 0 {
                state.oscillationStrength = max(0,
                    state.oscillationStrength - 0.1 * dtFactor)
                if state.oscillationStrength == 0 {
                    state.transcribingTime = 0
                }
            }

            state.phase = (state.phase
                + profile.basePhaseSpeed * state.phaseSpeedMultiplier * dtFactor)
                .truncatingRemainder(dividingBy: 2 * .pi)

            states[i] = state

            // Build the curve.
            let path = UIBezierPath()
            let freqTwoPi = profile.frequency * 2 * .pi
            let baseEnergy = state.smoothedBaseEnergy
            let ampMult = state.smoothedAmplitudeMultiplier
            let phase = state.phase
            let edgePadding = max(2.0, Double(profile.strokeWidth))
            let adjustedCenterY = centerY + Double(profile.verticalOffset)
            let maxAmp = max(0, min(
                adjustedCenterY - edgePadding,
                h - adjustedCenterY - edgePadding
            ))

            // Slow sin(t·π/3) modulation per wave (with a per-wave phase
            // offset) flips the sine sign over time, producing the
            // "breathing" pulse that signals the transcribing state.
            let oscillation = sin(state.transcribingTime * .pi / 3.0
                + profile.transcribingPhaseOffset)
            let phaseInversion = 1.0
                + (oscillation - 1.0) * state.oscillationStrength

            var prevX: Double = 0
            var prevY: Double = adjustedCenterY

            for j in 0..<pc {
                let normalizedX = Double(j) / pointsMinusOne
                let x = normalizedX * w

                let rawAmplitude = baseEnergy * ampMult
                let normalizedAmplitude = max(0, min(1, rawAmplitude))
                let recordingBoost = dl * (recordingRange - baseRange)
                let amplitudeRange = baseRange + recordingBoost
                let amplitude = min(maxAmp,
                    Self.minAmplitude + normalizedAmplitude * amplitudeRange)

                let sine = sin(freqTwoPi * normalizedX + phase)
                let energyFactor = 0.65 + normalizedAmplitude * 0.35
                let y = adjustedCenterY
                    + amplitude * energyFactor * sine * phaseInversion

                if j == 0 {
                    path.move(to: CGPoint(x: x, y: y))
                } else {
                    // Smooth cubic between adjacent samples — same 1/3, 2/3
                    // control points the Skia-rendered version uses.
                    let dx = x - prevX
                    let dy = y - prevY
                    path.addCurve(
                        to: CGPoint(x: x, y: y),
                        controlPoint1: CGPoint(x: prevX + dx * 0.33, y: prevY + dy * 0.33),
                        controlPoint2: CGPoint(x: prevX + dx * 0.66, y: prevY + dy * 0.66)
                    )
                }
                prevX = x
                prevY = y
            }

            CATransaction.begin()
            CATransaction.setDisableActions(true)
            shapeLayers[i].path = path.cgPath
            shapeLayers[i].opacity = Float(state.smoothedOpacity)
            CATransaction.commit()
        }
    }
}
