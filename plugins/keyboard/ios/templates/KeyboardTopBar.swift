import CoreImage
import UIKit

/// Top bar pinned above the key rows. The record / stop button is always
/// pinned top-right; the suggestion strip fills the space to its left while
/// composing, and the three-wave-lines visualizer spans the bar while recording.
protocol KeyboardTopBarDelegate: AnyObject {
    func topBarDidTapRecord(_ topBar: KeyboardTopBar)
    /// A suggestion candidate in the strip was tapped (§5.5).
    func topBar(_ topBar: KeyboardTopBar, didSelectSuggestion slot: SuggestionSlot)
}

final class KeyboardTopBar: UIView {

    /// ~0pt padding above + 32pt button + 8pt padding below. Kept compact so
    /// the keyboard adds as little chrome as possible over the key rows; the
    /// button is bottom-pinned so the slim top edge sits flush at the top.
    static let preferredHeight: CGFloat = 40

    weak var delegate: KeyboardTopBarDelegate?

    private let recordButton = UIButton(type: .system)
    private let recordIcon = RecordButtonIconView()
    /// Replaces the waveform animation while transcribing. Renders the
    /// design system's `spinner_loading` glyph and rotates it via a
    /// `CABasicAnimation` on the layer — far cheaper than the per-frame
    /// `UIGraphicsImageRenderer` + `CIGaussianBlur` pipeline that the
    /// wave runs at 30fps, and visually identical to the Android keyboard.
    private let recordSpinner = LoadingSpinnerIconView()
    private let waveform = RecordingWaveformView()
    /// Bright white border that rings the record button while recording and
    /// depletes counter-clockwise over the 30s recording cap, so the user can
    /// see when the keyboard will auto-stop and transcribe.
    private let countdownRing = CAShapeLayer()
    /// Mirrors `KeyboardTranscriptionListener.recordingMaxSeconds` — the
    /// hard recording cap the ring counts down against.
    private static let countdownDurationSeconds: CFTimeInterval = 30
    /// Suggestion strip overlay (§5.5). Hidden by default; shown over the
    /// idle chrome while the user composes a word, never while recording.
    private let suggestionStrip = SuggestionStripView()
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

