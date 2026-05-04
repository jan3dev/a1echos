import UIKit

/// Delegate protocol for keyboard actions.
protocol KeyboardViewDelegate: AnyObject {
    func keyboardView(_ view: KeyboardView, didTapCharacter char: String)
    func keyboardViewDidTapDelete(_ view: KeyboardView)
    /// Fired by the delete key's hold-to-repeat timer once the user has held
    /// past the word-deletion threshold (matches native iOS behaviour where
    /// long holds escalate from per-character to per-word deletion).
    func keyboardViewDidHoldDeleteWord(_ view: KeyboardView)
    func keyboardViewDidTapSpace(_ view: KeyboardView)
    func keyboardViewDidTapReturn(_ view: KeyboardView)
    func keyboardViewDidTapGlobe(_ view: KeyboardView)
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
    private let banner = KeyboardBannerView()
    private var rowStackView: UIStackView!
    private var emojiPickerView: EmojiPickerView?
    private var keyButtons: [[KeyButton]] = []
    private var currentLayout: KeyboardLayout.LayoutMode = .letters
    private var shiftState: KeyboardLayout.ShiftState = .off
    private var micState: MicState = .idle
    private var returnKeyType: UIReturnKeyType = .default
    private var bannerHideTimer: Timer?

    // Delete key auto-repeat: matches native iOS cadence — char-rate after
    // a 0.4 s hold, escalating to word-rate after the press passes ~1.5 s.
    private var deleteTimer: Timer?
    private var deleteHoldStart: Date?
    private var deleteDidRepeat = false
    private static let deleteInitialDelay: TimeInterval = 0.4
    private static let deleteCharInterval: TimeInterval = 0.08
    private static let deleteWordThreshold: TimeInterval = 1.5
    private static let deleteWordInterval: TimeInterval = 0.2

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
        // Inline banner sits over the top bar and tells the user what to
        // do when the keyboard can't reach the main app (force-killed,
        // first-launch, etc.). Hidden by default; shown via
        // `showOpenAppPrompt(_:)`. Added before the popups so accent /
        // typewriter popovers always render above it.
        banner.translatesAutoresizingMaskIntoConstraints = false
        banner.isHidden = true
        addSubview(banner)
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

            banner.leadingAnchor.constraint(equalTo: leadingAnchor),
            banner.trailingAnchor.constraint(equalTo: trailingAnchor),
            banner.topAnchor.constraint(equalTo: topAnchor),
            banner.heightAnchor.constraint(equalToConstant: KeyboardTopBar.preferredHeight),
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

        if currentLayout == .emoji {
            rowStackView.isHidden = true
            installEmojiPickerIfNeeded()
            emojiPickerView?.isHidden = false
            emojiPickerView?.refreshRecents()
            return
        }

