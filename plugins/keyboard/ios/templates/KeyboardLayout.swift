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
        case symbolSwitch  // #+= / 123 toggle
        case comma
        case period
    }

    enum LayoutMode {
        case letters
        case numbers
        case symbols
    }

    enum ShiftState {
        case off
        case on
        case capsLock
    }

    struct KeyDefinition {
        let label: String
        let type: KeyType
        let widthWeight: CGFloat
        let accessibilityLabel: String

        init(
            label: String,
            type: KeyType = .character,
            widthWeight: CGFloat = 1.0,
            accessibilityLabel: String? = nil
        ) {
            self.label = label
            self.type = type
            self.widthWeight = widthWeight
            self.accessibilityLabel = accessibilityLabel ?? label
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
        KeyDefinition(label: "\u{21E7}", type: .shift, widthWeight: 1.5, accessibilityLabel: "Shift"),
        KeyDefinition(label: "z"),
        KeyDefinition(label: "x"),
        KeyDefinition(label: "c"),
        KeyDefinition(label: "v"),
        KeyDefinition(label: "b"),
        KeyDefinition(label: "n"),
        KeyDefinition(label: "m"),
        KeyDefinition(label: "\u{232B}", type: .delete, widthWeight: 1.5, accessibilityLabel: "Delete"),
    ]

    static let lettersRow4: [KeyDefinition] = [
        KeyDefinition(label: "123", type: .modeSwitch, widthWeight: 1.2, accessibilityLabel: "Numbers"),
        KeyDefinition(label: "\u{1F310}", type: .globe, widthWeight: 1.0, accessibilityLabel: "Next keyboard"),
        KeyDefinition(label: " ", type: .space, widthWeight: 4.0, accessibilityLabel: "Space"),
        KeyDefinition(label: "\u{1F3A4}", type: .mic, widthWeight: 1.0, accessibilityLabel: "Microphone"),
        KeyDefinition(label: "\u{23CE}", type: .returnKey, widthWeight: 1.2, accessibilityLabel: "Return"),
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
        KeyDefinition(label: "\u{232B}", type: .delete, widthWeight: 1.5, accessibilityLabel: "Delete"),
    ]

    static let numbersRow4: [KeyDefinition] = [
        KeyDefinition(label: "ABC", type: .modeSwitch, widthWeight: 1.2, accessibilityLabel: "Letters"),
        KeyDefinition(label: "\u{1F310}", type: .globe, widthWeight: 1.0, accessibilityLabel: "Next keyboard"),
        KeyDefinition(label: " ", type: .space, widthWeight: 4.0, accessibilityLabel: "Space"),
        KeyDefinition(label: "\u{1F3A4}", type: .mic, widthWeight: 1.0, accessibilityLabel: "Microphone"),
        KeyDefinition(label: "\u{23CE}", type: .returnKey, widthWeight: 1.2, accessibilityLabel: "Return"),
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
        KeyDefinition(label: "\u{232B}", type: .delete, widthWeight: 1.5, accessibilityLabel: "Delete"),
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
        }
    }
}
