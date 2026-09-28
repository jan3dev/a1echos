import Foundation

/// Defines keyboard layouts: QWERTY letters, numbers, and symbols.
enum KeyboardLayout {

    enum KeyType {
        case character
        case shift
        case delete
        case space
        case returnKey
        case mic
        case modeSwitch    // 123 / ABC toggle
        case globe         // Switch keyboard
        case emoji         // Jump to the next keyboard (emoji if user has it installed)
        case symbolSwitch  // #+= / 123 toggle
        case comma
        case period
        /// Invisible width-only filler. Renders as a transparent UIView in
        /// `KeyboardView.buildLayout` so we can reproduce native iOS's
        /// row-2 indent and the extra padding around shift/delete on
        /// row 3 without hardcoding device-specific inset values.
        case spacer
    }

    enum LayoutMode {
        case letters
        case numbers
        case symbols
        case emoji
        /// Emoji-search sub-mode: the topBar is replaced with a search
        /// overlay (text field + horizontal strip of matching emojis), and
        /// the regular QWERTY rows are shown so the user can type their
        /// query. Character keys are intercepted by `KeyboardView` and
        /// routed to the search query instead of the host's text proxy.
        case emojiSearch
        /// Apple-minimal numeric pad for `UIKeyboardType.numberPad`. The
        /// top bar (mic / suggestion strip) is dropped for the compact
        /// native look; a globe key keeps the required keyboard-switch
        /// affordance. See §9.1.
        case numberPad
        /// `numberPad` + a decimal `.` key, for `UIKeyboardType.decimalPad`.
        case decimalPad
        /// QWERTY tuned for `UIKeyboardType.URL`: native iOS drops the spacebar
        /// (URLs have no spaces) and surfaces `.` `/` `.com` in its place. §9.1.
        case urlLetters
        /// QWERTY tuned for `UIKeyboardType.emailAddress`: `@` and `.` sit beside
        /// a slightly shrunk spacebar. §9.1.
        case emailLetters
        /// QWERTY tuned for `UIKeyboardType.twitter`: `@` and `#` sit beside a
        /// slightly shrunk spacebar (mirrors `emailLetters` with `#` for `.`). §9.1.
        case twitter
        /// QWERTY tuned for `UIKeyboardType.webSearch`: a `.` sits beside the
        /// spacebar; the host's Search return key is already mapped. §9.1.
        case webSearch
    }

    /// LatinIME-style 6-state shift machine. `automatic` is rendered the
    /// same as `on` but drops to `off` after one keystroke without
    /// feeling like the user undid a deliberate shift. `manualFromAuto`
    /// is the transient "user cancelled the auto-shift" state, rendered
    /// as `off`: one tap from `automatic` lands here (so the user clears
    /// an unwanted auto-shift with one tap, not two); a further tap → `on`.
    enum ShiftState {
        case off
        case on
        case automatic
        case manualFromAuto
        case capsLock

        /// True when character keys should commit uppercase.
        var isShifted: Bool {
            switch self {
            case .off, .manualFromAuto: return false
            case .on, .automatic, .capsLock: return true
            }
        }
    }

    /// A single key. `label` is the text drawn for character keys; `symbolName`
    /// (when set) is the SF Symbol drawn for modifier keys so they match the
    /// native iOS keyboard's glyphs.
    struct KeyDefinition {
        let label: String
        let type: KeyType
        let widthWeight: CGFloat
        /// Weight used in phone landscape; nil = `widthWeight`.
        let landscapeWidthWeight: CGFloat?
        let accessibilityLabel: String
        let symbolName: String?
        /// SF Symbol swapped in while the key is held — used by the flat
        /// numeric-pad keys to show a filled (black) glyph on press instead of
        /// a background fill. Nil = no swap.
        let pressedSymbolName: String?
        /// Small secondary text drawn beneath the main label — the telephone
        /// letters (ABC, DEF…) under the numeric-pad digits. Nil for most keys.
        let subLabel: String?
        /// When false the key has no fill at rest (only the press flash shows),
        /// matching the native numeric pad's flat functional keys (delete,
        /// decimal separator). Defaults true (the standard filled key).
        let rendersIdleBackground: Bool
        /// When true the key flashes to the pressed fill on touch. Numeric-pad
        /// digits opt in because they have no typewriter balloon; QWERTY
        /// character keys leave it off (the balloon is their feedback).
        let flashesOnPress: Bool
        /// When true the character label renders at the smaller modifier-key
        /// font (≈17pt) instead of the full 25pt character size. Used by the
        /// URL variant's `/` and `.com` keys so they match native iOS, where
        /// the field-punctuation keys are smaller than the letters.
        let usesCompactLabelFont: Bool