        emojiPickerView?.isHidden = true
        rowStackView.isHidden = false

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
        // Skip the (full-keyboard) `updateKeyLabels` walk when the return
        // type hasn't actually changed — `textDidChange` fires this on
        // every keystroke, and the type only changes when the host swaps
        // text fields. This single guard removes a per-keystroke iteration
        // over every key in the layout.
        guard type != returnKeyType else { return }
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
        presentBanner(message: message)
    }

    /// Show a recoverable "open the main app" prompt over the top bar.
    /// Used both for the pre-flight ping (before recording) and for the
    /// post-record timeout case (when the main app went away mid-flight).
    /// Stays visible longer than transient errors so the user actually
    /// reads it before tabbing back to Echos.
    func showOpenAppPrompt(_ message: String) {
        UIAccessibility.post(notification: .announcement, argument: message)
        presentBanner(message: message, autoHideAfter: 5.0)
    }

    private func presentBanner(
        message: String, autoHideAfter seconds: TimeInterval = 3.0
    ) {
        bannerHideTimer?.invalidate()
        banner.setMessage(message)
        if banner.isHidden {
            banner.alpha = 0
            banner.isHidden = false
            UIView.animate(withDuration: 0.18) { self.banner.alpha = 1 }
        }
        bannerHideTimer = Timer.scheduledTimer(
            withTimeInterval: seconds, repeats: false
        ) { [weak self] _ in
            self?.dismissBanner()
        }
    }

    private func dismissBanner() {
        bannerHideTimer?.invalidate()
        bannerHideTimer = nil
        UIView.animate(
            withDuration: 0.18,
            animations: { self.banner.alpha = 0 },
            completion: { _ in self.banner.isHidden = true }
        )
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
        if sender.keyDefinition.type == .delete {
            startDeleteRepeat()
        }
    }

    @objc private func keyTouchUp(_ sender: KeyButton) {
        sender.setPressed(false)
        keyPreview.hide()
        if sender.keyDefinition.type == .delete {
            // If the hold timer already fired one or more repeats we treat
            // this as the release of an autorepeat — skip the trailing
            // single-tap delete so we don't double-delete.
            let suppressTap = deleteDidRepeat
            stopDeleteRepeat()
            if suppressTap { return }
        }
        handleKeyAction(sender.keyDefinition)
    }

    @objc private func keyTouchCancel(_ sender: KeyButton) {
        sender.setPressed(false)
        keyPreview.hide()
        if sender.keyDefinition.type == .delete {
            stopDeleteRepeat()
        }
    }

    // MARK: - Delete auto-repeat

    private func startDeleteRepeat() {
        deleteDidRepeat = false
        deleteHoldStart = Date()
        deleteTimer?.invalidate()
        deleteTimer = Timer.scheduledTimer(
            withTimeInterval: KeyboardView.deleteInitialDelay,
            repeats: false
        ) { [weak self] _ in
            self?.fireDeleteRepeat()
            self?.scheduleDeleteRepeat()
        }
    }

    private func scheduleDeleteRepeat() {
        deleteTimer?.invalidate()
        deleteTimer = Timer.scheduledTimer(
            withTimeInterval: KeyboardView.deleteCharInterval,
            repeats: true
        ) { [weak self] _ in
            self?.fireDeleteRepeat()
        }
    }

    private func fireDeleteRepeat() {
        deleteDidRepeat = true
        let elapsed = Date().timeIntervalSince(deleteHoldStart ?? Date())
        if elapsed > KeyboardView.deleteWordThreshold {
            // Escalate to word-rate the first time we cross the threshold.
            if deleteTimer?.timeInterval != KeyboardView.deleteWordInterval {
                deleteTimer?.invalidate()
                deleteTimer = Timer.scheduledTimer(
                    withTimeInterval: KeyboardView.deleteWordInterval,
                    repeats: true
                ) { [weak self] _ in
                    self?.fireDeleteRepeat()
                }
            }
            delegate?.keyboardViewDidHoldDeleteWord(self)
        } else {
            delegate?.keyboardViewDidTapDelete(self)
        }
    }

    private func stopDeleteRepeat() {
        deleteTimer?.invalidate()
        deleteTimer = nil
        deleteHoldStart = nil
        deleteDidRepeat = false
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
            // iOS gives third-party keyboards no API to programmatically
            // jump to the system Emoji keyboard — instead we swap the row
            // area for an in-keyboard emoji picker.
            switchToLayout(.emoji)
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
            case .numbers, .symbols, .emoji: switchToLayout(.letters)
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

// MARK: - Emoji picker

extension KeyboardView: EmojiPickerViewDelegate {

    fileprivate func installEmojiPickerIfNeeded() {
        guard emojiPickerView == nil else { return }
        let picker = EmojiPickerView(theme: theme)
        picker.translatesAutoresizingMaskIntoConstraints = false
        picker.delegate = self
        // Match the rowStackView constraints so the picker fills the same
        // area the QWERTY rows would occupy.
        addSubview(picker)
        NSLayoutConstraint.activate([
            picker.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            picker.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            picker.topAnchor.constraint(equalTo: topBar.bottomAnchor, constant: 4),
            picker.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])
        // Keep the popups (preview / variants) above the picker.
        bringSubviewToFront(keyPreview)
        bringSubviewToFront(keyVariants)
        emojiPickerView = picker
    }

    func emojiPicker(_ view: EmojiPickerView, didSelect emoji: String) {
        delegate?.keyboardView(self, didTapCharacter: emoji)
    }

    func emojiPicker(_ view: EmojiPickerView, registerBottomBarKey button: KeyButton) {
        // Wire the picker's bottom-bar keys into the same touch pipeline as
        // regular keys so delete inherits hold-to-repeat and ABC / space
        // route through `handleKeyAction`.
        button.addTarget(self, action: #selector(keyTouchDown(_:)), for: .touchDown)
        button.addTarget(self, action: #selector(keyTouchUp(_:)), for: .touchUpInside)
        button.addTarget(
            self,
            action: #selector(keyTouchCancel(_:)),
            for: [.touchUpOutside, .touchCancel]
        )
    }
}

// MARK: - Banner

/// Inline status banner shown over the top bar when the keyboard needs
/// to relay a recoverable error or instruction to the user — typically
/// "Open Echos to enable voice typing" when the main app isn't running.
/// Keyboard extensions can't open URLs reliably, so the banner is
/// informational only.
final class KeyboardBannerView: UIView {

    private let label = UILabel()
    private let pill = UIView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        backgroundColor = .clear
        isUserInteractionEnabled = false

        pill.translatesAutoresizingMaskIntoConstraints = false
        pill.backgroundColor = UIColor(hex: 0x707171)
        pill.layer.cornerRadius = 14
        pill.layer.cornerCurve = .continuous
        addSubview(pill)

        label.translatesAutoresizingMaskIntoConstraints = false
        label.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        label.textColor = UIColor(hex: 0xF5F5F8)
        label.textAlignment = .center
        label.adjustsFontSizeToFitWidth = true
        label.minimumScaleFactor = 0.85
        label.numberOfLines = 1
        pill.addSubview(label)

        NSLayoutConstraint.activate([
            pill.centerXAnchor.constraint(equalTo: centerXAnchor),
            pill.centerYAnchor.constraint(equalTo: centerYAnchor),
            pill.heightAnchor.constraint(equalToConstant: 28),
            pill.leadingAnchor.constraint(
                greaterThanOrEqualTo: leadingAnchor, constant: 16
            ),
            pill.trailingAnchor.constraint(
                lessThanOrEqualTo: trailingAnchor, constant: -16
            ),

            label.leadingAnchor.constraint(equalTo: pill.leadingAnchor, constant: 14),
            label.trailingAnchor.constraint(equalTo: pill.trailingAnchor, constant: -14),
            label.topAnchor.constraint(equalTo: pill.topAnchor),
            label.bottomAnchor.constraint(equalTo: pill.bottomAnchor),
        ])
    }

    func setMessage(_ text: String) {
        label.text = text
    }
}
