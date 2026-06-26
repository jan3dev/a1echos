import UIKit

/// A single keyboard key. Renders text labels for character keys and SF
/// Symbols (matching iOS's native keyboard glyphs) for modifier keys.
///
/// QWERTY keys run in `passiveHitTesting` mode (`isUserInteractionEnabled =
/// false`): touches pass through to `KeyboardView`'s multi-touch pipeline,
/// which routes each finger independently to fix the key-skipping that
/// `UIControl`'s single-touch model causes during fast roll-typing. The
/// button stays around as a pure visual cell — label, symbol, pressed state.
/// The emoji picker's bottom-bar buttons still use the legacy `UIControl`
/// target/action path because they're widely spaced and don't share a parent
/// with the QWERTY rows.
class KeyButton: UIControl {

    /// Called when a long-press begins on the key. Used by the emoji key to
    /// invoke the system keyboard picker (`handleInputModeList(from:with:)`),
    /// since the iOS layout no longer has a dedicated globe key. Only fires
    /// in legacy `UIControl` mode — in passive mode, `KeyboardView` schedules
    /// the long-press itself via the per-pointer timer.
    var onLongPress: ((KeyButton) -> Void)?

    let keyDefinition: KeyboardLayout.KeyDefinition
    var widthMultiplier: CGFloat = 1.0

    private let label = UILabel()
    private let subLabel = UILabel()
    private let symbolView = UIImageView()
    private let backgroundView = UIView()

    /// Vertical-centering constraint for the standalone label (the non-subLabel
    /// path). Its constant is recomputed by `updateLabelOpticalCentering` so the
    /// visible glyph box — not the font line box — is centered in the key.
    private var labelCenterYConstraint: NSLayoutConstraint?

    // Cached theme state for the pressed/highlighted recomputation.
    private var theme = KeyboardTheme()
    private var micState: MicState = .idle
    private var shiftState: KeyboardLayout.ShiftState = .off
    /// When true, the key renders with the accent (blue) fill and white
    /// glyph — used by the return key while we're in emoji-search mode so
    /// it reads as the "done / dismiss search" affordance.
    private var isPrimaryAction: Bool = false

    /// When true, the button doesn't participate in hit-testing: `KeyboardView`
    /// owns the touch pipeline and drives `setPressed` / commits directly.
    /// QWERTY keys use this; the emoji picker's bottom-bar keys don't.
    let passiveHitTesting: Bool

    /// True for character / comma / period keys — they get the tighter
    /// `cornerRadiusCharacter`. Everything else (modifiers, space, return)
    /// gets `cornerRadiusSystem`.
    private var isCharacterLike: Bool {
        switch keyDefinition.type {
        case .character, .comma, .period: return true
        default: return false
        }
    }

