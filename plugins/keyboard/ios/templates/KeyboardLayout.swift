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
    }

    enum LayoutMode {
        case letters
        case numbers
        case symbols
        case emoji
    }

    enum ShiftState {
        case off
        case on
        case capsLock
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
        "a", "s", "d", "f", "g", "h", "j", "k", "l",
    ].map { KeyDefinition(label: $0) }

    static let lettersRow3: [KeyDefinition] = [
        KeyDefinition(label: "", type: .shift, widthWeight: 1.5,
                      accessibilityLabel: "Shift", symbolName: "shift"),
        KeyDefinition(label: "z"),
        KeyDefinition(label: "x"),
        KeyDefinition(label: "c"),
        KeyDefinition(label: "v"),
        KeyDefinition(label: "b"),
        KeyDefinition(label: "n"),
        KeyDefinition(label: "m"),
        KeyDefinition(label: "", type: .delete, widthWeight: 1.5,
                      accessibilityLabel: "Delete", symbolName: "delete.left"),
    ]

    static let lettersRow4: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .modeSwitch, widthWeight: 1.2, accessibilityLabel: "Numbers"),
        // iOS: no globe key per design — long-press on the emoji key opens
        // the system keyboard picker instead.
        KeyDefinition(label: "", type: .emoji, widthWeight: 1.0,
                      accessibilityLabel: "Emoji",
                      symbolName: "face.smiling"),
        KeyDefinition(label: " ", type: .space, widthWeight: 5.0, accessibilityLabel: "Space"),
        KeyDefinition(label: "", type: .returnKey, widthWeight: 1.8,
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
        KeyDefinition(label: " ", type: .space, widthWeight: 5.0, accessibilityLabel: "Space"),
        KeyDefinition(label: "", type: .returnKey, widthWeight: 1.8,
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
        case .letters:
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
