import UIKit

/// On-device word suggestions backed by the system spell checker
/// (`UITextChecker`). This is the Phase 3 "smart input" layer (§5.5): the
/// source is iOS's offline dictionary rather than an n-gram language model, so
/// it runs in a keyboard extension with no Full Access and no bundled data —
/// at the cost of spelling completions/corrections only (no prefix-less
/// next-word prediction).
///
/// The keyboard keeps a commit-based text model (no marked/composing text), so
/// the "current word" is the trailing run of non-separator characters read
/// from the committed text before the cursor. Suggestions are a read-only
/// overlay; applying one is an ordinary delete+insert performed by the
/// controller. This keeps auto-cap and double-space→period working unchanged.
final class SuggestionEngine {

    /// One lookup's result. `topIsCorrection` is true when the typed word was
    /// misspelled and the leading candidate is a spelling fix — the signal the
    /// autocorrect-on-space path needs.
    struct Result {
        let candidates: [String]
        let topIsCorrection: Bool
        static let empty = Result(candidates: [], topIsCorrection: false)
    }

    /// Tracks the most recent autocorrect-on-space so the next backspace can
    /// revert it to exactly what the user typed (LatinIME's LastComposedWord).
    struct LastAutocorrect {
        let typed: String
        let corrected: String
    }

    /// Casing the candidates should adopt, derived from the live shift state.
    enum Casing {
        case lower      // dictionary form
        case capitalize // first letter upper (shift / auto-shift)
        case upper      // caps lock
    }

    // Constructing a UITextChecker allocates a checker per language; reuse one
    // instance across keystrokes rather than rebuilding it each lookup.
    private let checker = UITextChecker()
    private var resolvedLanguage: String?

    /// Width of the suggestion strip (matches LatinIME's 3-wide strip).
    private static let maxCandidates = 3
    /// Past this length a token is almost certainly not a dictionary word;
    /// skip the lookup (and the O(len) NSRange work it implies).
    private static let maxWordLength = 32

    // MARK: - Language

    /// Resolves the `UITextChecker` language once from the host's preferred
    /// languages → the first available checker language. Suggestions follow the
    /// host locale, independent of the app's spoken-language (ASR) setting,
    /// which only affects transcription. Leaves the language nil only when the
    /// device exposes no checker languages, in which case lookups return empty.
    func resolveLanguage() {
        let available = UITextChecker.availableLanguages
        guard !available.isEmpty else {
            resolvedLanguage = nil
            return
        }
        for preferred in Locale.preferredLanguages {
            if let match = Self.match(preferred, in: available) {
                resolvedLanguage = match
                return
            }
        }
        resolvedLanguage = available.first
    }

    /// Prefix-matches a BCP-47-ish code (`"en"`, `"en-US"`, `"de_DE"`) against
    /// the checker's language ids (`"en_US"`, `"de_DE"`, …): exact first, then
    /// language-subtag prefix.
    private static func match(_ code: String, in available: [String]) -> String? {
        let normalized = code.replacingOccurrences(of: "-", with: "_")
        if available.contains(normalized) { return normalized }
        let lang = normalized.split(separator: "_").first.map(String.init) ?? normalized
        return available.first { $0 == lang || $0.hasPrefix(lang + "_") }
    }

    // MARK: - Current word

    /// The in-progress word: the trailing run of non-separator characters
    /// immediately before the cursor. Returns empty when the cursor sits after
    /// a separator (idle), when it is mid-word (the char after the cursor is a
    /// non-separator — replacing a partial word the user is editing would be
    /// unsafe), when the token carries a digit, or when it is unreasonably long.
    static func currentWord(beforeCursor: String, afterCursor: String) -> String {
        if let next = afterCursor.first,
           !SpacingAndPunctuations.isWordSeparator(next) {
            return ""
        }
        var reversed = ""
        for ch in beforeCursor.reversed() {
            if SpacingAndPunctuations.isWordSeparator(ch) { break }
            reversed.append(ch)
        }
        let word = String(reversed.reversed())
        if word.isEmpty || word.count > maxWordLength { return "" }
        if word.contains(where: { $0.isNumber }) { return "" }
        return word
    }

    // MARK: - Lookup

    /// Builds up-to-3 candidates for `word`, cased per `casing`. Corrections
    /// (when the word is misspelled) lead, then completions; the already-typed
    /// word is dropped and the list deduped case-insensitively.
    func suggestions(for word: String, casing: Casing) -> Result {
        guard let language = resolvedLanguage, !word.isEmpty else {
            return .empty
        }
        // UITextChecker works in UTF-16 (NSRange), distinct from Character
        // count — build the range from the bridged NSString length.
        let nsWord = word as NSString
        let fullRange = NSRange(location: 0, length: nsWord.length)

        let misspelledRange = checker.rangeOfMisspelledWord(
            in: word, range: fullRange, startingAt: 0, wrap: false, language: language
        )
        let isMisspelled = misspelledRange.location != NSNotFound

        var ordered: [String] = []
        if isMisspelled {
            ordered.append(contentsOf:
                checker.guesses(forWordRange: fullRange, in: word, language: language) ?? [])
        }
        ordered.append(contentsOf:
            checker.completions(forPartialWordRange: fullRange, in: word, language: language) ?? [])

        let typedKey = word.lowercased()
        var seen = Set<String>()
        var result: [String] = []
        for candidate in ordered {
            let key = candidate.lowercased()
            if key == typedKey || seen.contains(key) { continue }
            seen.insert(key)
            result.append(Self.applyCasing(casing, to: candidate))
            if result.count == Self.maxCandidates { break }
        }
        return Result(
            candidates: result,
            topIsCorrection: isMisspelled && !result.isEmpty
        )
    }

    private static func applyCasing(_ casing: Casing, to word: String) -> String {
        switch casing {
        case .lower:
            return word
        case .upper:
            return word.uppercased()
        case .capitalize:
            guard let first = word.first else { return word }
            return first.uppercased() + word.dropFirst()
        }
    }
}
