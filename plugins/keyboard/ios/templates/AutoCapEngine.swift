import UIKit

/// Walks the text before the cursor to decide whether the next typed
/// character should be auto-capitalized. Mirrors LatinIME's
/// `CapsModeUtils` simple-mode walk: skip opening punctuation → walk
/// over spaces → if we hit a sentence terminator (or start-of-input /
/// newline) it's a sentence boundary, so capitalize. Otherwise lowercase.
///
/// Does not implement the abbreviation state machine — start with the
/// simple rule, which covers ~95% of cases. Add the `e.g.` exclusion
/// later if users complain about over-capitalization.
enum AutoCapEngine {

    enum Decision {
        case capitalize
        case lowercase
        /// Host explicitly disables auto-cap (URL / password / email).
        case disabled
    }

    /// How many trailing chars of the document we need to make a
    /// confident call. 1024 is what LatinIME caches and is more than
    /// enough for the walk-back algorithm.
    private static let contextWindow = 1024

    /// Reads the host text proxy and returns whether the cursor sits at
    /// a sentence boundary. Returns `.disabled` if the host field opts
    /// out of auto-cap.
    static func decide(for proxy: UITextDocumentProxy) -> Decision {
        switch proxy.autocapitalizationType {
        case .none: return .disabled
        case .allCharacters: return .capitalize
        // .words and .sentences both want sentence-aware capitalization
        // for the first char; we treat them the same — first letter of
        // each new "thing", everything else lowercase.
        case .words, .sentences: break
        @unknown default: break
        }

        let before = proxy.documentContextBeforeInput ?? ""
        return decide(textBeforeCursor: before)
    }

    /// Same logic, lifted out so it's unit-testable without a proxy.
    static func decide(textBeforeCursor: String) -> Decision {
        if textBeforeCursor.isEmpty { return .capitalize }

        let suffix = textBeforeCursor.suffix(contextWindow)
        let chars = Array(suffix)
        var idx = chars.count - 1

        // 1. Skip trailing opening-punctuation runs ("(", "[", etc.).
        while idx >= 0, SpacingAndPunctuations.isOpeningPunctuation(chars[idx]) {
            idx -= 1
        }

        // 2. The cursor must follow at least one whitespace char for a
        //    new sentence to have started. Without an intervening space
        //    we're still in the same sentence (e.g. "Yes.|" doesn't
        //    capitalize the next char yet).
        guard idx >= 0 else {
            // We skipped past everything = doc starts with opens like
            // "(" — still a sentence start.
            return .capitalize
        }
        guard chars[idx].isWhitespace else {
            return .lowercase
        }

        // Walk back across the whitespace run. A newline anywhere in it
        // is a paragraph boundary = sentence start.
        var sawNewline = false
        while idx >= 0, chars[idx].isWhitespace {
            if chars[idx].isNewline { sawNewline = true }
            idx -= 1
        }
        if sawNewline { return .capitalize }

        // Walked all the way back to the start of input — sentence start.
        if idx < 0 { return .capitalize }

        if SpacingAndPunctuations.isSentenceTerminator(chars[idx]) {
            return .capitalize
        }

        return .lowercase
    }
}
