import UIKit

/// On-device word suggestions (§5.5). English routes through the bundled
/// `CorrectionEngine` (frequency-ranked lexicon, fat-finger edit distance,
/// contractions, splits, bigram context, learned words) with `UITextChecker`
/// retained purely as a validity veto — Apple's much larger lexicon plus the
/// system user dictionary and Contacts recognizes words our 82k list doesn't,
/// and a recognized word must never be autocorrected. Non-English host
/// locales keep the original `UITextChecker` candidate path, so they lose
/// nothing.
///
/// The keyboard keeps a commit-based text model (no marked/composing text), so
/// the "current word" is the trailing run of non-separator characters read
/// from the committed text before the cursor. Suggestions are a read-only
/// overlay; applying one is an ordinary delete+insert performed by the
/// controller. This keeps auto-cap and double-space→period working unchanged.
final class SuggestionEngine {

    /// One lookup's result. `topIsCorrection` is true when the typed word
    /// looks like a typo and `replacement` is safe for autocorrect-on-space.
    /// `verbatim` (the typed word) is set only in that case and feeds the
    /// strip's quoted "keep what I typed" slot.
    struct Result {
        let candidates: [String]
        let topIsCorrection: Bool
        let verbatim: String?
        let replacement: String?
        static let empty = Result(
            candidates: [], topIsCorrection: false, verbatim: nil, replacement: nil
        )
    }

    /// Tracks the most recent autocorrect so the next backspace can revert it
    /// to exactly what the user typed (LatinIME's LastComposedWord). The
    /// separator is whatever triggered the correction — " ", ".", "\n", ….
    struct LastAutocorrect {
        let typed: String
        let corrected: String
        let separator: String
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

    private let correctionEngine: CorrectionEngine

    /// Neural reranker for context-aware autocorrect. nil (model absent /
    /// build without ECHOS_LM) keeps ranking bit-identical to the classical
    /// engine. Consulted only on the bundled-engine path.
    var lmReranker: LmRerankerProviding?

    /// Contact names and user text replacements the host grants keyboard
    /// extensions (`requestSupplementaryLexicon`) — the same private signal
    /// the system keyboard uses, and the only slice of Apple's lexicon
    /// third-party keyboards get. Names keep their canonical casing, appear
    /// as tap-only completions, and veto autocorrect; shortcuts expand like
    /// native text replacements. Replaced wholesale on the main thread.
    private var supplementaryWords: [String: String] = [:]
    private var supplementaryShortcuts: [String: String] = [:]

    init(correctionEngine: CorrectionEngine) {
        self.correctionEngine = correctionEngine
    }

    /// Ingests the host-provided lexicon. Entries whose input and output are
    /// the same token (contact names) become known words with canonical
    /// casing; the rest (user text replacements) become shortcut expansions.
    func setSupplementaryLexicon(_ lexicon: UILexicon) {
        var words: [String: String] = [:]
        var shortcuts: [String: String] = [:]
        for entry in lexicon.entries {
            let input = entry.userInput
            let output = entry.documentText
            guard !input.isEmpty, !output.isEmpty else { continue }
            if input.lowercased() == output.lowercased() {
                words[input.lowercased()] = output
            } else {
                shortcuts[input.lowercased()] = output
            }
        }
        supplementaryWords = words
        supplementaryShortcuts = shortcuts
    }

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

