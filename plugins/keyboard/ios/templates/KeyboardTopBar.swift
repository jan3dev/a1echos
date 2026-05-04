import CoreImage
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
    /// Replaces the waveform animation while transcribing — a built-in
    /// `UIActivityIndicatorView` is far cheaper than the per-frame
    /// `UIGraphicsImageRenderer` + `CIGaussianBlur` pipeline that the
    /// wave runs at 30fps.
    private let recordSpinner = UIActivityIndicatorView(style: .medium)
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

        recordSpinner.translatesAutoresizingMaskIntoConstraints = false
        recordSpinner.isUserInteractionEnabled = false
        recordSpinner.color = UIColor(hex: 0xF5F5F8) // matches mic glyph
        recordSpinner.hidesWhenStopped = true
        recordButton.addSubview(recordSpinner)

        waveform.translatesAutoresizingMaskIntoConstraints = false
        waveform.isUserInteractionEnabled = false
        waveform.isHidden = true
        // Insert the waveform behind the logo and record button so it can
        // span the full width of the header while the foreground controls
        // sit on top of its faded edges.
        insertSubview(waveform, at: 0)
        waveform.installEdgeFadeMask()

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

            recordSpinner.centerXAnchor.constraint(equalTo: recordButton.centerXAnchor),
            recordSpinner.centerYAnchor.constraint(equalTo: recordButton.centerYAnchor),

            waveform.leadingAnchor.constraint(equalTo: leadingAnchor),
            waveform.trailingAnchor.constraint(equalTo: trailingAnchor),
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
            recordIcon.isHidden = false
            recordSpinner.stopAnimating()
            recordButton.isEnabled = true
            waveform.stopAnimating()
            waveform.isHidden = true
            recordButton.accessibilityLabel = "Start recording"
        case .recording:
            recordIcon.state = .stop
            recordIcon.alpha = 1
            recordIcon.isHidden = false
            recordSpinner.stopAnimating()
            recordButton.isEnabled = true
            waveform.setMode(.recording)
            waveform.isHidden = false
            waveform.startAnimating()
            recordButton.accessibilityLabel = "Stop recording"
        case .transcribing:
            // Swap the mic glyph for a spinner and stop the waveform
            // entirely. The waveform's per-frame `CIGaussianBlur`
            // pipeline is the heaviest thing in the keyboard, and
            // there's no audio to react to once recording stops, so
            // the spinner is both cheaper and a clearer signal that
            // the keyboard is waiting for the main app.
            recordIcon.isHidden = true
            recordButton.isEnabled = false
            recordSpinner.startAnimating()
            waveform.stopAnimating()
            waveform.isHidden = true
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
/// keyboard.
///
/// Per-frame pipeline: build the three curves, stroke them into an
/// off-screen `UIGraphicsImageRenderer` context, apply `CIGaussianBlur`
/// with sigma 2.5, and assign the resulting `UIImage` to a single
/// `UIImageView`. This gives the same uniform Gaussian falloff the
/// Figma SVG defines (`feGaussianBlur stdDeviation=2.5`) — `CALayer`
/// has no first-class blur for animated stroke content, so a sharp
/// CAShapeLayer + `shadowRadius` halo would render a bright core that
/// the design explicitly does not have.
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
    }

    private static let profiles: [WaveProfile] = [
        WaveProfile(basePhaseSpeed: 0.04, frequency: 2.2, verticalOffset: -3.2,
                    amplitudeMultiplier: 0.35, strokeWidth: 3.0,
                    energyFloor: 0.06, audioAmplitudeReactivity: 0.7,
                    transcribingAmplitude: 0.6, transcribingPhaseOffset: 0.0),
        WaveProfile(basePhaseSpeed: 0.07, frequency: 3.1, verticalOffset: 0.0,
                    amplitudeMultiplier: 0.55, strokeWidth: 3.0,
                    energyFloor: 0.05, audioAmplitudeReactivity: 1.0,
                    transcribingAmplitude: 0.7, transcribingPhaseOffset: .pi),
        WaveProfile(basePhaseSpeed: 0.09, frequency: 2.5, verticalOffset: 3.6,
                    amplitudeMultiplier: 0.75, strokeWidth: 3.0,
                    energyFloor: 0.04, audioAmplitudeReactivity: 0.55,
                    transcribingAmplitude: 0.8,
                    transcribingPhaseOffset: 2 * .pi / 3),
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
    /// `CALayer` instead of `UIImageView` so we can hand a `CGImage`
    /// directly to `contents` and skip the per-frame `UIImage` wrapper
    /// allocation. Functionally identical for display.
    private let imageLayer = CALayer()
    /// Reused across frames — `CIContext` is expensive to construct.
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])
    /// Reused renderer keyed on bounds; recreated only when the view is
    /// laid out at a new size.
    private var imageRenderer: UIGraphicsImageRenderer?
    private var rendererSize: CGSize = .zero
    /// Persistent CGBitmapContext used as the per-frame composite
    /// canvas. Replaces a `UIGraphicsImageRenderer.image { … }` call
    /// (which allocates a fresh bitmap buffer on every invocation) —
    /// here we clear and reuse the same buffer each frame.
    private var compositeContext: CGContext?
    private var compositePixelSize: CGSize = .zero
    private var displayLink: CADisplayLink?
    private var lastFrameTime: CFTimeInterval = 0
    private var audioLevel: Double = 0
    private var mode: Mode = .recording
    /// Horizontal alpha gradient masking the wave so it fades to transparent
    /// at both edges of the keyboard header. Installed by the parent top bar
    /// once full-bleed layout is in use.
    private var edgeFadeMask: CAGradientLayer?

    /// `feGaussianBlur stdDeviation=2.5` carries an `opacity=0.8` group
    /// modifier in the Figma source — this is the matching ceiling so the
    /// keyboard waveform reads identically to the main app's Skia version.
    private static let figmaOpacityCeiling: Double = 0.8

    /// Sigma for the per-frame `CIGaussianBlur` — matches the
    /// `feGaussianBlur stdDeviation=2.5` filter on every wave group in
    /// the Figma SVG export.
    private static let blurSigma: Double = 2.5

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
        imageLayer.frame = bounds
        imageLayer.contentsGravity = .resize
        layer.addSublayer(imageLayer)
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
        if rendererSize != bounds.size {
            rendererSize = bounds.size
            // `UIGraphicsImageRendererFormat.preferred()` honors the screen
            // scale automatically, so the off-screen canvas matches retina
            // resolution without explicit scale math.
            imageRenderer = UIGraphicsImageRenderer(
                size: bounds.size,
                format: UIGraphicsImageRendererFormat.preferred()
            )
            ensureCompositeContext()
        }
        // Disable implicit CALayer animations on `frame`/`contents` so
        // size changes don't cross-fade visibly.
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        imageLayer.frame = bounds
        CATransaction.commit()
        updateMaskFrame()
    }

    /// Allocates (or re-allocates) the persistent bitmap context used as
    /// the per-frame composite canvas. Called from `layoutSubviews` only
    /// when the view's size changes.
    private func ensureCompositeContext() {
        let scale = UIScreen.main.scale
        let pixelSize = CGSize(
            width: bounds.width * scale,
            height: bounds.height * scale
        )
        guard pixelSize.width > 0, pixelSize.height > 0 else {
            compositeContext = nil
            compositePixelSize = .zero
            return
        }
        if compositePixelSize == pixelSize, compositeContext != nil { return }
        let cs = CGColorSpaceCreateDeviceRGB()
        let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
        compositeContext = CGContext(
            data: nil,
            width: Int(pixelSize.width),
            height: Int(pixelSize.height),
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: cs,
            bitmapInfo: bitmapInfo
        )
        compositePixelSize = pixelSize
        // Scale once at allocation so per-frame draws can use point
        // coordinates directly. The Y-axis stays in CG convention
        // (origin at bottom) — the per-frame draw flips it before
        // blitting `UIImage.cgImage`s.
        compositeContext?.scaleBy(x: scale, y: scale)
    }

    /// Install a horizontal alpha gradient that fades the wave to
    /// transparent at the left/right edges. Used when the waveform spans
    /// the full header width so the wave reads cleanly behind the logo
    /// and record button.
    func installEdgeFadeMask(insetFraction: CGFloat = 0.32) {
        guard edgeFadeMask == nil else { return }
        let mask = CAGradientLayer()
        mask.startPoint = CGPoint(x: 0, y: 0.5)
        mask.endPoint = CGPoint(x: 1, y: 0.5)
        mask.colors = [
            UIColor(white: 1, alpha: 0).cgColor,
            UIColor(white: 1, alpha: 1).cgColor,
            UIColor(white: 1, alpha: 1).cgColor,
            UIColor(white: 1, alpha: 0).cgColor,
        ]
        let inset = NSNumber(value: Double(insetFraction))
        let outset = NSNumber(value: 1.0 - Double(insetFraction))
        mask.locations = [0.0, inset, outset, 1.0]
        mask.frame = bounds
        layer.mask = mask
        edgeFadeMask = mask
    }

    private func updateMaskFrame() {
        edgeFadeMask?.frame = bounds
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
        // 30fps cap. Per-frame work (3 stroke renders + 3 Gaussian blurs +
        // 6 gradient-mask passes + 1 composite) is heavy; halving the
        // tick rate cuts allocation pressure to ~half without a
        // noticeable smoothness hit on a wave that already moves slowly.
        // The simulation step still time-normalises against `dtFactor`,
        // so the wave's apparent speed is unchanged.
        link.preferredFramesPerSecond = 30
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
        imageLayer.contents = nil
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

        // Per-frame paths + matching opacity that we'll stroke into the
        // off-screen canvas after the simulation step finishes. Color is
        // no longer per-wave — every wave shares the same vertical
        // gradient (`#A54CFF → #4588D2 → #FBCAB9`), applied during the
        // stroke pass. Opacity stays per-wave so each line still fades
        // in/out independently with its own state machine.
        var paths: [(UIBezierPath, CGFloat, CGFloat)] = []
        paths.reserveCapacity(Self.profiles.count)

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
                targetOpacity = 0.4
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
                targetOpacity = Self.figmaOpacityCeiling
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

            paths.append((path, CGFloat(state.smoothedOpacity), profile.strokeWidth))
        }

        renderBlurredImage(paths: paths)
    }

    /// Stroke each wave path into two off-screen canvases — one sharp,
    /// one Gaussian-blurred — then composite them with opposing
    /// horizontal alpha gradients so each wave alternates between crisp
    /// and blurred segments along its length. Mirrors the Skia + Android
    /// implementations and the Figma design's mixed blur pattern.
    private func renderBlurredImage(
        paths: [(UIBezierPath, CGFloat, CGFloat)]
    ) {
        if rendererSize != bounds.size || imageRenderer == nil {
            rendererSize = bounds.size
            imageRenderer = UIGraphicsImageRenderer(
                size: bounds.size,
                format: UIGraphicsImageRendererFormat.preferred()
            )
        }
        guard let renderer = imageRenderer, bounds.width > 0, bounds.height > 0
        else { return }

        // Build each wave's masked sharp + blurred images sequentially —
        // `UIGraphicsImageRenderer.image` is not reentrant, so all
        // intermediate images must be rendered before we open the final
        // composite block.
        var maskedImages: [UIImage] = []
        for (i, item) in paths.enumerated() {
            let (path, opacity, lineWidth) = item
            guard i < Self.gradientPositions.count else { continue }
            let stops = Self.gradientPositions[i]
            let visibility = Self.sharpVisibility[i]

            let strokeImage = renderer.image { ctx in
                let cg = ctx.cgContext
                cg.saveGState()
                cg.setLineCap(.round)
                cg.setLineJoin(.round)
                cg.setLineWidth(lineWidth)
                cg.addPath(path.cgPath)
                // Convert the stroked outline into a fillable region, then
                // clip to it so the vertical color gradient fills exactly
                // the stroke's shape. Replaces the previous solid-color
                // stroke with the shared `#A54CFF → #4588D2 → #FBCAB9`
                // palette every wave now uses.
                cg.replacePathWithStrokedPath()
                cg.clip()
                Self.drawWaveGradient(in: cg, opacity: opacity, height: bounds.height)
                cg.restoreGState()
            }
            let blurredStroke = applyGaussianBlur(to: strokeImage)
            maskedImages.append(
                applyGradientMask(
                    to: strokeImage, stops: stops,
                    visibility: visibility, inverse: false
                )
            )
            maskedImages.append(
                applyGradientMask(
                    to: blurredStroke, stops: stops,
                    visibility: visibility, inverse: true
                )
            )
        }

        // Composite into the persistent bitmap context (no per-frame
        // bitmap allocation). `CGContext` has Y-up, origin bottom-left;
        // `UIImage.cgImage`s come in UIKit Y-down convention, so we
        // flip once before blitting them in.
        if compositeContext == nil { ensureCompositeContext() }
        guard let ctx = compositeContext else { return }
        ctx.clear(CGRect(origin: .zero, size: compositePixelSize))
        ctx.saveGState()
        ctx.translateBy(x: 0, y: bounds.height)
        ctx.scaleBy(x: 1, y: -1)
        for img in maskedImages {
            if let cg = img.cgImage {
                ctx.draw(cg, in: bounds)
            }
        }
        ctx.restoreGState()
        // Set the snapshot directly on the layer's contents — skips the
        // `UIImage` wrapper that `UIImageView.image` requires.
        if let snapshot = ctx.makeImage() {
            CATransaction.begin()
            CATransaction.setDisableActions(true)
            imageLayer.contents = snapshot
            CATransaction.commit()
        }
    }

    private func applyGaussianBlur(to image: UIImage) -> UIImage {
        guard let cg = image.cgImage else { return image }
        let scale = image.scale
        let ci = CIImage(cgImage: cg)
        let blurred = ci.clampedToExtent()
            .applyingGaussianBlur(sigma: Self.blurSigma * Double(scale))
            .cropped(to: ci.extent)
        guard let blurredCG = ciContext.createCGImage(
            blurred, from: ci.extent
        ) else {
            return image
        }
        return UIImage(cgImage: blurredCG, scale: scale, orientation: .up)
    }

    /// Multiply the image's alpha by a horizontal gradient. `visibility`
    /// is the per-stop visibility pattern (1 = sharp pass shows, 0 =
    /// blurred pass shows); `inverse=true` flips it for the blurred
    /// pass so the two passes mask out exactly the opposite regions.
    private func applyGradientMask(
        to image: UIImage,
        stops: [CGFloat],
        visibility: [Int],
        inverse: Bool
    ) -> UIImage {
        guard let renderer = imageRenderer else { return image }
        return renderer.image { ctx in
            let cg = ctx.cgContext
            // Draw the source image first.
            image.draw(in: bounds)

            let cgColors: [CGColor] = visibility.map { v in
                let effective = inverse ? 1 - v : v
                return UIColor(white: 1, alpha: CGFloat(effective)).cgColor
            }
            let colorSpace = CGColorSpaceCreateDeviceRGB()
            guard let gradient = CGGradient(
                colorsSpace: colorSpace,
                colors: cgColors as CFArray,
                locations: stops
            ) else { return }
            cg.setBlendMode(.destinationIn)
            cg.drawLinearGradient(
                gradient,
                start: CGPoint(x: bounds.minX, y: bounds.midY),
                end: CGPoint(x: bounds.maxX, y: bounds.midY),
                options: []
            )
        }
    }

    /// Per-wave gradient stops + sharp-pass visibility pattern, mirroring
    /// `WAVE_GRADIENTS` in `ThreeWaveLines.tsx` and `GRADIENT_POSITIONS` /
    /// `SHARP_VISIBILITY` in `EchosWaveformView.kt`. Each wave gets two
    /// blurred spots at distinctly different x positions:
    ///   Wave 0 (orange): ~32%, ~92%
    ///   Wave 1 (blue) : ~10%, ~70%  (inverted pattern)
    ///   Wave 2 (cyan) : ~51%, ~88%
    private static let gradientPositions: [[CGFloat]] = [
        [0, 0.18, 0.25, 0.40, 0.55, 0.75, 0.85, 1.0],
        [0, 0.20, 0.30, 0.50, 0.62, 0.78, 0.85, 1.0],
        [0, 0.32, 0.45, 0.58, 0.65, 0.72, 0.80, 0.92],
    ]
    private static let sharpVisibility: [[Int]] = [
        [1, 1, 0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0, 1, 1],
        [1, 1, 0, 0, 1, 1, 0, 0],
    ]

    /// Shared vertical color gradient applied to every wave — replaces
    /// the previous per-wave orange / accent / cyan palette. Mirrors
    /// `WAVE_GRADIENT_COLORS` in `ThreeWaveLines.tsx` and the Figma
    /// SVG's `#A54CFF → #4588D2 → #FBCAB9` stops.
    private static let gradientStops: [UInt32] = [0xA54CFF, 0x4588D2, 0xFBCAB9]
    private static let gradientLocations: [CGFloat] = [0, 0.5, 1.0]

    /// Fills the current clip region with the shared vertical gradient
    /// at the given opacity (0…1). Caller is responsible for setting up
    /// the clip via `replacePathWithStrokedPath` + `clip` so only the
    /// stroke's shape is painted.
    private static func drawWaveGradient(
        in cg: CGContext, opacity: CGFloat, height: CGFloat
    ) {
        let cgColors: [CGColor] = gradientStops.map { hex -> CGColor in
            UIColor(hex: hex, alpha: opacity).cgColor
        }
        let colorSpace = CGColorSpaceCreateDeviceRGB()
        guard let gradient = CGGradient(
            colorsSpace: colorSpace,
            colors: cgColors as CFArray,
            locations: gradientLocations
        ) else { return }
        cg.drawLinearGradient(
            gradient,
            start: CGPoint(x: 0, y: 0),
            end: CGPoint(x: 0, y: height),
            options: []
        )
    }
}
