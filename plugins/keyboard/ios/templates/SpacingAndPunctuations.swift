import Foundation

/// Shared character classes that feed auto-capitalization, smart
/// double-space-to-period, recapitalize, and (later) smart punctuation.
/// Mirrors AOSP LatinIME's `SpacingAndPunctuations` so the heuristics
/// downstream can be ported one-for-one.
enum SpacingAndPunctuations {

    /// Ends a sentence and triggers auto-cap on the following word.
    static let sentenceTerminators: Set<Character> = [".", "?", "!"]

    /// Char committed by the smart-double-space helper (the trailing
    /// space is appended separately).
    static let sentenceSeparator: Character = "."

    /// Splits a word in two. Includes whitespace + the punctuation iOS
    /// treats as boundaries between tokens.
    static let wordSeparators: Set<Character> = [
        " ", "\t", "\n",
        "(", ")", "[", "]", "{", "}",
        "*", "&", "<", ">", "+", "=", "|",
        ".", ",", ";", ":", "!", "?", "/", "_", "\"",
    ]

    /// Punctuation that opens a quoted/parenthetical fragment; auto-cap
    /// should skip backwards over these when deciding whether the
    /// _previous_ char ended a sentence (so the `H` in `("Hello`
    /// still capitalizes correctly).
    static let openingPunctuation: Set<Character> = [
        "(", "[", "{", "\"", "'", "<",
    ]

    /// Chars that — when the next typed char is one of them — make
    /// double-space-to-period a no-op. The first space alone is fine
    /// (it inserts a regular space); the smart commit only fires when
    /// the char _before_ the trailing space is a normal letter/digit
    /// or one of the symbols listed in `doubleSpacePeriodAllowedPrecedingChars`.
    static let punctuationExcludedFromDoubleSpace: Set<Character> = [
        ",", ";", ":", "!", "?", ".", "-", "_",
    ]

    /// LatinIME's positive list — chars that may sit before the soon-
    /// to-be-replaced space and still allow the smart commit. Numbers
    /// and letters are accepted via `Character.isLetter`/`isNumber`
    /// instead of being listed here.
    static let doubleSpacePeriodAllowedPrecedingChars: Set<Character> = [
        "'", "\"", ")", "]", "}", ">", "+", "%",
    ]

    static func isSentenceTerminator(_ c: Character) -> Bool {
        sentenceTerminators.contains(c)
    }

    static func isWordSeparator(_ c: Character) -> Bool {
        wordSeparators.contains(c)
    }

    static func isOpeningPunctuation(_ c: Character) -> Bool {
        openingPunctuation.contains(c)
    }

    /// True when the smart double-space-to-period commit is allowed to
    /// fire on top of `previousChar`. Excludes the punctuation listed
    /// above; accepts letters/digits and the explicit allowed set.
    static func allowsDoubleSpacePeriod(after previousChar: Character) -> Bool {
        if punctuationExcludedFromDoubleSpace.contains(previousChar) { return false }
        if previousChar.isLetter || previousChar.isNumber { return true }
        if doubleSpacePeriodAllowedPrecedingChars.contains(previousChar) { return true }
        // Unicode "Other Symbol" category — emoji and the like.
        if let scalar = previousChar.unicodeScalars.first,
           scalar.properties.generalCategory == .otherSymbol {
            return true
        }
        return false
    }
}
