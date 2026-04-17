import UIKit

/// Specialized mic button with recording pulse animation.
/// This is used as a visual overlay on the mic key for additional effects.
class MicButton: UIView {

    private var pulseLayer: CALayer?
    private var isAnimating = false

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        isUserInteractionEnabled = false
        backgroundColor = .clear
    }

    // MARK: - Pulse Animation

    func startPulse(color: UIColor) {
        guard !isAnimating else { return }
        isAnimating = true

        let pulse = CALayer()
        pulse.frame = bounds.insetBy(dx: -4, dy: -4)
        pulse.cornerRadius = 8
        pulse.backgroundColor = color.withAlphaComponent(0.3).cgColor
        layer.insertSublayer(pulse, at: 0)
        pulseLayer = pulse

        let animation = CABasicAnimation(keyPath: "opacity")
        animation.fromValue = 0.6
        animation.toValue = 0.1
        animation.duration = 1.0
        animation.autoreverses = true
        animation.repeatCount = .infinity
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        pulse.add(animation, forKey: "pulse")
    }

    func stopPulse() {
        isAnimating = false
        pulseLayer?.removeAllAnimations()
        pulseLayer?.removeFromSuperlayer()
        pulseLayer = nil
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        pulseLayer?.frame = bounds.insetBy(dx: -4, dy: -4)
    }
}
