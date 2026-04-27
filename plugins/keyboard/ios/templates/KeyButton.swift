import UIKit

/// A single keyboard key. Renders text labels for character keys and SF
/// Symbols (matching iOS's native keyboard glyphs) for modifier keys.
class KeyButton: UIControl {

    /// Called when a long-press begins on the key. Used by the emoji key to
    /// invoke the system keyboard picker (`handleInputModeList(from:with:)`),
    /// since the iOS layout no longer has a dedicated globe key.
    var onLongPress: ((KeyButton) -> Void)?

    /// Drives the accent-variants popover for letter keys with an entry in
    /// `AccentVariants`. Forwards the recognizer's full lifecycle so the
    /// keyboard view can show the popover, track drag-to-select, and
    /// commit on release.
    var onAccentLongPress: ((KeyButton, UILongPressGestureRecognizer) -> Void)?

    let keyDefinition: KeyboardLayout.KeyDefinition
    var widthMultiplier: CGFloat = 1.0

    private let label = UILabel()
    private let symbolView = UIImageView()
    private let backgroundView = UIView()

    // Cached theme state for the pressed/highlighted recomputation.
    private var theme = KeyboardTheme()
    private var micState: MicState = .idle
    private var shiftState: KeyboardLayout.ShiftState = .off

    init(keyDefinition: KeyboardLayout.KeyDefinition, theme: KeyboardTheme) {
        self.keyDefinition = keyDefinition
        self.theme = theme
        super.init(frame: .zero)
        setupView()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) not implemented")
    }

    private func setupView() {
        // Background view: continuous-curve rounded rect + subtle drop
        // shadow, matching the stock iOS keyboard's floating-key look.
        // `masksToBounds` stays false so the shadow can render outside the
        // bounds; the background color is clipped by `cornerRadius`.
        backgroundView.layer.cornerRadius = 8
        backgroundView.layer.cornerCurve = .continuous
        backgroundView.layer.shadowColor = theme.keyShadow.cgColor
        backgroundView.layer.shadowOpacity = 1.0 // alpha already baked into keyShadow
        backgroundView.layer.shadowOffset = CGSize(width: 0, height: 1)
        backgroundView.layer.shadowRadius = 0
        backgroundView.layer.masksToBounds = false
        backgroundView.translatesAutoresizingMaskIntoConstraints = false
        backgroundView.isUserInteractionEnabled = false
        addSubview(backgroundView)

        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isUserInteractionEnabled = false
        addSubview(label)

        symbolView.contentMode = .scaleAspectFit
        symbolView.translatesAutoresizingMaskIntoConstraints = false
        symbolView.isUserInteractionEnabled = false
        symbolView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(
            pointSize: 20, weight: .regular
        )
        symbolView.isHidden = true
        addSubview(symbolView)

        NSLayoutConstraint.activate([
            backgroundView.leadingAnchor.constraint(equalTo: leadingAnchor),
            backgroundView.trailingAnchor.constraint(equalTo: trailingAnchor),
            backgroundView.topAnchor.constraint(equalTo: topAnchor),
            backgroundView.bottomAnchor.constraint(equalTo: bottomAnchor),

            label.centerXAnchor.constraint(equalTo: centerXAnchor),
            label.centerYAnchor.constraint(equalTo: centerYAnchor),

            symbolView.centerXAnchor.constraint(equalTo: centerXAnchor),
            symbolView.centerYAnchor.constraint(equalTo: centerYAnchor),
            symbolView.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.6),
            symbolView.heightAnchor.constraint(lessThanOrEqualTo: heightAnchor, multiplier: 0.55),
        ])

        if let name = keyDefinition.symbolName {
            symbolView.image = UIImage(systemName: name)
            symbolView.isHidden = false
            label.isHidden = true
        } else {
            label.text = keyDefinition.label
        }

        isAccessibilityElement = true
        accessibilityLabel = keyDefinition.accessibilityLabel
        accessibilityTraits = .keyboardKey

        // Long-press recognizers are attached conditionally so they don't
        // interfere with regular tap handling on keys that don't need
        // them. The emoji key surfaces the system keyboard picker; letter
        // keys with accent variants surface the variants popover.
        if keyDefinition.type == .emoji {
            let lp = UILongPressGestureRecognizer(
                target: self, action: #selector(handleEmojiLongPress(_:))
            )
            lp.minimumPressDuration = 0.35
            lp.cancelsTouchesInView = false
            addGestureRecognizer(lp)
        } else if keyDefinition.type == .character,
                  AccentVariants.hasVariants(for: keyDefinition.label) {
            let lp = UILongPressGestureRecognizer(
                target: self, action: #selector(handleAccentLongPress(_:))
            )
            lp.minimumPressDuration = 0.4
            // Cancel the underlying touch when the popover takes over so
            // the tap won't also commit the original character.
            lp.cancelsTouchesInView = true
            addGestureRecognizer(lp)
        }

        updateAppearance(theme: theme, micState: .idle, shiftState: .off)
    }

    @objc private func handleEmojiLongPress(_ gr: UILongPressGestureRecognizer) {
        if gr.state == .began {
            onLongPress?(self)
        }
    }

    @objc private func handleAccentLongPress(_ gr: UILongPressGestureRecognizer) {
        onAccentLongPress?(self, gr)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        // Pre-compute the shadow path so Core Animation doesn't have to
        // rasterize the alpha mask each frame — matches the cheap way
        // stock iOS renders per-key shadows.
        backgroundView.layer.shadowPath = UIBezierPath(
            roundedRect: backgroundView.bounds,
            cornerRadius: backgroundView.layer.cornerRadius
        ).cgPath
    }

    // MARK: - Public

    /// Updates the character label. Ignored for keys that carry an SF Symbol
    /// by default (shift / delete / globe / mic) — those never flip to text.
    /// The return key uses `setReturnDisplay` to switch between text and
    /// symbol variants.
    func setDisplayLabel(_ text: String) {
        guard keyDefinition.symbolName == nil || keyDefinition.type == .returnKey else {
            return
        }
        label.text = text
        label.isHidden = false
        symbolView.isHidden = true
    }

    /// Assigns a specific SF Symbol (overrides the default in KeyDefinition).
    func setDisplaySymbol(_ systemName: String) {
        symbolView.image = UIImage(systemName: systemName)
        symbolView.isHidden = false
        label.isHidden = true
    }

    func setPressed(_ pressed: Bool) {
        // Match the native keyboard's "fill flash" rather than a transform.
        UIView.animate(withDuration: pressed ? 0.02 : 0.12, delay: 0, options: .curveEaseOut) {
            self.applyBackgroundColor(pressed: pressed)
        }
    }

    func updateAppearance(
        theme: KeyboardTheme,
        micState: MicState,
        shiftState: KeyboardLayout.ShiftState
    ) {
        self.theme = theme
        self.micState = micState
        self.shiftState = shiftState

        let textColor: UIColor
        let tintColor: UIColor
        let fontSize: CGFloat

        // Sizes sampled against iPhone 17 Pro stock keyboard — character
        // keys ~25pt, modifier text (123/ABC) ~17pt, return ~17pt semibold.
        let weight: UIFont.Weight
        switch keyDefinition.type {
        case .mic:
            textColor = theme.micButtonIcon
            tintColor = theme.micButtonIcon
            fontSize = 18
            weight = .regular

        case .returnKey:
            textColor = theme.keyText
            tintColor = theme.keyText
            fontSize = 17
            weight = .semibold

        case .shift:
            // iOS 26 swaps the outlined arrow for `shift.fill` (or
            // `capslock.fill` when locked) while keeping the white-key
            // background — no brand-color highlight.
            textColor = theme.keyText
            tintColor = theme.keyText
            weight = shiftState == .off ? .regular : .semibold
            fontSize = 17
            switch shiftState {
            case .off: setDisplaySymbol("shift")
            case .on: setDisplaySymbol("shift.fill")
            case .capsLock: setDisplaySymbol("capslock.fill")
            }

        case .delete, .modeSwitch, .symbolSwitch, .globe, .emoji:
            textColor = theme.keyText
            tintColor = theme.keyText
            fontSize = 17
            weight = .regular

        case .space:
            textColor = theme.keyText
            tintColor = theme.keyText
            fontSize = 17
            weight = .regular

        default:
            textColor = theme.keyText
            tintColor = theme.keyText
            fontSize = 25
            weight = .regular
        }

        label.textColor = textColor
        label.font = UIFont.systemFont(ofSize: fontSize, weight: weight)
        symbolView.tintColor = tintColor
        applyBackgroundColor(pressed: false)
    }

    // MARK: - Private

    private func applyBackgroundColor(pressed: Bool) {
        backgroundView.backgroundColor = resolvedBackgroundColor(pressed: pressed)
    }

    private func resolvedBackgroundColor(pressed: Bool) -> UIColor {
        switch keyDefinition.type {
        case .mic:
            switch micState {
            case .recording: return theme.micButtonRecording
            case .transcribing: return theme.micButtonBackground.withAlphaComponent(0.7)
            case .idle: return theme.micButtonBackground
            }
        case .shift, .delete, .symbolSwitch, .globe, .emoji, .space, .returnKey:
            // iOS 26 default: every key shares the letter-key fill; the
            // modifier and space/return keys flash to a darker grey while
            // held.
            return pressed ? theme.specialKeyPressed : theme.keyBackground
        case .modeSwitch:
            // 123 / ABC commits the layout switch immediately, so iOS skips
            // the press flash to avoid a one-frame color blink.
            return theme.keyBackground
        case .character, .comma, .period:
            // Letter / punctuation keys never flash — the popup balloon
            // provides the visual feedback for their press.
            return theme.keyBackground
        }
    }
}
