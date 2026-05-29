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
        let accessibilityLabel: String
        let symbolName: String?

        init(
            label: String,
            type: KeyType = .character,
            widthWeight: CGFloat = 1.0,
            accessibilityLabel: String? = nil,
            symbolName: String? = nil
        ) {
            self.label = label
            self.type = type
            self.widthWeight = widthWeight
            self.accessibilityLabel = accessibilityLabel ?? label
            self.symbolName = symbolName
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
        // S = 6 pt, K ≈ 33 pt on typical iPhone portrait ⇒ ≈ 0.41.
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.41),
    ] + [
        "a", "s", "d", "f", "g", "h", "j", "k", "l",
    ].map { KeyDefinition(label: $0) } + [
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.41),
    ]

    static let lettersRow3: [KeyDefinition] = [
        // Shift / delete kept at 1.4 (native-iOS-like width). Spacer
        // widthWeight reduced to 0.01 (≈ 0 pt physical) so the math
        // closes for z-under-s alignment: shift + spacer = 1.41K, the
        // required offset for z's center to land under s's center.
        // The spacer is still present in the row stack — its
        // contribution comes from the two 6 pt stack spacings around
        // it (before and after), giving a ~12 pt visible gap between
        // shift and z without disturbing the alignment math.
        KeyDefinition(label: "", type: .shift, widthWeight: 1.4,
                      accessibilityLabel: "Shift", symbolName: "shift"),
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.01),
        KeyDefinition(label: "z"),
        KeyDefinition(label: "x"),
        KeyDefinition(label: "c"),
        KeyDefinition(label: "v"),
        KeyDefinition(label: "b"),
        KeyDefinition(label: "n"),
        KeyDefinition(label: "m"),
        KeyDefinition(label: "", type: .spacer, widthWeight: 0.01),
        KeyDefinition(label: "", type: .delete, widthWeight: 1.4,
                      accessibilityLabel: "Delete", symbolName: "delete.left"),
    ]

    static let lettersRow4: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .modeSwitch, widthWeight: 1.2, accessibilityLabel: "Numbers"),
        // iOS: no globe key per design — long-press on the emoji key opens
        // the system keyboard picker instead. `smiley` (the older SF
        // Symbol) renders the simple outlined dot-eyes-and-curve glyph
        // native iOS uses for the keyboard emoji affordance — closer to
        // the reference than `face.smiling`, which has more detail.
        KeyDefinition(label: "", type: .emoji, widthWeight: 1.0,
                      accessibilityLabel: "Emoji",
                      symbolName: "face.smiling"),
        // Space must sit exactly below x-c-v-b-n in row 3 (5 keys + 4
        // inter-letter gaps = 5K + 4S). The K used by row 4 (let's call
        // it K_row4) differs from row 1's K because row 4's weight sum
        // differs. Solving `2.2·K_row4 + 2S = 2.4K_row1 + 3S` and
        // `space_W = 5K_row1 + 4S` for K_row1 ≈ 33, S = 6 yields
        // K_row4 ≈ 38.7 and these weights: space ≈ 4.9, return ≈ 2.4.
        // Previously space was 5.7 / return 1.8 — space overflowed past
        // `n` into `m`; the excess width now lives in return instead.
        KeyDefinition(label: " ", type: .space, widthWeight: 4.9, accessibilityLabel: "Space"),
        KeyDefinition(label: "", type: .returnKey, widthWeight: 2.4,
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
        KeyDefinition(label: "#+=", type: .symbolSwitch, widthWeight: 1.5, accessibilityLabel: "Symbols"),
        KeyDefinition(label: "."),
        KeyDefinition(label: ","),
        KeyDefinition(label: "?"),
        KeyDefinition(label: "!"),
        KeyDefinition(label: "'"),
        KeyDefinition(label: "", type: .delete, widthWeight: 1.5,
                      accessibilityLabel: "Delete", symbolName: "delete.left"),
    ]

    static let numbersRow4: [KeyDefinition] = [
        KeyDefinition(label: "ABC", type: .modeSwitch, widthWeight: 1.2, accessibilityLabel: "Letters"),
        KeyDefinition(label: "", type: .emoji, widthWeight: 1.0,
                      accessibilityLabel: "Emoji",
                      symbolName: "face.smiling"),
        // Match lettersRow4's space / return weights so the row-4 chrome
        // doesn't visibly resize when toggling between letters / numbers.
        KeyDefinition(label: " ", type: .space, widthWeight: 4.9, accessibilityLabel: "Space"),
        KeyDefinition(label: "", type: .returnKey, widthWeight: 2.4,
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
        KeyDefinition(label: "123", type: .symbolSwitch, widthWeight: 1.5, accessibilityLabel: "Numbers"),
        KeyDefinition(label: "."),
        KeyDefinition(label: ","),
        KeyDefinition(label: "?"),
        KeyDefinition(label: "!"),
        KeyDefinition(label: "'"),
        KeyDefinition(label: "", type: .delete, widthWeight: 1.5,
                      accessibilityLabel: "Delete", symbolName: "delete.left"),
    ]

    static let symbolsRow4 = numbersRow4

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
        }
    }
}

/// Long-press accent variants for letter keys, mirroring the set the iOS
/// stock keyboard surfaces on the English layout. The original character
/// is prepended so the popover defaults to a no-op release.
enum AccentVariants {

    private static let map: [Character: [String]] = [
        "a": ["à", "á", "â", "ä", "æ", "ã", "å", "ā"],
        "c": ["ç", "ć", "č"],
        "e": ["è", "é", "ê", "ë", "ē", "ė", "ę"],
        "i": ["î", "ï", "í", "ī", "į", "ì"],
        "l": ["ł"],
        "n": ["ñ", "ń"],
        "o": ["ô", "ö", "ò", "ó", "œ", "ø", "ō", "õ"],
        "s": ["ß", "ś", "š"],
        "u": ["û", "ü", "ù", "ú", "ū"],
        "y": ["ÿ"],
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

/// Long-press punctuation surfaced on the period (".") key, mirroring
/// LatinIME's period `moreKeys`. The "." is first so a no-drag release
/// re-types a period.
enum PunctuationVariants {
    static let period: [String] = [
        ".", ",", "?", "!", "'", "\"", ":", ";", "-", "(", ")", "/",
    ]
}
