import UIKit

/// Delegate protocol for keyboard actions.
protocol KeyboardViewDelegate: AnyObject {
    func keyboardView(_ view: KeyboardView, didTapCharacter char: String)
    func keyboardViewDidTapDelete(_ view: KeyboardView)
    func keyboardViewDidTapSpace(_ view: KeyboardView)
    func keyboardViewDidTapReturn(_ view: KeyboardView)
    func keyboardViewDidTapGlobe(_ view: KeyboardView)
    func keyboardViewDidStartMicRecording(_ view: KeyboardView)
    func keyboardViewDidStopMicRecording(_ view: KeyboardView)
}

/// Mic button states.
enum MicState {
    case idle
    case recording
    case transcribing
}

/// Main keyboard view containing rows of keys.
class KeyboardView: UIView {

    weak var delegate: KeyboardViewDelegate?
    var heightConstraint: NSLayoutConstraint?

    private let theme = KeyboardTheme()
    private var rowStackView: UIStackView!
    private var keyButtons: [[KeyButton]] = []
    private var currentLayout: KeyboardLayout.LayoutMode = .letters
    private var shiftState: KeyboardLayout.ShiftState = .off
    private var micState: MicState = .idle
    private var returnKeyType: UIReturnKeyType = .default

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        backgroundColor = theme.keyboardBackground

        rowStackView = UIStackView()
        rowStackView.axis = .vertical
        rowStackView.distribution = .fillEqually
        rowStackView.spacing = 8
        rowStackView.translatesAutoresizingMaskIntoConstraints = false

        addSubview(rowStackView)
        NSLayoutConstraint.activate([
            rowStackView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            rowStackView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            rowStackView.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            rowStackView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        buildLayout()
    }

    // MARK: - Layout Building

    private func buildLayout() {
        // Remove existing rows
        for view in rowStackView.arrangedSubviews {
            rowStackView.removeArrangedSubview(view)
            view.removeFromSuperview()
        }
        keyButtons.removeAll()

        let rows = KeyboardLayout.rows(for: currentLayout)

        for row in rows {
            let rowView = UIStackView()
            rowView.axis = .horizontal
            rowView.distribution = .fill
            rowView.spacing = 4
            rowView.alignment = .fill

            var rowButtons: [KeyButton] = []

            for keyDef in row {
                let button = KeyButton(keyDefinition: keyDef, theme: theme)
                button.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
                button.addTarget(self, action: #selector(keyTouchUp(_:)), for: .touchUpInside)
                button.addTarget(self, action: #selector(keyTouchCancel(_:)), for: [.touchUpOutside, .touchCancel])

                // Set width proportional to weight
                if keyDef.widthWeight != 1.0 {
                    button.widthMultiplier = keyDef.widthWeight
                }

                rowView.addArrangedSubview(button)
                rowButtons.append(button)
            }

            // Apply width constraints based on weights
            applyWidthConstraints(buttons: rowButtons, in: rowView)

            rowStackView.addArrangedSubview(rowView)
            keyButtons.append(rowButtons)
        }

        updateKeyLabels()
    }

    private func applyWidthConstraints(buttons: [KeyButton], in stackView: UIStackView) {
        // Find the first button with weight 1.0 as reference
        guard let referenceButton = buttons.first(where: { $0.keyDefinition.widthWeight == 1.0 }) else {
            return
        }

        for button in buttons where button !== referenceButton {
            let weight = button.keyDefinition.widthWeight
            if weight != 1.0 {
                button.widthAnchor.constraint(
                    equalTo: referenceButton.widthAnchor,
                    multiplier: weight
                ).isActive = true
            } else {
                button.widthAnchor.constraint(equalTo: referenceButton.widthAnchor).isActive = true
            }
        }
    }

    private func updateKeyLabels() {
        for row in keyButtons {
            for button in row {
                let def = button.keyDefinition
                switch def.type {
                case .character:
                    let label = shiftState != .off ? def.label.uppercased() : def.label
                    button.setDisplayLabel(label)
                case .returnKey:
                    button.setDisplayLabel(returnKeyLabel())
                default:
                    break
                }
                button.updateAppearance(theme: theme, micState: micState, shiftState: shiftState)
            }
        }
    }

    private func returnKeyLabel() -> String {
        switch returnKeyType {
        case .go: return "Go"
        case .search: return "\u{1F50D}"
        case .send: return "Send"
        case .next: return "Next"
        case .done: return "Done"
        default: return "\u{23CE}"
        }
    }

    // MARK: - Public API

    func updateReturnKeyType(_ type: UIReturnKeyType) {
        returnKeyType = type
        updateKeyLabels()
    }

    func setMicState(_ state: MicState) {
        micState = state
        updateKeyLabels()

        // Announce state change for VoiceOver
        switch state {
        case .recording:
            UIAccessibility.post(notification: .announcement, argument: "Recording")
        case .transcribing:
            UIAccessibility.post(notification: .announcement, argument: "Transcribing")
        case .idle:
            break
        }
    }

    func showMicError(_ message: String) {
        UIAccessibility.post(notification: .announcement, argument: message)
        // TODO: Show inline error banner
    }

    func switchToLayout(_ mode: KeyboardLayout.LayoutMode) {
        currentLayout = mode
        buildLayout()
    }

    // MARK: - Touch Handlers

    @objc private func keyTouchDown(_ sender: KeyButton) {
        HapticManager.keyTap()
        sender.setPressed(true)

        if sender.keyDefinition.type == .mic {
            delegate?.keyboardViewDidStartMicRecording(self)
        }
    }

    @objc private func keyTouchUp(_ sender: KeyButton) {
        sender.setPressed(false)
        handleKeyAction(sender.keyDefinition)
    }

    @objc private func keyTouchCancel(_ sender: KeyButton) {
        sender.setPressed(false)
        if sender.keyDefinition.type == .mic {
            delegate?.keyboardViewDidStopMicRecording(self)
        }
    }

    private func handleKeyAction(_ key: KeyboardLayout.KeyDefinition) {
        switch key.type {
        case .character:
            let char = shiftState != .off ? key.label.uppercased() : key.label
            delegate?.keyboardView(self, didTapCharacter: char)
            if shiftState == .on {
                shiftState = .off
                updateKeyLabels()
            }
        case .delete:
            delegate?.keyboardViewDidTapDelete(self)
        case .space:
            delegate?.keyboardViewDidTapSpace(self)
        case .returnKey:
            delegate?.keyboardViewDidTapReturn(self)
        case .globe:
            delegate?.keyboardViewDidTapGlobe(self)
        case .mic:
            delegate?.keyboardViewDidStopMicRecording(self)
        case .shift:
            switch shiftState {
            case .off: shiftState = .on
            case .on: shiftState = .capsLock
            case .capsLock: shiftState = .off
            }
            updateKeyLabels()
        case .modeSwitch:
            switch currentLayout {
            case .letters: switchToLayout(.numbers)
            case .numbers, .symbols: switchToLayout(.letters)
            }
        case .symbolSwitch:
            switch currentLayout {
            case .numbers: switchToLayout(.symbols)
            case .symbols: switchToLayout(.numbers)
            default: break
            }
        case .comma:
            delegate?.keyboardView(self, didTapCharacter: ",")
        case .period:
            delegate?.keyboardView(self, didTapCharacter: ".")
        }
    }
}