        // Record button — gray capsule (Figma "Echos Button"). The custom
        // icon view inside swaps between a microphone glyph (idle) and a
        // rounded stop rectangle (recording).
        recordButton.translatesAutoresizingMaskIntoConstraints = false
        recordButton.backgroundColor = UIColor(hex: 0x707171)
        recordButton.layer.cornerRadius = 16
        recordButton.layer.cornerCurve = .continuous
        recordButton.addTarget(self, action: #selector(recordTapped), for: .touchUpInside)
        recordButton.accessibilityLabel = "Record"
        recordButton.accessibilityTraits = [.button, .startsMediaSession]
        addSubview(recordButton)

        // Countdown ring rides the capsule edge above the gray fill but below
        // the glyph. Path + frame are set in `layoutSubviews` once the button
        // has real bounds; the depletion animation is driven by `strokeEnd`.
        countdownRing.fillColor = UIColor.clear.cgColor
        countdownRing.strokeColor = UIColor.white.cgColor
        countdownRing.lineWidth = 2.5
        countdownRing.lineCap = .round
        countdownRing.isHidden = true
        recordButton.layer.addSublayer(countdownRing)

        recordIcon.translatesAutoresizingMaskIntoConstraints = false
        recordIcon.isUserInteractionEnabled = false
        recordButton.addSubview(recordIcon)

        recordSpinner.translatesAutoresizingMaskIntoConstraints = false
        recordSpinner.isUserInteractionEnabled = false
        recordSpinner.isHidden = true
        recordButton.addSubview(recordSpinner)

        waveform.translatesAutoresizingMaskIntoConstraints = false
        waveform.isUserInteractionEnabled = false
        waveform.isHidden = true
        // Insert the waveform behind the record button so it can span the
        // full width of the header while the button sits on its faded edge.
        insertSubview(waveform, at: 0)
        waveform.installEdgeFadeMask()

        // Added last so it renders above the waveform.
        suggestionStrip.delegate = self
        suggestionStrip.isHidden = true
        addSubview(suggestionStrip)

        NSLayoutConstraint.activate([
            recordButton.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            recordButton.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
            recordButton.widthAnchor.constraint(equalToConstant: 72),
            recordButton.heightAnchor.constraint(equalToConstant: 32),

            recordIcon.centerXAnchor.constraint(equalTo: recordButton.centerXAnchor),
            recordIcon.centerYAnchor.constraint(equalTo: recordButton.centerYAnchor),
            recordIcon.widthAnchor.constraint(equalToConstant: 24),
            recordIcon.heightAnchor.constraint(equalToConstant: 24),

            recordSpinner.centerXAnchor.constraint(equalTo: recordButton.centerXAnchor),
            recordSpinner.centerYAnchor.constraint(equalTo: recordButton.centerYAnchor),
            recordSpinner.widthAnchor.constraint(equalToConstant: 20),
            recordSpinner.heightAnchor.constraint(equalToConstant: 20),

            waveform.leadingAnchor.constraint(equalTo: leadingAnchor),
            waveform.trailingAnchor.constraint(equalTo: trailingAnchor),
            waveform.centerYAnchor.constraint(equalTo: centerYAnchor),
            waveform.heightAnchor.constraint(equalToConstant: RecordingWaveformView.preferredHeight),

            suggestionStrip.leadingAnchor.constraint(equalTo: leadingAnchor),
            suggestionStrip.trailingAnchor.constraint(
                equalTo: recordButton.leadingAnchor, constant: -8
            ),
            suggestionStrip.topAnchor.constraint(equalTo: topAnchor),
            suggestionStrip.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        applyMicState()
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Keep the ring glued to the capsule edge. Inset by half the line width
        // so the full stroke stays inside the button bounds rather than being
        // clipped at the edge. Building the path here (not in `setup`) means it
        // tracks any future size changes for free.
        let inset = countdownRing.lineWidth / 2
        let ringRect = recordButton.bounds.insetBy(dx: inset, dy: inset)
        let radius = max(0, recordButton.layer.cornerRadius - inset)
        countdownRing.frame = recordButton.bounds
        // `.reversing()` flips the default clockwise winding so the stroke
        // depletes counter-clockwise as `strokeEnd` runs 1 → 0.
        countdownRing.path = UIBezierPath(
            roundedRect: ringRect, cornerRadius: radius
        ).reversing().cgPath
    }

    // MARK: - Public

    func setMicState(_ state: MicState) {
        guard state != micState else { return }
        micState = state
        // Recording / transcribing always owns the bar — clear any suggestion
        // strip before applying the mic visuals.
        hideSuggestions()
        applyMicState()
    }

    /// Shows the suggestion strip left of the record button while the user
    /// composes a word. No-op while recording / transcribing so voice capture
    /// always owns the bar.
    func showSuggestions(_ slots: [SuggestionSlot]) {
        guard micState == .idle, !slots.isEmpty else {
            hideSuggestions()
            return
        }
        suggestionStrip.setSlots(slots)
        suggestionStrip.isHidden = false
    }

    func hideSuggestions() {
        suggestionStrip.isHidden = true
    }

    /// Latest recorder amplitude (0…1) — drives the wave lines' phase
    /// speed and amplitude while recording. No-op when the waveform is
    /// hidden, so the value can be pushed unconditionally from the
    /// recorder's metering loop.
    func setAudioLevel(_ level: Double) {
        waveform.setAudioLevel(level)
    }

    /// The record button's top edge in this bar's coordinate space. The
    /// key-preview balloon uses it (converted to keyboard coords) as the
    /// ceiling a top-row balloon may grow up to.
    var recordButtonTop: CGFloat { recordButton.frame.minY }

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
            recordSpinner.stopSpinning()
            recordSpinner.isHidden = true
            recordButton.isEnabled = true
            waveform.stopAnimating()
            waveform.isHidden = true
            stopCountdownRing()
            recordButton.accessibilityLabel = "Start recording"
        case .recording:
            recordIcon.state = .stop
            recordIcon.alpha = 1
            recordIcon.isHidden = false
            recordSpinner.stopSpinning()
            recordSpinner.isHidden = true
            recordButton.isEnabled = true
            waveform.setMode(.recording)
            waveform.isHidden = false
            waveform.startAnimating()
            startCountdownRing()
            recordButton.accessibilityLabel = "Stop recording"
        case .transcribing:
            // Swap the mic glyph for the design-system spinner glyph
            // (rotating) and stop the waveform entirely. The waveform's
            // per-frame `CIGaussianBlur` pipeline is the heaviest thing
            // in the keyboard, and there's no audio to react to once
            // recording stops, so the rotating glyph is both cheaper
            // and a clearer signal that we're waiting for the main app.
            recordIcon.isHidden = true
            recordButton.isEnabled = false
            recordSpinner.isHidden = false
            recordSpinner.startSpinning()
            waveform.stopAnimating()
            waveform.isHidden = true
            stopCountdownRing()
            recordButton.accessibilityLabel = "Transcribing"
        }
    }

