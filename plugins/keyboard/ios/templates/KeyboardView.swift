import UIKit

/// Delegate protocol for keyboard actions.
protocol KeyboardViewDelegate: AnyObject {
    func keyboardView(_ view: KeyboardView, didTapCharacter char: String)
    func keyboardViewDidTapDelete(_ view: KeyboardView)
    func keyboardViewDidTapSpace(_ view: KeyboardView)
    func keyboardViewDidTapReturn(_ view: KeyboardView)
    func keyboardViewDidTapGlobe(_ view: KeyboardView)
    func keyboardViewDidTapEmoji(_ view: KeyboardView)
    /// Long-press on the emoji key (iOS-only path to the system keyboard
    /// picker now that the dedicated globe key is gone).
    func keyboardView(_ view: KeyboardView, didLongPressEmojiFrom sourceView: UIView)
    func keyboardViewDidToggleRecord(_ view: KeyboardView)
}

/// Mic button states.
enum MicState {
    case idle
    case recording
    case transcribing
}

/// Main keyboard view. Inherits from `UIInputView` with `.keyboard` style so
/// iOS renders the native translucent blur backdrop that the stock keyboard
/// uses (requires the extension's `RequestsOpenAccess` to be true, which is
/// already set in the Info.plist written by this plugin).
class KeyboardView: UIInputView {

    weak var delegate: KeyboardViewDelegate?
    var heightConstraint: NSLayoutConstraint?

    private let theme = KeyboardTheme()
    private let topBar = KeyboardTopBar()
    private let keyPreview = KeyPreviewView()
    private let keyVariants = KeyVariantsView()
    private var rowStackView: UIStackView!
    private var keyButtons: [[KeyButton]] = []
    private var currentLayout: KeyboardLayout.LayoutMode = .letters
    private var shiftState: KeyboardLayout.ShiftState = .off
    private var micState: MicState = .idle
    private var returnKeyType: UIReturnKeyType = .default

    init() {
        super.init(frame: .zero, inputViewStyle: .keyboard)
        setupView()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupView()
    }