        init(
            label: String,
            type: KeyType = .character,
            widthWeight: CGFloat = 1.0,
            landscapeWidthWeight: CGFloat? = nil,
            accessibilityLabel: String? = nil,
            symbolName: String? = nil,
            pressedSymbolName: String? = nil,
            subLabel: String? = nil,
            rendersIdleBackground: Bool = true,
            flashesOnPress: Bool = false,
            usesCompactLabelFont: Bool = false
        ) {
            self.label = label
            self.type = type
            self.widthWeight = widthWeight
            self.landscapeWidthWeight = landscapeWidthWeight
            self.accessibilityLabel = accessibilityLabel ?? label
            self.symbolName = symbolName
            self.pressedSymbolName = pressedSymbolName
            self.subLabel = subLabel
            self.rendersIdleBackground = rendersIdleBackground
            self.flashesOnPress = flashesOnPress
            self.usesCompactLabelFont = usesCompactLabelFont
        }
    }

    // MARK: - Letter Layout (QWERTY)

    static let lettersRow1: [KeyDefinition] = [
        "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
    ].map { KeyDefinition(label: $0) }

    static let lettersRow2: [KeyDefinition] = [
        // 0.41-weight spacers on each end center each row-2 key under
        // the gap between two adjacent row-1 keys. The math:
        // spacer_W = (K - S) / 2 ⇒ weight = 0.5 - S/(2K).
        // S = 6 pt, K ≈ 33 pt on typical iPhone portrait ⇒ ≈ 0.41. Landscape
        // (K ≈ 66 pt) measures 0.453 on the stock keyboard.
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.41, landscapeWidthWeight: 0.453),
    ] + [
        "a", "s", "d", "f", "g", "h", "j", "k", "l",
    ].map { KeyDefinition(label: $0) } + [
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.41, landscapeWidthWeight: 0.453),
    ]

    // Widths below are measured from the iOS 27 stock keyboard on an iPhone
    // 17 Pro simulator (portrait K ≈ 33.4 pt, landscape K ≈ 66.2 pt, 6 pt
    // gaps). The row-3 spacers widen the shift→z gap to stock's 13.7 pt
    // (20.3 pt landscape) and keep z under s.
    static let lettersRow3: [KeyDefinition] = [
        KeyDefinition(label: "", type: .shift, widthWeight: 1.36, landscapeWidthWeight: 1.33,
                      accessibilityLabel: "Shift", symbolName: "shift"),
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.05, landscapeWidthWeight: 0.125),
        KeyDefinition(label: "z"),
        KeyDefinition(label: "x"),
        KeyDefinition(label: "c"),
        KeyDefinition(label: "v"),
        KeyDefinition(label: "b"),
        KeyDefinition(label: "n"),
        KeyDefinition(label: "m"),
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.05, landscapeWidthWeight: 0.125),
        KeyDefinition(label: "", type: .delete, widthWeight: 1.36, landscapeWidthWeight: 1.33,
                      accessibilityLabel: "Delete", symbolName: "delete.left",
                      pressedSymbolName: "delete.left.fill"),
    ]

    // Stock bottom rows sit on a grid of equal units: 8 per row in portrait
    // (unit ≈ 43.25 pt), 10 in landscape (unit = the landscape letter width).
    // `123` and emoji are one unit; a key spanning n units weighs
    // n + 6·(n−1)/unit so it absorbs the gaps it covers.
    static let lettersRow4: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .modeSwitch, accessibilityLabel: "Numbers"),
        // iOS: no globe key per design — long-press on the emoji key opens
        // the system keyboard picker instead. `.emoji` keys render the
        // Echos smiley from kb_emoji.svg (see KeyButton's emojiKeyGlyph);
        // the symbolName is only an a11y/legacy fallback.
        KeyDefinition(label: "", type: .emoji, widthWeight: 1.0,
                      accessibilityLabel: "Emoji",
                      symbolName: "face.smiling"),
        KeyDefinition(label: " ", type: .space, widthWeight: 4.416, landscapeWidthWeight: 6.453,
                      accessibilityLabel: "Space"),
        KeyDefinition(label: "", type: .returnKey, widthWeight: 2.139, landscapeWidthWeight: 2.091,
                      accessibilityLabel: "Return", symbolName: "return"),
    ]

    // MARK: - Number Layout

    static let numbersRow1: [KeyDefinition] = [
        "1", "2", "3", "4", "5", "6", "7", "8", "9", "0",
    ].map { KeyDefinition(label: $0) }

    static let numbersRow2: [KeyDefinition] = [
        "-", "/", ":", ";", "(", ")", "$", "&", "@", "\"",
    ].map { KeyDefinition(label: $0) }

    static let numbersRow3: [KeyDefinition] = [
        KeyDefinition(label: "#+=", type: .symbolSwitch, widthWeight: 0.919, landscapeWidthWeight: 0.926,
                      accessibilityLabel: "Symbols"),
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.034, landscapeWidthWeight: 0.087),
        KeyDefinition(label: "."),
        KeyDefinition(label: ","),
        KeyDefinition(label: "?"),
        KeyDefinition(label: "!"),
        KeyDefinition(label: "'"),
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.034, landscapeWidthWeight: 0.087),
        KeyDefinition(label: "", type: .delete, widthWeight: 0.919, landscapeWidthWeight: 0.926,
                      accessibilityLabel: "Delete", symbolName: "delete.left",
                      pressedSymbolName: "delete.left.fill"),
    ]

    // Stock drops the emoji key on the number / symbol layers; `ABC` takes
    // its two units.
    static let numbersRow4: [KeyDefinition] = [
        KeyDefinition(label: "ABC", type: .modeSwitch, accessibilityLabel: "Letters"),
        KeyDefinition(label: " ", type: .space, widthWeight: 2.064, landscapeWidthWeight: 3.09,
                      accessibilityLabel: "Space"),
        KeyDefinition(label: "", type: .returnKey,
                      accessibilityLabel: "Return", symbolName: "return"),
    ]

    // MARK: - Symbol Layout

    static let symbolsRow1: [KeyDefinition] = [
        "[", "]", "{", "}", "#", "%", "^", "*", "+", "=",
    ].map { KeyDefinition(label: $0) }

    static let symbolsRow2: [KeyDefinition] = [
        "_", "\\", "|", "~", "<", ">", "\u{20AC}", "\u{00A3}", "\u{00A5}", "\u{2022}",
    ].map { KeyDefinition(label: $0) }

    static let symbolsRow3: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .symbolSwitch, widthWeight: 0.919, landscapeWidthWeight: 0.926,
                      accessibilityLabel: "Numbers"),
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.034, landscapeWidthWeight: 0.087),
        KeyDefinition(label: "."),
        KeyDefinition(label: ","),
        KeyDefinition(label: "?"),
        KeyDefinition(label: "!"),
        KeyDefinition(label: "'"),
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.034, landscapeWidthWeight: 0.087),
        KeyDefinition(label: "", type: .delete, widthWeight: 0.919, landscapeWidthWeight: 0.926,
                      accessibilityLabel: "Delete", symbolName: "delete.left",
                      pressedSymbolName: "delete.left.fill"),
    ]

    static let symbolsRow4 = numbersRow4

    // MARK: - Field-type letter variants (§9.1)

    // URL / email / twitter / web search reuse lettersRow1–3; only the bottom
    // row changes. Same unit grid as lettersRow4.

    // email: space (2 units, 4 in landscape), then `@` and `.`.
    static let emailLettersRow4: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .modeSwitch, accessibilityLabel: "Numbers"),
        KeyDefinition(label: "", type: .emoji,
                      accessibilityLabel: "Emoji", symbolName: "face.smiling"),
        KeyDefinition(label: " ", type: .space, widthWeight: 2.139, landscapeWidthWeight: 4.272,
                      accessibilityLabel: "Space"),
        KeyDefinition(label: "@"),
        KeyDefinition(label: "."),
        KeyDefinition(label: "", type: .returnKey, widthWeight: 2.139, landscapeWidthWeight: 2.091,
                      accessibilityLabel: "Return", symbolName: "return"),
    ]

    // URL: native iOS shows no spacebar; `.` `/` `.com` split its space
    // equally (2 units each in landscape).
    static let urlLettersRow4: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .modeSwitch, accessibilityLabel: "Numbers"),
        KeyDefinition(label: "", type: .emoji,
                      accessibilityLabel: "Emoji", symbolName: "face.smiling"),
        KeyDefinition(label: ".", widthWeight: 1.379, landscapeWidthWeight: 2.091),
        KeyDefinition(label: "/", widthWeight: 1.379, landscapeWidthWeight: 2.091,
                      usesCompactLabelFont: true),
        KeyDefinition(label: ".com", widthWeight: 1.379, landscapeWidthWeight: 2.091,
                      accessibilityLabel: "dot com", usesCompactLabelFont: true),
        KeyDefinition(label: "", type: .returnKey, widthWeight: 2.139, landscapeWidthWeight: 2.091,
                      accessibilityLabel: "Return", symbolName: "return"),
    ]

    // twitter: stock has no return key; `@` and `#` take its two units.
    static let twitterLettersRow4: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .modeSwitch, accessibilityLabel: "Numbers"),
        KeyDefinition(label: "", type: .emoji,
                      accessibilityLabel: "Emoji", symbolName: "face.smiling"),
        KeyDefinition(label: " ", type: .space, widthWeight: 4.416, landscapeWidthWeight: 6.453,
                      accessibilityLabel: "Space"),
        KeyDefinition(label: "@"),
        KeyDefinition(label: "#"),
    ]

    // webSearch: off the unit grid on stock — a letter-wide `.` and a
    // narrower Go key. Weights are the measured widths over one unit.
    static let webSearchLettersRow4: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .modeSwitch, accessibilityLabel: "Numbers"),
        KeyDefinition(label: "", type: .emoji,
                      accessibilityLabel: "Emoji", symbolName: "face.smiling"),
        KeyDefinition(label: " ", type: .space, widthWeight: 4.2, landscapeWidthWeight: 6.234,
                      accessibilityLabel: "Space"),
        KeyDefinition(label: ".", widthWeight: 0.77, landscapeWidthWeight: 0.785),
        KeyDefinition(label: "", type: .returnKey, widthWeight: 1.464, landscapeWidthWeight: 1.435,
                      accessibilityLabel: "Return", symbolName: "return"),
    ]

    // MARK: - Numeric Pads (§9.1)

    // Mirrors the native iOS numberPad / decimalPad exactly: a 3×4 grid of
    // telephone-keypad digits (small ABC/DEF… letters beneath 2–9), an empty
    // bottom-left, the `0`, and delete. No globe key — iOS supplies its own
    // keyboard switcher, so adding one here produced a duplicate.
    private static func padDigit(_ digit: String, _ letters: String? = nil) -> KeyDefinition {
        KeyDefinition(label: digit, subLabel: letters, flashesOnPress: true)
    }

    private static let padDeleteKey = KeyDefinition(
        label: "", type: .delete, accessibilityLabel: "Delete",
        symbolName: "delete.left", pressedSymbolName: "delete.left.fill",
        rendersIdleBackground: false
    )

    static let numberPadDigitRow1: [KeyDefinition] = [padDigit("1"), padDigit("2", "ABC"), padDigit("3", "DEF")]
    static let numberPadDigitRow2: [KeyDefinition] = [padDigit("4", "GHI"), padDigit("5", "JKL"), padDigit("6", "MNO")]
    static let numberPadDigitRow3: [KeyDefinition] = [padDigit("7", "PQRS"), padDigit("8", "TUV"), padDigit("9", "WXYZ")]

    static let numberPadRow4: [KeyDefinition] = [
        KeyDefinition(label: "", type: .spacer, widthWeight: 1.0),
        padDigit("0"),
        padDeleteKey,
    ]

    // decimalPad replaces the empty bottom-left slot with the locale decimal
    // separator (".", "," …) — matching the native pad, which is
    // locale-dependent. Computed so it follows the device locale.
    static var decimalPadRow4: [KeyDefinition] {
        let separator = Locale.current.decimalSeparator ?? "."
        return [
            KeyDefinition(
                label: separator, accessibilityLabel: "Decimal",
                rendersIdleBackground: false
            ),
            padDigit("0"),
            padDeleteKey,
        ]
    }

    // MARK: - Row Access

    static func rows(for mode: LayoutMode) -> [[KeyDefinition]] {
        switch mode {
        case .letters, .emojiSearch:
            // Emoji search uses the same QWERTY rows for typing the query;
            // the difference is only that `handleKeyAction` routes character
            // and delete actions into the search query instead of the host.
            return [lettersRow1, lettersRow2, lettersRow3, lettersRow4]
        case .numbers:
            return [numbersRow1, numbersRow2, numbersRow3, numbersRow4]
        case .symbols:
            return [symbolsRow1, symbolsRow2, symbolsRow3, symbolsRow4]
        case .emoji:
            // Emoji mode renders `EmojiPickerView` instead of QWERTY rows;
            // KeyboardView.buildLayout() branches before calling this.
            return []
        case .numberPad:
            return [numberPadDigitRow1, numberPadDigitRow2, numberPadDigitRow3, numberPadRow4]
        case .decimalPad:
            return [numberPadDigitRow1, numberPadDigitRow2, numberPadDigitRow3, decimalPadRow4]
        case .urlLetters:
            return [lettersRow1, lettersRow2, lettersRow3, urlLettersRow4]
        case .emailLetters:
            return [lettersRow1, lettersRow2, lettersRow3, emailLettersRow4]
        case .twitter:
            return [lettersRow1, lettersRow2, lettersRow3, twitterLettersRow4]
        case .webSearch:
            return [lettersRow1, lettersRow2, lettersRow3, webSearchLettersRow4]
        }
    }
}