    // MARK: - Countdown Ring

    /// Reveal the ring full and animate `strokeEnd` 1 → 0 over the recording
    /// cap. `removedOnCompletion = false` + `.forwards` holds the empty state
    /// if recording somehow outlives the cap before the state flips.
    private func startCountdownRing() {
        countdownRing.removeAnimation(forKey: "countdown")
        countdownRing.isHidden = false
        countdownRing.strokeEnd = 0

        let animation = CABasicAnimation(keyPath: "strokeEnd")
        animation.fromValue = 1
        animation.toValue = 0
        animation.duration = Self.countdownDurationSeconds
        animation.timingFunction = CAMediaTimingFunction(name: .linear)
        animation.isRemovedOnCompletion = false
        animation.fillMode = .forwards
        countdownRing.add(animation, forKey: "countdown")
    }

    private func stopCountdownRing() {
        countdownRing.removeAnimation(forKey: "countdown")
        countdownRing.isHidden = true
        countdownRing.strokeEnd = 1
    }
}

// MARK: - SuggestionStripViewDelegate

extension KeyboardTopBar: SuggestionStripViewDelegate {
    func suggestionStrip(_ strip: SuggestionStripView, didSelect slot: SuggestionSlot) {
        delegate?.topBar(self, didSelectSuggestion: slot)
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

// MARK: - Loading Spinner Icon

/// Animated loading glyph shown inside the record-button pill while the
/// keyboard waits for a transcription result. Mirrors the design system's
/// `assets/icons/spinner_loading.svg` — eight rounded pill rays at 45°
/// intervals around center — and keeps it visually identical to the
/// Android keyboard's `ic_spinner_loading` vector drawable.
///
/// Caller is responsible for calling `startSpinning()` / `stopSpinning()`
/// alongside show/hide. Rotation is driven by a `CABasicAnimation` on
/// `transform.rotation.z` so it doesn't run on the main thread once
/// installed and costs nothing while hidden.
final class LoadingSpinnerIconView: UIView {

    /// Glyph fill — same off-white the mic / stop glyphs use, so the
    /// transition between states doesn't cause a perceptible color shift.
    private let glyphColor = UIColor(hex: 0xF5F5F8)

    private static let spinAnimationKey = "echos.spin"

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        contentMode = .redraw
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    func startSpinning() {
        guard layer.animation(forKey: Self.spinAnimationKey) == nil else { return }
        let anim = CABasicAnimation(keyPath: "transform.rotation.z")
        anim.fromValue = 0
        anim.toValue = 2 * Double.pi
        anim.duration = 1.0
        anim.repeatCount = .infinity
        // Linear feel matches the Android `LinearInterpolator` rotation —
        // any easing here would make the two platforms look subtly off.
        anim.timingFunction = CAMediaTimingFunction(name: .linear)
        anim.isRemovedOnCompletion = false
        layer.add(anim, forKey: Self.spinAnimationKey)
    }

    func stopSpinning() {
        layer.removeAnimation(forKey: Self.spinAnimationKey)
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

        // Eight rounded pill rays at 45° intervals around (12, 12). Each
        // pill is 4×2 with full corner radius, outer edge at radius 10
        // and inner edge at radius 6 — the same geometry the SVG's
        // hand-drawn cubic Béziers describe.
        for i in 0..<8 {
            ctx.saveGState()
            ctx.translateBy(x: 12, y: 12)
            ctx.rotate(by: CGFloat(i) * .pi / 4)
            let pill = UIBezierPath(
                roundedRect: CGRect(x: 6, y: -1, width: 4, height: 2),
                cornerRadius: 1
            )
            pill.fill()
            ctx.restoreGState()
        }

        ctx.restoreGState()
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

    /// Sigma for the per-frame `CIGaussianBlur`. Matches the Android
    /// keyboard's `BLUR_RADIUS_DP` (1.8) rather than the app's iOS Skia
    /// value (2.5): the keyboard wave is edge-faded to its center third, so
    /// the middle line's center blur is the only part on screen — a 2.5
    /// sigma washes that line out entirely, while 1.8 keeps it legible and
    /// identical to Android.
    private static let blurSigma: Double = 1.8

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
    /// the full header width so the wave reads cleanly behind the record
    /// button.
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
        // off-screen canvas after the simulation step finishes. Each wave's
        // color comes from its own horizontal gradient (see `gradientStops`,
        // mirroring `recordingWaveGradients` — wave 1 is orange), applied by
        // index during the stroke pass. Opacity stays per-wave so each line
        // still fades in/out independently with its own state machine.
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
                // clip to it so this wave's horizontal color gradient fills
                // exactly the stroke's shape (per-wave palette mirroring
                // `recordingWaveGradients` — wave 1 is the orange middle line).
                cg.replacePathWithStrokedPath()
                cg.clip()
                Self.drawWaveGradient(
                    in: cg, waveIndex: i, opacity: opacity, width: bounds.width
                )
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
    /// `WAVE_BLUR_REVEALS` in `ThreeWaveLines.tsx` and `GRADIENT_POSITIONS` /
    /// `SHARP_VISIBILITY` in `EchosWaveformView.kt`. The outer lines (0, 2)
    /// soften at both ends and stay crisp through the middle; the middle line
    /// (1) softens through the center and stays crisp at the ends. A `1` marks
    /// where the sharp pass shows (the blurred pass shows where it's `0`).
    private static let gradientPositions: [[CGFloat]] = [
        [0, 0.32, 0.68, 1.0],
        [0, 0.34, 0.66, 1.0],
        [0, 0.32, 0.68, 1.0],
    ]
    private static let sharpVisibility: [[Int]] = [
        [0, 1, 1, 0],
        [1, 0, 0, 1],
        [0, 1, 1, 0],
    ]

    /// Per-wave horizontal color gradient, mirroring `recordingWaveGradients`
    /// in the app's `gradients.ts` — the wave palette runs *across* the lines
    /// (along each wave's width), so the middle wave reads orange end to end.
    /// Each entry is a 2-stop gradient drawn left → right:
    ///   Wave 0: #A54CFF → #4588D2   (purple → blue)
    ///   Wave 1: #FF8A3D → #F7931A   (orange — the middle line)
    ///   Wave 2: #4588D2 → #A54CFF   (blue → purple)
    private static let gradientStops: [[UInt32]] = [
        [0xA54CFF, 0x4588D2],
        [0xFF8A3D, 0xF7931A],
        [0x4588D2, 0xA54CFF],
    ]
    private static let gradientLocations: [CGFloat] = [0, 1.0]

    /// Fills the current clip region with `waveIndex`'s horizontal gradient
    /// at the given opacity (0…1). Caller is responsible for setting up the
    /// clip via `replacePathWithStrokedPath` + `clip` so only the stroke's
    /// shape is painted.
    private static func drawWaveGradient(
        in cg: CGContext, waveIndex: Int, opacity: CGFloat, width: CGFloat
    ) {
        let stops = gradientStops[min(waveIndex, gradientStops.count - 1)]
        let cgColors: [CGColor] = stops.map { hex -> CGColor in
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
            end: CGPoint(x: width, y: 0),
            options: []
        )
    }
}