    init(
        keyDefinition: KeyboardLayout.KeyDefinition,
        theme: KeyboardTheme,
        passiveHitTesting: Bool = false
    ) {
        self.keyDefinition = keyDefinition
        self.theme = theme
        self.passiveHitTesting = passiveHitTesting
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
        //
        // Character keys get a slightly tighter radius than system keys so
        // the QWERTY rows read as a continuous band — KeyboardKit splits
        // these two via `KeyboardViewStyle`'s rounded-corner properties for
        // the same reason.
        backgroundView.layer.cornerRadius = isCharacterLike
            ? theme.cornerRadiusCharacter
            : theme.cornerRadiusSystem
        backgroundView.layer.cornerCurve = .continuous
        // Shadow disabled — flat keys read cleaner against the
        // translucent UIInputView backdrop. (The drop-shadow attempt
        // produced a faint visual seam on dark mode and looked dated
        // in light mode.) Keeping the masksToBounds = false line so
        // future popups / overlays can still render outside bounds.
        backgroundView.layer.shadowOpacity = 0
        backgroundView.layer.masksToBounds = false
        backgroundView.translatesAutoresizingMaskIntoConstraints = false
        backgroundView.isUserInteractionEnabled = false
        addSubview(backgroundView)

        label.textAlignment = .center
        label.translatesAutoresizingMaskIntoConstraints = false
        label.isUserInteractionEnabled = false
        addSubview(label)

        // Telephone letters under the numeric-pad digits (2 → ABC, etc.).
        // Small, tracked, and muted to match the native pad's secondary glyphs.
        subLabel.textAlignment = .center
        subLabel.font = .systemFont(ofSize: 9, weight: .regular)
        subLabel.textColor = theme.keyTextSecondary
        subLabel.translatesAutoresizingMaskIntoConstraints = false
        subLabel.isUserInteractionEnabled = false
        subLabel.isHidden = true
        addSubview(subLabel)

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

            symbolView.centerXAnchor.constraint(equalTo: centerXAnchor),
            symbolView.centerYAnchor.constraint(equalTo: centerYAnchor),
            symbolView.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.6),
            symbolView.heightAnchor.constraint(lessThanOrEqualTo: heightAnchor, multiplier: 0.55),
        ])

        if let sub = keyDefinition.subLabel, !sub.isEmpty {
            // Telephone-keypad digit: nudge the number up and tuck the small
            // letters just beneath it, mirroring the native numeric pad.
            subLabel.isHidden = false
            subLabel.attributedText = NSAttributedString(
                string: sub.uppercased(),
                attributes: [.kern: 1.5]
            )
            NSLayoutConstraint.activate([
                label.centerYAnchor.constraint(equalTo: centerYAnchor, constant: -7),
                subLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
                subLabel.topAnchor.constraint(equalTo: label.bottomAnchor, constant: -1),
            ])
        } else {
            let centerY = label.centerYAnchor.constraint(equalTo: centerYAnchor)
            centerY.isActive = true
            labelCenterYConstraint = centerY
        }

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

        // Passive keys disable their own touch handling so `KeyboardView`'s
        // multi-touch pipeline can receive every finger. Long-press handling
        // for emoji / accent variants is scheduled by the parent's per-pointer
        // timer instead of a per-button `UILongPressGestureRecognizer`.
        if passiveHitTesting {
            isUserInteractionEnabled = false
        } else if keyDefinition.type == .emoji {
            // Legacy path used only by the emoji picker's bottom bar — those
            // keys don't share a parent with the QWERTY rows, so they keep the
            // simpler single-touch UIControl flow.
            let lp = UILongPressGestureRecognizer(
                target: self, action: #selector(handleEmojiLongPress(_:))
            )
            lp.minimumPressDuration = 0.35
            lp.cancelsTouchesInView = false
            addGestureRecognizer(lp)
        }

        updateAppearance(theme: theme, micState: .idle, shiftState: .off)
    }

    @objc private func handleEmojiLongPress(_ gr: UILongPressGestureRecognizer) {
        if gr.state == .began {
            onLongPress?(self)
        }
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
        updateLabelOpticalCentering()
    }

    /// Assigns a specific SF Symbol (overrides the default in KeyDefinition).
    func setDisplaySymbol(_ systemName: String) {
        symbolView.image = UIImage(systemName: systemName)
        symbolView.isHidden = false
        label.isHidden = true
    }

    /// Toggle accent (blue, white-glyph) styling on this key. Used by
    /// `KeyboardView` for the return key while in `.emojiSearch`.
    func setPrimaryAction(_ primary: Bool) {
        guard isPrimaryAction != primary else { return }
        isPrimaryAction = primary
        let glyphTint: UIColor = primary ? theme.micButtonIcon : theme.keyText
        label.textColor = glyphTint
        symbolView.tintColor = glyphTint
        applyBackgroundColor(pressed: false)
    }

    func setPressed(_ pressed: Bool) {
        // Match the native keyboard's "fill flash" rather than a transform.
        UIView.animate(withDuration: pressed ? 0.02 : 0.12, delay: 0, options: .curveEaseOut) {
            self.applyBackgroundColor(pressed: pressed)
        }
        // Flat numeric-pad keys (delete, decimal separator) give their press
        // feedback through the glyph — no background fill. The icon swaps to its
        // filled (black) variant; a text glyph dims briefly. Driven by the whole
        // key's press state, so it reacts anywhere in the key, not just the glyph.
        guard !keyDefinition.rendersIdleBackground else { return }
        if let pressedSymbol = keyDefinition.pressedSymbolName,
           let restSymbol = keyDefinition.symbolName {
            setDisplaySymbol(pressed ? pressedSymbol : restSymbol)
        } else {
            label.alpha = pressed ? 0.4 : 1.0
        }
    }

    /// Spacebar cursor-drag (trackpad) mode: native iOS blanks every key —
    /// glyphs vanish and the fill dims so the keyboard reads as a trackpad.
    /// Driven via `alpha` so it layers over (and reverses cleanly without
    /// disturbing) the color state owned by `updateAppearance`.
    func setTrackpadBlank(_ blank: Bool) {
        label.alpha = blank ? 0 : 1
        symbolView.alpha = blank ? 0 : 1
        backgroundView.alpha = blank ? 0.4 : 1
    }

    func updateAppearance(
        theme: KeyboardTheme,
        micState: MicState,
        shiftState: KeyboardLayout.ShiftState
    ) {
        self.theme = theme
        self.micState = micState
        self.shiftState = shiftState

        // Landscape uses smaller character glyphs (matches native iOS)
        // and bigger SF Symbol icons (shift / delete / return / emoji —
        // they read as undersized at the portrait 20 pt pointSize when
        // the keys themselves shrink to 28.75 pt landscape height).
        let isLandscape = traitCollection.verticalSizeClass == .compact
        let characterFontSize: CGFloat = isLandscape ? 22 : 25
        let symbolPointSize: CGFloat = isLandscape ? 24 : 20
        symbolView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(
            pointSize: symbolPointSize, weight: .regular
        )

        let textColor: UIColor
        let tintColor: UIColor
        let fontSize: CGFloat

        // Sizes sampled against iPhone 17 Pro stock keyboard — character
        // keys ~25pt portrait / 22 landscape, modifier text (123/ABC)
        // ~17pt, return ~17pt semibold.
        let weight: UIFont.Weight
        switch keyDefinition.type {
        case .mic:
            textColor = theme.micButtonIcon
            tintColor = theme.micButtonIcon
            fontSize = 18
            weight = .regular

        case .returnKey:
            // The blue accent-fill variant (used in `.emojiSearch`) needs
            // a white glyph for contrast. `setPrimaryAction` already set
            // this earlier, but `updateAppearance` runs right after and
            // would otherwise reset the tint back to `theme.keyText`,
            // turning the check black against the blue pill.
            textColor = isPrimaryAction ? theme.micButtonIcon : theme.keyText
            tintColor = isPrimaryAction ? theme.micButtonIcon : theme.keyText
            fontSize = 17
            weight = .semibold

        case .shift:
            // iOS 26 swaps the outlined arrow for `shift.fill` (or
            // `capslock.fill` when locked) while keeping the white-key
            // background — no brand-color highlight.
            textColor = theme.keyText
            tintColor = theme.keyText
            weight = shiftState.isShifted ? .semibold : .regular
            fontSize = 17
            switch shiftState {
            case .off, .manualFromAuto: setDisplaySymbol("shift")
            case .on, .automatic: setDisplaySymbol("shift.fill")
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
            // URL-variant `/` and `.com` opt into the smaller modifier-key
            // size so they don't tower over the rest of the row (native iOS).
            fontSize = keyDefinition.usesCompactLabelFont ? 17 : characterFontSize
            weight = .regular
        }

        label.textColor = textColor
        label.font = UIFont.systemFont(ofSize: fontSize, weight: weight)
        updateLabelOpticalCentering()
        symbolView.tintColor = tintColor
        applyBackgroundColor(pressed: false)
    }

    // MARK: - Private

    /// Centers the *visible* glyph box (x-height for lowercase, cap-height for
    /// uppercase/digits) instead of the font line box. The line box reserves
    /// descender padding below the baseline that most glyphs don't fill, so a
    /// plainly centered label renders its letters slightly low — most visibly
    /// on the unshifted lowercase keys. Recomputed whenever the font or the
    /// label's case changes.
    private func updateLabelOpticalCentering() {
        guard let constraint = labelCenterYConstraint,
              !label.isHidden,
              let font = label.font,
              let text = label.text, !text.isEmpty
        else { return }
        // `font.descender` is negative; `ascender + descender` is the line box
        // height. The glyph rests on the baseline, so its center sits this far
        // below the line-box center — lift the label by that amount.
        let hasLowercase = text != text.uppercased()
        let glyphHeight = hasLowercase ? font.xHeight : font.capHeight
        let dropBelowCenter = (font.ascender + font.descender - glyphHeight) / 2
        constraint.constant = -dropBelowCenter
    }

    private func applyBackgroundColor(pressed: Bool) {
        backgroundView.backgroundColor = resolvedBackgroundColor(pressed: pressed)
    }

    private func resolvedBackgroundColor(pressed: Bool) -> UIColor {
        if isPrimaryAction {
            // Accent-fill action button (return key during emoji search).
            return pressed
                ? theme.micButtonBackground.withAlphaComponent(0.85)
                : theme.micButtonBackground
        }
        // Numeric-pad functional keys (delete, decimal separator) never fill —
        // their press feedback comes from the glyph (filled icon / dim), so the
        // background stays clear in every state.
        if !keyDefinition.rendersIdleBackground {
            return .clear
        }
        // Numeric-pad digits have no typewriter balloon, so they flash on press
        // for feedback (QWERTY character keys leave this off — the balloon is
        // their feedback and they never flash).
        if keyDefinition.flashesOnPress {
            return pressed ? theme.specialKeyPressed : theme.keyBackground
        }
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
        case .spacer:
            // Never reached — `buildLayout` filters spacers out before
            // constructing a KeyButton — but Swift's exhaustive switch
            // demands the case. Return transparent so a stray render
            // wouldn't introduce a visible artifact.
            return .clear
        }
    }
}