    /// The bundled engine serves English hosts; everyone else keeps the
    /// system checker.
    private var usesCorrectionEngine: Bool {
        correctionEngine.isLoaded && (resolvedLanguage?.hasPrefix("en") ?? false)
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

    /// The committed word before the in-progress one — bigram context for
    /// ranking and next-word prediction. `beforeCursor` should already have
    /// the current word stripped by the caller.
    static func previousWord(beforeCursor: String, currentWord: String) -> String? {
        var remaining = beforeCursor
        if !currentWord.isEmpty, remaining.hasSuffix(currentWord) {
            remaining.removeLast(currentWord.count)
        }
        while let last = remaining.last, SpacingAndPunctuations.isWordSeparator(last) {
            // Sentence-terminal punctuation ends the context ("Hi. teh" has no
            // previous word worth boosting by); commas / semicolons / colons
            // (and spaces) do not — native keyboards keep predicting across
            // them ("apples, oran" still boosts from "apples").
            if last == "." || last == "!" || last == "?" || last == "\n" {
                return nil
            }
            remaining.removeLast()
        }
        var reversed = ""
        for ch in remaining.reversed() {
            if SpacingAndPunctuations.isWordSeparator(ch) { break }
            reversed.append(ch)
        }
        let word = String(reversed.reversed())
        return word.isEmpty ? nil : word
    }

    /// Text before the in-progress word — the LM reranker's context window.
    /// Unlike `previousWord` this deliberately crosses sentence boundaries
    /// (that's the point of a neural context model); bounded to the trailing
    /// `limit` characters to cap tokenization cost. Mirrors the Kotlin twin.
    static func leftContext(
        beforeCursor: String, currentWord: String, limit: Int = 192
    ) -> String {
        let trimmed = String(beforeCursor.dropLast(currentWord.count))
        return String(trimmed.suffix(limit))
    }

    // MARK: - Lookup

    /// Builds up-to-3 candidates for `word`, cased per `casing`, plus the
    /// autocorrect verdict. Synchronous and fast (<5 ms): safe on both the
    /// debounced strip path and the space/punctuation commit path.
    func suggestions(
        for word: String,
        previousWord: String? = nil,
        casing: Casing,
        touchPoints: [CorrectionEngine.TouchPoint?]? = nil,
        leftContext: String? = nil
    ) -> Result {
        guard !word.isEmpty else { return .empty }
        // User text replacements expand exactly like the native keyboard —
        // before any engine routing, in every language. A reverted expansion
        // is blacklisted and thereafter never auto-applies again.
        // Shortcuts that merely restate the word are routed to
        // `supplementaryWords` instead (see setSupplementaryLexicon), so no
        // same-token guard is needed here.
        if let expansion = supplementaryShortcuts[word.lowercased()],
           !correctionEngine.userLexicon.isBlacklisted(
               typed: word.lowercased(), corrected: expansion.lowercased()
           ) {
            return Result(
                candidates: [expansion],
                topIsCorrection: true,
                verbatim: word,
                replacement: expansion
            )
        }
        if usesCorrectionEngine {
            return engineSuggestions(
                for: word,
                previousWord: previousWord,
                casing: casing,
                touchPoints: touchPoints,
                leftContext: leftContext
            )
        }
        return checkerSuggestions(for: word, casing: casing)
    }

    /// Next-word prediction for an empty composing word (§5.12): top bigram
    /// continuations of the word just committed.
    func predictions(afterWord previousWord: String, casing: Casing) -> [String] {
        guard usesCorrectionEngine else { return [] }
        return correctionEngine.nextWords(after: previousWord)
            .map { Self.applyCasing(casing, to: $0) }
    }

    /// Next-key weights for invisible key-target resizing; empty (targets
    /// stay at visible geometry) unless the bundled engine serves this locale.
    func keyTargetWeights(forPrefix prefix: String) -> [UInt8: Float] {
        guard usesCorrectionEngine else { return [:] }
        return correctionEngine.nextCharWeights(prefix: prefix)
    }

    private func engineSuggestions(
        for word: String,
        previousWord: String?,
        casing: Casing,
        touchPoints: [CorrectionEngine.TouchPoint?]?,
        leftContext: String?
    ) -> Result {
        let isContactWord = supplementaryWords[word.lowercased()] != nil
        let evaluation = correctionEngine.evaluate(
            typedRaw: word,
            previousWord: previousWord,
            checkerSaysValid: isContactWord || checkerRecognizes(word),
            touchPoints: touchPoints,
            leftContext: leftContext,
            reranker: lmReranker
        )
        var candidates = evaluation.candidates.map { Self.applyCasing(casing, to: $0) }
        // Contact-name matches lead the strip with canonical casing — tap-only,
        // never the autocorrect replacement.
        let contacts = supplementaryMatches(for: word)
        if !contacts.isEmpty {
            var seen = Set(candidates.map { $0.lowercased() })
            var leading: [String] = []
            for contact in contacts where seen.insert(contact.lowercased()).inserted {
                leading.append(contact)
            }
            candidates = Array((leading + candidates).prefix(Self.maxCandidates))
        }
        return Result(
            candidates: candidates,
            topIsCorrection: evaluation.topIsCorrection,
            verbatim: evaluation.verbatim,
            replacement: evaluation.replacement.map { Self.applyCasing(casing, to: $0) }
        )
    }

    /// Contact names matching the typed prefix, exact (recased) match first,
    /// then shorter completions before longer. Linear scan — the supplementary
    /// lexicon is small and lookups run at typing cadence.
    private func supplementaryMatches(for word: String) -> [String] {
        guard !supplementaryWords.isEmpty, word.count >= 2 else { return [] }
        let key = word.lowercased()
        var exact: String?
        var completions: [String] = []
        for (stored, display) in supplementaryWords {
            if stored == key {
                if display != word { exact = display }
            } else if stored.hasPrefix(key) {
                completions.append(display)
            }
        }
        // utf16.count, not count: Kotlin's String.length is UTF-16 units, so
        // grapheme counting here would order emoji/non-BMP names differently.
        completions.sort { ($0.utf16.count, $0) < ($1.utf16.count, $1) }
        let ordered = (exact.map { [$0] } ?? []) + completions
        return Array(ordered.prefix(2))
    }

    /// The veto oracle: does Apple's checker consider the word spelled
    /// correctly? Deliberately ignores guesses/completions — ranking stays
    /// deterministic in the bundled engine.
    private func checkerRecognizes(_ word: String) -> Bool {
        guard let language = resolvedLanguage else { return false }
        let nsWord = word as NSString
        let misspelledRange = checker.rangeOfMisspelledWord(
            in: word,
            range: NSRange(location: 0, length: nsWord.length),
            startingAt: 0,
            wrap: false,
            language: language
        )
        return misspelledRange.location == NSNotFound
    }

    /// Original `UITextChecker` candidate path, kept verbatim for non-English
    /// host locales.
    private func checkerSuggestions(for word: String, casing: Casing) -> Result {
        guard let language = resolvedLanguage else { return .empty }
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
        let topIsCorrection = isMisspelled && !result.isEmpty
        return Result(
            candidates: result,
            topIsCorrection: topIsCorrection,
            verbatim: topIsCorrection ? word : nil,
            replacement: topIsCorrection ? result.first : nil
        )
    }

    static func applyCasing(_ casing: Casing, to word: String) -> String {
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
