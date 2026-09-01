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

    // Native iOS draws its emoji-key affordance as an open-mouth grin
    // (teeth included): light theme is an outlined face with a filled
    // mouth, dark theme a solid disc with the features punched out.
    // No SF Symbol matches, so render both by hand and pair them in a
    // UIImageAsset so the image view swaps variants on trait changes.
    // Template mode so they follow `symbolView.tintColor` like SF glyphs.
    private static let emojiKeyGlyph: UIImage = {
        let asset = UIImageAsset()
        asset.register(
            makeEmojiKeyGlyph(outlined: true),
            with: UITraitCollection(userInterfaceStyle: .light)
        )
        asset.register(
            makeEmojiKeyGlyph(outlined: false),
            with: UITraitCollection(userInterfaceStyle: .dark)
        )
        return asset.image(with: UITraitCollection(userInterfaceStyle: .light))
    }()

    private static func makeEmojiKeyGlyph(outlined: Bool) -> UIImage {
        // Geometry is authored in 22pt space; rendered at 19pt so the face
        // sits a touch smaller than the neighboring SF-symbol key glyphs.
        let side: CGFloat = 22
        let renderSide: CGFloat = 19
        // Outlined variant draws the features in; filled variant carves
        // them out of the solid disc. Same geometry, inverted blends.
        let featureMode: CGBlendMode = outlined ? .normal : .clear
        let teethMode: CGBlendMode = outlined ? .clear : .normal
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: renderSide, height: renderSide))
        let image = renderer.image { ctx in
            ctx.cgContext.scaleBy(x: renderSide / side, y: renderSide / side)
            UIColor.black.setFill()
            UIColor.black.setStroke()

            if outlined {
                let lineWidth: CGFloat = 1.5
                let outline = UIBezierPath(ovalIn: CGRect(
                    x: lineWidth / 2, y: lineWidth / 2,
                    width: side - lineWidth, height: side - lineWidth
                ))
                outline.lineWidth = lineWidth
                outline.stroke()
            } else {
                UIBezierPath(
                    ovalIn: CGRect(x: 0, y: 0, width: side, height: side)
                ).fill()
            }

            for eyeX: CGFloat in [7.4, 14.6] {
                UIBezierPath(ovalIn: CGRect(
                    x: eyeX - 1.3, y: 6.2, width: 2.6, height: 3.0
                )).fill(with: featureMode, alpha: 1)
            }

            let cx = side / 2
            let mouthL = CGPoint(x: 5.4, y: 11.4)
            let mouthR = CGPoint(x: 16.6, y: 11.4)
            let lipControl = CGPoint(x: cx, y: 13.8)

            // Full open mouth: a lip line whose corners curve up to the
            // sides, closed by a wide arc below.
            let mouth = UIBezierPath()
            mouth.move(to: mouthL)
            mouth.addQuadCurve(to: mouthR, controlPoint: lipControl)
            mouth.addArc(
                withCenter: CGPoint(x: cx, y: 11.4), radius: 5.6,
                startAngle: 0, endAngle: .pi, clockwise: true
            )
            mouth.close()
            mouth.fill(with: featureMode, alpha: 1)

            // Teeth: a band inset inside the opening, parallel to the lip
            // line — the untouched rim of the mouth doubles as the lip, so
            // no stroking (and no asymmetric line caps) is needed.
            let teeth = UIBezierPath()
            teeth.move(to: CGPoint(x: mouthL.x + 1.4, y: mouthL.y + 1.3))
            teeth.addQuadCurve(
                to: CGPoint(x: mouthR.x - 1.4, y: mouthR.y + 1.3),
                controlPoint: CGPoint(x: cx, y: lipControl.y + 1.3)
            )
            teeth.addQuadCurve(
                to: CGPoint(x: mouthL.x + 1.4, y: mouthL.y + 1.3),
                controlPoint: CGPoint(x: cx, y: lipControl.y + 4.1)
            )
            teeth.close()
            teeth.fill(with: teethMode, alpha: 1)
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
