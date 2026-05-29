import Foundation

/// Case rotation for the selection-recapitalize gesture (§4.7): tapping shift
/// while text is selected cycles all-lower → Title Case → ALL-UPPER. iOS
/// keyboard extensions can't programmatically re-select text, so the
/// controller drives the rotation by replacing its own previously-inserted
/// run; this type holds the small amount of state that requires.
final class RecapitalizeEngine {

    /// True while a rotation is in progress (the last shift tap recapitalized
    /// a selection or continued a rotation).
    private(set) var active = false
    /// The exact text we last inserted, so the next tap can find and replace
    /// it (the caller validates it against the text before the cursor).
    private(set) var lastInserted = ""

    func begin(inserted: String) {
        active = true
        lastInserted = inserted
    }

    func reset() {
        active = false
        lastInserted = ""
    }

    /// The next case form for `text` in the lower → title → upper cycle, or
    /// nil when `text` has no letters to recase.
    static func nextCase(_ text: String) -> String? {
        guard text.contains(where: { $0.isLetter }) else { return nil }
        let lower = text.lowercased()
        let upper = text.uppercased()
        let title = titleCased(text)
        // Order matters: a single uppercase letter equals its own title form,
        // so test against upper before title.
        if text == upper { return lower }
        if text == title { return upper }
        if text == lower { return title }
        // Mixed case (or the untouched original) starts the cycle at lower.
        return lower
    }

    /// First letter of each whitespace-delimited word uppercased, the rest
    /// lowercased.
    private static func titleCased(_ text: String) -> String {
        var result = ""
        result.reserveCapacity(text.count)
        var atWordStart = true
        for ch in text {
            if ch.isLetter {
                result += atWordStart ? ch.uppercased() : ch.lowercased()
                atWordStart = false
            } else {
                result.append(ch)
                atWordStart = ch.isWhitespace
            }
        }
        return result
    }
}
