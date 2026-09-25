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

    /// Upper bounds on the modifier glyph's height, toggled by orientation.
    /// Landscape keys are much shorter, so the portrait 0.55 cap shrinks the
    /// shift/delete/return glyphs too far; landscape uses a looser cap so they
    /// read closer to the native size. Portrait keeps 0.55 (there the point
    /// size, not the cap, is the binding size).
    private var symbolHeightCapPortrait: NSLayoutConstraint?
    private var symbolHeightCapLandscape: NSLayoutConstraint?

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
        ])

        // Only one of these is active at a time (see `updateAppearance`).
        symbolHeightCapPortrait = symbolView.heightAnchor.constraint(
            lessThanOrEqualTo: heightAnchor, multiplier: 0.55
        )
        symbolHeightCapLandscape = symbolView.heightAnchor.constraint(
            lessThanOrEqualTo: heightAnchor, multiplier: 0.75
        )
        symbolHeightCapPortrait?.isActive = true

        if keyDefinition.type == .space {
            // Native keyboards print the active input languages here ("DE EN").
            // Echos is English-only for now, so there are no codes worth
            // printing — but the spacebar is still the one place a user can
            // tell *which* keyboard is currently up, so print the product name.
            let centerY = label.centerYAnchor.constraint(equalTo: centerYAnchor)
            centerY.isActive = true
            labelCenterYConstraint = centerY

            subLabel.isHidden = false
            subLabel.attributedText = NSAttributedString(
                string: "ECHOS",
                attributes: [.kern: 0.6]
            )
            NSLayoutConstraint.activate([
                subLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
                subLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -5),
            ])
        } else if let sub = keyDefinition.subLabel, !sub.isEmpty {
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

        if keyDefinition.type == .emoji {
            symbolView.image = KeyButton.emojiKeyGlyph
            symbolView.isHidden = false
            label.isHidden = true
        } else if let name = keyDefinition.symbolName {
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

    // Echos emoji-key face, drawn from `assets/icons/kb_emoji.svg` so it
    // matches the design exactly. Template mode so it follows
    // `symbolView.tintColor` like the SF-symbol key glyphs.
    private static let emojiKeyGlyph: UIImage = makeEmojiKeyGlyph()

    // SVG path data (absolute M/C/Z only). The face's bounding box within
    // the SVG canvas is `emojiFaceOrigin` + `emojiFaceSide`.
    private static let emojiPathData =
        "M14.5029 21.9313C10.5957 21.9313 7.42834 18.7639 7.42834 14.8567" +
        "C7.42834 10.9495 10.5957 7.78207 14.5029 7.78207" +
        "C18.4101 7.78207 21.5775 10.9495 21.5775 14.8567" +
        "C21.5775 18.7639 18.4101 21.9313 14.5029 21.9313ZM14.4946 19.8089" +
        "C11.9732 19.8089 9.58025 17.3906 9.58025 15.643" +
        "C9.58025 14.64 11.7595 15.8471 14.4946 15.8471" +
        "C17.2296 15.8471 19.4329 14.6416 19.4256 15.643" +
        "C19.4133 17.3366 17.0159 19.8089 14.4946 19.8089ZM14.4946 17.5804" +
        "C16.8389 17.5804 18.4606 16.6741 18.4606 16.0205" +
        "C18.4606 15.367 16.8389 16.4102 14.4946 16.4102" +
        "C12.1502 16.4102 10.5554 15.4922 10.5554 16.0205" +
        "C10.5554 16.5489 12.1502 17.5804 14.4946 17.5804ZM12.3717 13.6009" +
        "C11.9077 13.6009 11.5316 13.2248 11.5316 12.7608" +
        "C11.5316 12.2968 11.9077 11.9207 12.3717 11.9207" +
        "C12.8357 11.9207 13.2118 12.2968 13.2118 12.7608" +
        "C13.2118 13.2248 12.8357 13.6009 12.3717 13.6009ZM16.6165 13.6009" +
        "C16.1525 13.6009 15.7764 13.2248 15.7764 12.7608" +
        "C15.7764 12.2968 16.1525 11.9207 16.6165 11.9207" +
        "C17.0805 11.9207 17.4566 12.2968 17.4566 12.7608" +
        "C17.4566 13.2248 17.0805 13.6009 16.6165 13.6009Z"
    private static let emojiFaceOrigin = CGPoint(x: 7.42834, y: 7.78207)
    private static let emojiFaceSide: CGFloat = 14.1492

    private static func makeEmojiKeyGlyph() -> UIImage {
        // Rendered at 19pt so the face sits a touch smaller than the
        // neighboring SF-symbol key glyphs.
        let renderSide: CGFloat = 19
        let path = UIBezierPath()
        let tokens = emojiPathData
            .replacingOccurrences(of: "M", with: " M ")
            .replacingOccurrences(of: "C", with: " C ")
            .replacingOccurrences(of: "Z", with: " Z ")
            .split(separator: " ")
        var i = 0
        func point() -> CGPoint {
            defer { i += 2 }
            return CGPoint(x: Double(tokens[i])!, y: Double(tokens[i + 1])!)
        }
        while i < tokens.count {
            let command = tokens[i]
            i += 1
            switch command {
            case "M": path.move(to: point())
            case "C":
                let c1 = point(), c2 = point(), end = point()
                path.addCurve(to: end, controlPoint1: c1, controlPoint2: c2)
            default: path.close()
            }
        }
        let scale = renderSide / emojiFaceSide
        path.apply(CGAffineTransform(scaleX: scale, y: scale)
            .translatedBy(x: -emojiFaceOrigin.x, y: -emojiFaceOrigin.y))
        path.usesEvenOddFillRule = true

        let renderer = UIGraphicsImageRenderer(size: CGSize(width: renderSide, height: renderSide))
        let image = renderer.image { _ in
            UIColor.black.setFill()
            path.fill()
        }
        return image.withRenderingMode(.alwaysTemplate)
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
        // Glyph inverts to its filled variant while held whenever one is
        // defined — the delete/back key flips delete.left → delete.left.fill,
        // so the arrow fills with the key-text color and the × knocks out to
        // the (pressed) background. This runs alongside the background flash
        // for keys that also fill (delete), and is the sole feedback for the
        // flat numeric-pad keys that don't.
        if let pressedSymbol = keyDefinition.pressedSymbolName,
           let restSymbol = keyDefinition.symbolName {
            setDisplaySymbol(pressed ? pressedSymbol : restSymbol)
        } else if !keyDefinition.rendersIdleBackground {
            // Flat numeric-pad key with no pressed glyph (decimal separator):
            // dim the text instead, since it has no background fill.
            label.alpha = pressed ? 0.4 : 1.0
        }
    }

    /// Spacebar cursor-drag (trackpad) mode: native iOS blanks every key —
    /// glyphs vanish and the fill dims so the keyboard reads as a trackpad.
    /// Driven via `alpha` so it layers over (and reverses cleanly without
    /// disturbing) the color state owned by `updateAppearance`.
    func setTrackpadBlank(_ blank: Bool) {
        label.alpha = blank ? 0 : 1
        subLabel.alpha = blank ? 0 : 1
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
        // they read as undersized when the keys shrink to the landscape
        // height). The looser landscape glyph height cap (below) is what
        // actually lets those symbols grow, since the short keys otherwise
        // clamp them.
        let isLandscape = traitCollection.verticalSizeClass == .compact
        let characterFontSize: CGFloat = isLandscape ? 20 : 25
        let symbolPointSize: CGFloat = isLandscape ? 24 : 20
        symbolView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(
            pointSize: symbolPointSize, weight: .regular
        )
        symbolHeightCapPortrait?.isActive = !isLandscape
        symbolHeightCapLandscape?.isActive = isLandscape

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
            // Uppercase letters read heavier at a given point size (cap-height
            // vs x-height), so shave 2pt off shifted letter keys to match the
            // lowercase visual weight. Gated to actual letters so digit /
            // symbol character keys ("1", "$") are never affected.
            let isLetterKey = keyDefinition.type == .character
                && keyDefinition.label.count == 1
                && (keyDefinition.label.first?.isLetter ?? false)
            let uppercaseTrim: CGFloat = (isLetterKey && shiftState.isShifted) ? 2 : 0
            fontSize = keyDefinition.usesCompactLabelFont
                ? 17
                : characterFontSize - uppercaseTrim
            weight = .regular
        }

        label.textColor = textColor
        label.font = UIFont.systemFont(ofSize: fontSize, weight: weight)
        // `subLabel`'s color is otherwise fixed at init, so a theme swap would
        // leave the spacebar / numeric-pad hints on the previous palette.
        subLabel.textColor = theme.keyTextSecondary
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
        case .space, .delete, .returnKey:
            // The wide action keys flash to `wideKeyPressed` — same as the
            // modifier grey in light mode, but *lighter* than the idle key in
            // dark mode (native iOS lifts these on press).
            return pressed ? theme.wideKeyPressed : theme.keyBackground
        case .shift, .symbolSwitch, .globe, .emoji:
            // iOS 26 default: every key shares the letter-key fill; the
            // modifier keys flash to a darker grey while held.
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
