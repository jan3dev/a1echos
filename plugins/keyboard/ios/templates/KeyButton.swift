import UIKit

/// A single keyboard key that handles its own appearance, press animation,
/// and accessibility configuration.
class KeyButton: UIControl {

    let keyDefinition: KeyboardLayout.KeyDefinition
    var widthMultiplier: CGFloat = 1.0

    private let label = UILabel()
    private var backgroundLayer = CALayer()

    init(keyDefinition: KeyboardLayout.KeyDefinition, theme: KeyboardTheme) {
        self.keyDefinition = keyDefinition
        super.init(frame: .zero)
        setupView(theme: theme)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    private func setupView(theme: KeyboardTheme) {
        // Background
        backgroundLayer.cornerRadius = 8
        backgroundLayer.masksToBounds = true
        layer.insertSublayer(backgroundLayer, at: 0)

        // Label
        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),
        ])

        // Set initial display
        label.text = keyDefinition.label
        updateAppearance(theme: theme, micState: .idle, shiftState: .off)

        // Accessibility
        isAccessibilityElement = true
        accessibilityLabel = keyDefinition.accessibilityLabel
        accessibilityTraits = .keyboardKey
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        backgroundLayer.frame = bounds
    }

    // MARK: - Public

    func setDisplayLabel(_ text: String) {
        label.text = text
    }

    func setPressed(_ pressed: Bool) {
        let scale: CGFloat = pressed ? 0.95 : 1.0
        UIView.animate(withDuration: 0.05, delay: 0, options: .curveEaseInOut) {
            self.transform = CGAffineTransform(scaleX: scale, y: scale)
        }
    }

    func updateAppearance(theme: KeyboardTheme, micState: MicState, shiftState: KeyboardLayout.ShiftState) {
        let bgColor: UIColor
        let textColor: UIColor
        let fontSize: CGFloat

        switch keyDefinition.type {
        case .mic:
            switch micState {
            case .recording: bgColor = theme.micButtonRecording
            case .transcribing: bgColor = theme.micButtonBackground.withAlphaComponent(0.7)
            case .idle: bgColor = theme.micButtonBackground
            }
            textColor = theme.micButtonIcon
            fontSize = 20

        case .returnKey:
            bgColor = theme.micButtonBackground // Accent color
            textColor = theme.micButtonIcon
            fontSize = 16

        case .shift, .delete, .modeSwitch, .symbolSwitch, .globe:
            bgColor = theme.specialKeyBackground
            textColor = theme.keyText
            fontSize = 16
            // Highlight shift when active
            if keyDefinition.type == .shift && shiftState != .off {
                backgroundLayer.backgroundColor = theme.micButtonBackground.cgColor
                label.textColor = theme.micButtonIcon
                label.font = UIFont.systemFont(ofSize: fontSize, weight: .semibold)
                return
            }

        case .space:
            bgColor = theme.keyBackground
            textColor = theme.keyText
            fontSize = 16

        default:
            bgColor = theme.keyBackground
            textColor = theme.keyText
            fontSize = 22
        }

        backgroundLayer.backgroundColor = bgColor.cgColor
        label.textColor = textColor
        label.font = UIFont.systemFont(ofSize: fontSize, weight: .regular)
    }
}