/// Long-press accent variants for letter keys. Superset of the iOS stock
/// English layout, extended toward the international Latin diacritics the
/// system surfaces once additional Latin-script languages are enabled (e.g.
/// the `t` → `ț ť ŧ ţ` set), so more accented characters are reachable
/// without switching layouts. The original character is prepended so the
/// popover defaults to a no-op release.
enum AccentVariants {

    private static let map: [Character: [String]] = [
        "a": ["à", "á", "â", "ä", "æ", "ã", "å", "ā", "ą", "ǎ", "ă"],
        "b": ["ḃ"],
        "c": ["ç", "ć", "č", "ċ", "ĉ"],
        "d": ["ð", "đ", "ď", "ḋ"],
        "e": ["è", "é", "ê", "ë", "ē", "ė", "ę", "ě", "ĕ", "ẽ"],
        "g": ["ğ", "ĝ", "ġ", "ģ"],
        "h": ["ĥ", "ħ", "ḣ"],
        "i": ["î", "ï", "í", "ī", "į", "ì", "ĩ", "ǐ", "ı"],
        "j": ["ĵ"],
        "k": ["ķ", "ĸ"],
        "l": ["ł", "ĺ", "ļ", "ľ", "ŀ"],
        "n": ["ñ", "ń", "ņ", "ň", "ŋ"],
        "o": ["ô", "ö", "ò", "ó", "œ", "ø", "ō", "õ", "ő", "ǒ"],
        "r": ["ŕ", "ř", "ŗ"],
        "s": ["ß", "ś", "š", "ş", "ŝ", "ș"],
        "t": ["ț", "ť", "ŧ", "ţ", "þ"],
        "u": ["û", "ü", "ù", "ú", "ū", "ũ", "ů", "ű", "ų", "ǔ"],
        "w": ["ŵ", "ẁ", "ẃ", "ẅ"],
        "y": ["ÿ", "ý", "ŷ", "ỳ"],
        "z": ["ž", "ź", "ż"],
    ]