    private func setupView() {
        // The `.keyboard` input style supplies the backdrop; keep our own
        // `backgroundColor` clear so the blur shows through.
        backgroundColor = theme.keyboardBackground
        allowsSelfSizing = true

        topBar.delegate = self
        addSubview(topBar)

        rowStackView = UIStackView()
        rowStackView.axis = .vertical
        rowStackView.distribution = .fillEqually
        rowStackView.spacing = 11
        rowStackView.translatesAutoresizingMaskIntoConstraints = false

        addSubview(rowStackView)
        // Both popups sit above all other subviews. Variants is added last
        // so the accent popover renders above the typewriter balloon — in
        // practice only one is visible at a time.
        addSubview(keyPreview)
        addSubview(keyVariants)
        NSLayoutConstraint.activate([
            topBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            topBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            topBar.topAnchor.constraint(equalTo: topAnchor),
            topBar.heightAnchor.constraint(equalToConstant: KeyboardTopBar.preferredHeight),

            rowStackView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            rowStackView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            rowStackView.topAnchor.constraint(equalTo: topBar.bottomAnchor, constant: 4),
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
            rowView.spacing = 6
            rowView.alignment = .fill

            var rowButtons: [KeyButton] = []

            for keyDef in row {
                let button = KeyButton(keyDefinition: keyDef, theme: theme)
                button.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
                button.addTarget(self, action: #selector(keyTouchUp(_:)), for: .touchUpInside)
                button.addTarget(self, action: #selector(keyTouchCancel(_:)), for: [.touchUpOutside, .touchCancel])

                // Forward emoji long-press (iOS path to the keyboard picker).
                if keyDef.type == .emoji {
                    button.onLongPress = { [weak self] sender in
                        guard let self = self else { return }
                        self.delegate?.keyboardView(self, didLongPressEmojiFrom: sender)
                    }
                }

                // Letter keys with accent variants surface the variants popover.
                if keyDef.type == .character,
                   AccentVariants.hasVariants(for: keyDef.label) {
                    button.onAccentLongPress = { [weak self] btn, gr in
                        self?.handleAccentLongPress(button: btn, recognizer: gr)
                    }
                }

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
                    applyReturnKeyDisplay(to: button)
                default:
                    break
                }
                button.updateAppearance(theme: theme, micState: micState, shiftState: shiftState)
            }
        }
    }

    /// Applies either a text label ("Go", "Send", "Next", "Done") or an SF
    /// Symbol (`return`, `magnifyingglass`) to the return key so it matches
    /// the native keyboard's per-context return appearance.
    private func applyReturnKeyDisplay(to button: KeyButton) {
        switch returnKeyType {
        case .go: button.setDisplayLabel("Go")
        case .send: button.setDisplayLabel("Send")
        case .next: button.setDisplayLabel("Next")
        case .done: button.setDisplayLabel("Done")
        case .search, .google, .yahoo:
            button.setDisplaySymbol("magnifyingglass")
        default:
            button.setDisplaySymbol("return")
        }
    }

    // MARK: - Public API

    func updateReturnKeyType(_ type: UIReturnKeyType) {
        returnKeyType = type
        updateKeyLabels()
    }

    /// Exposes the current mic state so the hosting view controller can toggle
    /// recording without reaching into the AudioRecorder's private state.
    var currentMicState: MicState { micState }

    /// Forwards the recorder's normalised 0…1 input level to the top-bar
    /// waveform so the wave lines react to voice while recording.
    func setAudioLevel(_ level: Double) {
        topBar.setAudioLevel(level)
    }

    func setMicState(_ state: MicState) {
        micState = state
        topBar.setMicState(state)
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
        showPreviewIfCharacter(sender)
    }

    @objc private func keyTouchUp(_ sender: KeyButton) {
        sender.setPressed(false)
        keyPreview.hide()
        handleKeyAction(sender.keyDefinition)
    }

    @objc private func keyTouchCancel(_ sender: KeyButton) {
        sender.setPressed(false)
        keyPreview.hide()
    }

    private func handleAccentLongPress(
        button: KeyButton,
        recognizer gr: UILongPressGestureRecognizer
    ) {
        let variants = AccentVariants.variants(
            for: button.keyDefinition.label,
            uppercase: shiftState != .off
        )
        guard !variants.isEmpty else { return }

        switch gr.state {
        case .began:
            // Hide the typewriter balloon — the variants popover takes
            // over visual feedback for the rest of the press.
            keyPreview.hide()
            let keyFrame = button.convert(button.bounds, to: self)
            keyVariants.show(variants: variants, keyFrame: keyFrame, in: self)
        case .changed:
            keyVariants.updateHighlight(at: gr.location(in: self))
        case .ended:
            if let variant = keyVariants.selectedVariant() {
                delegate?.keyboardView(self, didTapCharacter: variant)
                if shiftState == .on {
                    shiftState = .off
                    updateKeyLabels()
                }
            }
            keyVariants.hide()
        case .cancelled, .failed:
            keyVariants.hide()
        default:
            break
        }
    }

    private func showPreviewIfCharacter(_ button: KeyButton) {
        let type = button.keyDefinition.type
        guard type == .character || type == .comma || type == .period else {
            return
        }
        let display: String
        switch type {
        case .character:
            display = shiftState != .off
                ? button.keyDefinition.label.uppercased()
                : button.keyDefinition.label
        case .comma: display = ","
        case .period: display = "."
        default: return
        }
        let keyFrame = button.convert(button.bounds, to: self)
        keyPreview.show(character: display, over: keyFrame, in: self)
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
        case .emoji:
            delegate?.keyboardViewDidTapEmoji(self)
        case .mic:
            // Mic key was replaced by the top-bar record button; no-op in
            // case a stale layout ever carries one.
            break
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

// MARK: - KeyboardTopBarDelegate

extension KeyboardView: KeyboardTopBarDelegate {
    func topBarDidTapRecord(_ topBar: KeyboardTopBar) {
        HapticManager.keyTap()
        delegate?.keyboardViewDidToggleRecord(self)
    }
}