    /// Returns the original character plus its accent variants, uppercased
    /// when `uppercase` is true. Empty array if the character has no variants.
    static func variants(for character: String, uppercase: Bool) -> [String] {
        guard let firstChar = character.lowercased().first,
              let baseVariants = map[firstChar] else {
            return []
        }
        let all = [String(firstChar)] + baseVariants
        return uppercase ? all.map { $0.uppercased() } : all
    }

    static func hasVariants(for character: String) -> Bool {
        guard let firstChar = character.lowercased().first else { return false }
        return map[firstChar] != nil
    }
}

/// Long-press punctuation/symbol variants surfaced on keys of the numbers and
/// symbols layouts, mirroring the iOS system keyboard's `moreKeys` popovers.
/// Each set leads with the pressed key itself so a no-drag release re-types it.
enum PunctuationVariants {

    private static let map: [String: [String]] = [
        ".": [".", "…"],
        "?": ["?", "¿"],
        "!": ["!", "¡"],
        "'": ["'", "‘", "`"],
        "\"": ["\"", "”", "“", "„", "»", "«"],
        "&": ["&", "§"],
        "£": ["£", "€", "$", "¥", "₩", "₽", "¢"],
        "/": ["/", "\\"],
        "-": ["-", "–", "—", "•"],
        "0": ["0", "°"],
        "%": ["%", "‰"],
        "=": ["=", "≠", "≈"],
    ]

    /// The variant set for `key`, or `nil` when the key has no popover.
    static func variants(for key: String) -> [String]? {
        return map[key]
    }

    static func hasVariants(for key: String) -> Bool {
        return map[key] != nil
    }
}
