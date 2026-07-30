import Foundation

/// On-device correction/completion engine over the bundled "ECHD" dictionary
/// binary (compiled by `scripts/keyboard-dictionary/build.js` from an
/// 82k-word frequency lexicon + bigrams + contractions).
///
/// The search is a weighted Damerau-Levenshtein DP over a path-compressed
/// trie, with QWERTY-adjacency substitution costs, prefix completions,
/// apostrophe restoration (cant → can't), word splits (alot → "a lot",
/// imnot → "I'm not"), bigram context boosts, and the user's learned lexicon.
///
/// `scripts/keyboard-dictionary/decoder.js` is the reference implementation —
/// the algorithm, tuning constants, and gates here mirror it 1:1 (jest golden
/// vectors pin its behavior). `CorrectionEngine.kt` is the Android twin. Keep
/// all three in sync.
final class CorrectionEngine {

    // MARK: - Tuning (mirror of decoder.js TUNING)

    private enum Tuning {
        static let subAdjacent: Float = 0.6
        static let subOther: Float = 1.0
        static let subTouchMin: Float = 0.35
        static let subTouchBase: Float = 0.25
        static let subTouchPerUnit: Float = 0.55
        static let subTouchDeadZone: Float = 0.4
        static let insertDuplicate: Float = 0.5
        static let insertOther: Float = 1.0
        static let deletionDuplicate: Float = 0.5
        static let deletion: Float = 0.9
        static let transposition: Float = 0.5
        static let firstLetterSurcharge: Float = 0.5
        static let apostropheRestore: Float = 0.15
        static let wordSplit: Float = 0.45
        static let completionPerChar: Float = 0.2
        static let completionCap: Float = 0.9
        static let autocorrectMaxCompletionExtra = 2
        static let autocorrectCompletionMinTyped = 5
        static let autocorrectMaxScoreGap: Float = 0.25
        static let shortTypedMaxEditCost: Float = 0.9
        static let freqWeight: Float = 0.35
        static let bigramWeight: Float = 0.4
        static let maxCandidates = 3
        static let maxCompletions = 8
        static let confidenceCommon: Float = 0.6
        static let confidenceRare: Float = 0.72
        static let confidenceBigramBonus: Float = 0.08
        static let commonFreqFloor: UInt8 = 64
        static let epsilon: Float = 1e-6
        static let predictionFallbackScan = 16
    }

    /// Curated sentence-openers shown when there is no previous word (empty
    /// field or just after sentence-terminal punctuation). Lowercase; the
    /// caller applies sentence casing. Mirrors decoder.js SENTENCE_STARTERS.
    private static let sentenceStarters = [
        "i", "the", "you", "it", "we", "thanks", "hey",
    ]

    private enum Format {
        static let headerSize = 64
        static let nodeSize = 16
        static let leaf: UInt32 = 0xFFFF_FFFF
        static let nonTerminalWordId: UInt32 = 0xFF_FFFF
        static let flagTerminal: UInt8 = 0x01
        static let flagNeverCorrectTo: UInt8 = 0x02
        static let flagProperNoun: UInt8 = 0x04
        static let maxTypedLength = 32
    }

    /// Contractions whose typed form is ALSO a valid word (its, ill, id,
    /// lets). Auto-applied only when sentence-initial AND typed with a
    /// leading capital ("Its way" -> "It's way") — the capitalization comes
    /// from auto-cap, so this naturally limits to sentence starts, where the
    /// contraction reading dominates. Mid-sentence lowercase "its"/"ill"
    /// stay untouched. Mirrors decoder.js AMBIGUOUS_SENTENCE_INITIAL.
    private static let ambiguousSentenceInitial: [String: String] = [
        "its": "It's",
        "ill": "I'll",
        "id": "I'd",
        "lets": "Let's",
    ]

    /// A key tap in normalized key-grid units (key width = 1.0), matching
    /// `KeyAdjacency.center`. Fed per typed character to refine substitution
    /// costs; mirrors decoder.js `touchPoints`.
    struct TouchPoint {
        let x: Float
        let y: Float
    }

    struct Evaluation {
        let candidates: [String]
        let topIsCorrection: Bool
        /// The typed word, set only when a correction is pending — feeds the
        /// strip's quoted "keep what I typed" slot.
        let verbatim: String?
        /// The word autocorrect-on-separator should apply. May differ from
        /// `candidates[0]`: the strip can lead with a speculative completion
        /// ("wichita") while the safe correction ("which") is what commits.
        let replacement: String?
        static let empty = Evaluation(
            candidates: [], topIsCorrection: false, verbatim: nil, replacement: nil
        )
    }

    private struct Candidate {
        var word: [UInt8]
        var editCost: Float
        var freq: UInt8
        var flags: UInt8
        var completionExtra: Int = 0
        /// nil = not a split candidate; false = split without corpus evidence
        /// (tap-only); true = evidenced or contraction split.
        var splitHasBigram: Bool?
        var bigramFreq: UInt8 = 0
        var score: Float = 0
    }

    // MARK: - State

    private(set) var isLoaded = false
    private var bytes = Data()
    private var nodesOffset = 0
    private var labelsOffset = 0
    private var topStringsOffset = 0
    private var topStringsCount = 0
    private var bigramsOffset = 0
    private var bigramCount = 0
    private var contractions: [String: String] = [:]

    /// Context-aware confusable entries parsed from bundled `confusables.json`
    /// (ill -> I'll etc.), keyed by the lowercase plain word.
    private struct Confusable {
        let contraction: String
        let next: Set<String>
    }
    private var confusables: [String: Confusable] = [:]

    let userLexicon: UserLexicon

    init(userLexicon: UserLexicon) {
        self.userLexicon = userLexicon
    }

    // MARK: - Loading

    /// Loads and validates the bundled binary. Call off the main thread; until
    /// it finishes, `isLoaded` stays false and the router falls back to the
    /// system checker. The data is memory-mapped, so resident cost is only the
    /// pages a lookup actually touches.
    func load() {
        guard
            let url = Bundle.main.url(
                forResource: "keyboard_dictionary", withExtension: "echd"
            )
        else { return }
        load(
            dictionaryURL: url,
            confusablesURL: Bundle.main.url(
                forResource: "confusables", withExtension: "json"
            )
        )
    }

    /// Bundle-independent load from explicit file URLs — the entry point the
    /// parity runner uses. The header is always validated; a corrupt file
    /// leaves the engine unloaded.
    ///
    /// `verifyChecksum` additionally checks the body CRC. Off for the bundled
    /// load on purpose: the CRC is a byte-at-a-time scan of the whole ~2.8 MB
    /// body (tens of ms on device), and it would fault in every page of the
    /// mapping, defeating the lazy paging this loader is built around. The
    /// shipped `.echd` is a code-signed bundle resource, and the magic,
    /// version and section-bounds checks already reject a wrong or truncated
    /// file. The parity harness loads an arbitrary path, so it opts in.
    func load(dictionaryURL: URL, confusablesURL: URL?, verifyChecksum: Bool = false) {
        guard
            let data = try? Data(contentsOf: dictionaryURL, options: .mappedIfSafe),
            data.count >= Format.headerSize,
            data[0] == 0x45, data[1] == 0x43, data[2] == 0x48, data[3] == 0x44, // "ECHD"
            readU16(data, 4) == 1,
            !verifyChecksum || readU32(data, 52) == Self.crc32(data, from: Format.headerSize)
        else { return }

        nodesOffset = Int(readU32(data, 16))
        labelsOffset = Int(readU32(data, 20))
        topStringsOffset = Int(readU32(data, 28))
        topStringsCount = Int(readU32(data, 32))
        bigramsOffset = Int(readU32(data, 36))
        bigramCount = Int(readU32(data, 40))
        let contractionsOffset = Int(readU32(data, 44))
        let contractionCount = Int(readU32(data, 48))
        guard contractionsOffset + contractionCount * 6 <= data.count else { return }

        var map: [String: String] = [:]
        let poolStart = contractionsOffset + contractionCount * 6
        for i in 0..<contractionCount {
            let off = contractionsOffset + i * 6
            let typedOffset = Int(readU16(data, off))
            let typedLen = Int(data[off + 2])
            let replOffset = Int(readU16(data, off + 3))
            let replLen = Int(data[off + 5])
            guard
                let typed = string(data, at: poolStart + typedOffset, length: typedLen),
                let repl = string(data, at: poolStart + replOffset, length: replLen)
            else { continue }
            map[typed] = repl
        }

        loadConfusables(url: confusablesURL)
        bytes = data
        contractions = map
        isLoaded = true
    }

    /// Parses the bundled confusables table. Independent of the dictionary — a
    /// missing/invalid file just leaves the feature off.
    private func loadConfusables(url: URL?) {
        guard
            let url,
            let data = try? Data(contentsOf: url),
            let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return }
        var map: [String: Confusable] = [:]
        for (key, value) in obj {
            if key.hasPrefix("_") { continue }
            guard
                let entry = value as? [String: Any],
                let contraction = entry["contraction"] as? String,
                !contraction.isEmpty,
                let next = entry["next"] as? [String]
            else { continue }
            map[key.lowercased()] = Confusable(
                contraction: contraction,
                next: Set(next.map { $0.lowercased() })
            )
        }
        confusables = map
    }

    private static let crcTable: [UInt32] = (0..<256).map { i in
        var c = UInt32(i)
        for _ in 0..<8 { c = (c & 1) != 0 ? 0xEDB8_8320 ^ (c >> 1) : c >> 1 }
        return c
    }

    /// CRC-32 (reflected IEEE, the same polynomial as encoder.js `crc32`) over
    /// `data` from byte `from` to the end.
    private static func crc32(_ data: Data, from: Int) -> UInt32 {
        var crc: UInt32 = 0xFFFF_FFFF
        data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            for i in from..<raw.count {
                crc = crcTable[Int((crc ^ UInt32(raw[i])) & 0xFF)] ^ (crc >> 8)
            }
        }
        return crc ^ 0xFFFF_FFFF
    }

    private func readU16(_ data: Data, _ offset: Int) -> UInt16 {
        UInt16(data[offset]) | (UInt16(data[offset + 1]) << 8)
    }

    private func readU32(_ data: Data, _ offset: Int) -> UInt32 {
        UInt32(data[offset]) | (UInt32(data[offset + 1]) << 8)
            | (UInt32(data[offset + 2]) << 16) | (UInt32(data[offset + 3]) << 24)
    }

    private func string(_ data: Data, at offset: Int, length: Int) -> String? {
        guard offset >= 0, offset + length <= data.count else { return nil }
        return String(data: data.subdata(in: offset..<(offset + length)), encoding: .utf8)
    }

    // MARK: - Public API

    /// Normalizes a typed token for lookup: lowercase, smart apostrophe → '.
    static func normalize(_ word: String) -> String {
        word.lowercased().replacingOccurrences(of: "\u{2019}", with: "'")
    }

    /// True when the exact (lowercased) word is in the bundled dictionary.
    func contains(_ word: String) -> Bool {
        guard isLoaded, let typed = asciiBytes(Self.normalize(word)) else {
            return false
        }
        return bytes.withUnsafeBytes { raw in
            findTerminal(raw, typed) != nil
        }
    }

    /// Context-aware confusable correction (retroactive). Mirrors decoder.js
    /// `contextualContraction`: returns the contraction the previous word
    /// should become given the word that just followed it, or nil to leave it.
    /// Fires only for a lowercase plain word whose follower is in its trigger
    /// set and whose pair isn't blacklisted.
    func contextualContraction(prevWordRaw: String, nextWord: String) -> String? {
        guard isLoaded, !prevWordRaw.isEmpty, !nextWord.isEmpty else { return nil }
        let plain = prevWordRaw.lowercased()
        guard prevWordRaw == plain, let entry = confusables[plain] else { return nil }
        guard entry.next.contains(nextWord.lowercased()) else { return nil }
        if userLexicon.isBlacklisted(
            typed: plain, corrected: entry.contraction.lowercased()
        ) {
            return nil
        }
        return entry.contraction
    }

    /// Top continuations of `prevWord` — the next-word prediction strip shown
    /// right after a separator. Pairs the user actually types (learned in
    /// `UserLexicon`) lead; the static bigram table fills the rest. Proper
    /// nouns render title-case.
    func nextWords(after prevWord: String, limit: Int = Tuning.maxCandidates) -> [String] {
        guard isLoaded else { return [] }
        let normalizedPrev = Self.normalize(prevWord)
        let prevBytes = normalizedPrev.isEmpty ? nil : asciiBytes(normalizedPrev)
        var results: [String] = []
        var seen = Set<String>()
        if !normalizedPrev.isEmpty { seen.insert(normalizedPrev.lowercased()) }
        func add(_ word: String) {
            guard results.count < limit else { return }
            let key = word.lowercased()
            guard !seen.contains(key), key.count >= 2 || key == "i" else { return }
            seen.insert(key)
            results.append(word)
        }
        bytes.withUnsafeBytes { raw in
            if let prev = prevBytes {
                for word in userLexicon.nextWords(after: normalizedPrev) {
                    add(renderStored(raw, word: word))
                }
                for entry in bigramRun(raw, prevWord: prev) {
                    if let word = topString(raw, id: entry.nextId) {
                        add(renderStored(raw, word: word))
                    }
                }
            } else {
                // No context (sentence start): curated openers.
                for starter in Self.sentenceStarters { add(renderStored(raw, word: starter)) }
            }
            // Fill remaining slots from the frequency-ranked word list so the
            // strip is never left half-empty.
            var id: UInt32 = 0
            while results.count < limit, id < UInt32(Tuning.predictionFallbackScan) {
                if let word = topString(raw, id: id) { add(renderStored(raw, word: word)) }
                id += 1
            }
        }
        return Array(results.prefix(limit))
    }

    /// Next-character weights for the in-progress prefix, from the trie's
    /// maxSubtreeFreq — the signal behind invisible key-target resizing.
    /// Lowercase letter byte → weight in (0, 1], normalized to the strongest
    /// continuation and rounded to 4 decimals; empty when the prefix has left
    /// the trie. Mirrors decoder.js `nextCharWeights`.
    func nextCharWeights(prefix: String) -> [UInt8: Float] {
        guard isLoaded else { return [:] }
        let normalized = Self.normalize(prefix)
        guard !normalized.isEmpty, normalized.count <= 24,
              let prefixBytes = asciiBytes(normalized) else { return [:] }
        var weights: [UInt8: Float] = [:]
        bytes.withUnsafeBytes { (raw: UnsafeRawBufferPointer) in
            guard let hit = walk(raw, prefixBytes) else { return }
            func add(_ ch: UInt8, _ freq: UInt8) {
                guard ch >= UInt8(ascii: "a"), ch <= UInt8(ascii: "z") else { return }
                let f = Float(freq)
                if weights[ch] ?? 0 < f { weights[ch] = f }
            }
            if hit.labelRestLength > 0 {
                add(raw[hit.labelRestOffset], nodeMaxSubtreeFreq(raw, hit.node))
            } else {
                let firstChild = nodeFirstChild(raw, hit.node)
                if firstChild != Format.leaf {
                    for c in 0..<nodeChildCount(raw, hit.node) {
                        let child = Int(firstChild) + c
                        let (labelOffset, _) = nodeLabelRange(raw, child)
                        add(raw[labelOffset], nodeMaxSubtreeFreq(raw, child))
                    }
                }
            }
        }
        guard let maxWeight = weights.values.max(), maxWeight > 0 else { return [:] }
        return weights.mapValues { ($0 / maxWeight * 10000).rounded() / 10000 }
    }

    /// Renders a dictionary-stored (lowercase) word for display: proper nouns
    /// (France, Monday, Google) get title case.
    private func renderStored(_ raw: UnsafeRawBufferPointer, word: String) -> String {
        guard
            !word.contains(" "),
            let bytes = asciiBytes(word),
            let node = findTerminal(raw, bytes),
            nodeFlags(nodePacked(raw, node)) & Format.flagProperNoun != 0
        else { return word }
        return word.prefix(1).uppercased() + word.dropFirst()
    }

    /// Full evaluation of the in-progress word: display candidates plus the
    /// autocorrect verdict. `checkerSaysValid` is the platform veto — on iOS,
    /// `UITextChecker` recognizing the word (Apple's larger lexicon + Contacts
    /// + the system user dictionary) blocks autocorrect even when our
    /// dictionary doesn't know it.
    func evaluate(
        typedRaw: String,
        previousWord: String?,
        checkerSaysValid: Bool,
        touchPoints: [TouchPoint?]? = nil
    ) -> Evaluation {
        guard isLoaded else { return .empty }
        let typedString = Self.normalize(typedRaw)
        guard
            !typedString.isEmpty,
            typedString.count <= Format.maxTypedLength,
            !typedString.contains(where: { $0.isNumber }),
            let typed = asciiBytes(typedString)
        else { return .empty }

        // The sole one-character correction: standalone lowercase "i" becomes
        // "I" (mid-sentence, where auto-cap can't help).
        if typedRaw == "i", !userLexicon.isBlacklisted(typed: "i", corrected: "i") {
            return Evaluation(
                candidates: ["I"],
                topIsCorrection: true,
                verbatim: typedRaw,
                replacement: "I"
            )
        }

        if let ambiguous = Self.ambiguousSentenceInitial[typedString],
           previousWord == nil,
           typedRaw == typedString.prefix(1).uppercased() + typedString.dropFirst(),
           !userLexicon.isBlacklisted(typed: typedString, corrected: ambiguous) {
            return Evaluation(
                candidates: [ambiguous],
                topIsCorrection: true,
                verbatim: typedRaw,
                replacement: ambiguous
            )
        }

        if let contraction = contractions[typedString],
           !userLexicon.isBlacklisted(typed: typedString, corrected: contraction) {
            return Evaluation(
                candidates: [contraction],
                topIsCorrection: true,
                verbatim: typedRaw,
                replacement: contraction
            )
        }

        // Proper nouns typed all-lowercase self-correct to title case
        // (france -> France), like native iOS.
        if typedRaw == typedString,
           let properForm = properNounForm(typedString),
           !userLexicon.isBlacklisted(typed: typedString, corrected: typedString) {
            return Evaluation(
                candidates: [properForm],
                topIsCorrection: true,
                verbatim: typedRaw,
                replacement: properForm
            )
        }

        var scored: [Candidate] = bytes.withUnsafeBytes { raw in
            var merged: [String: Candidate] = [:]
            func add(_ list: [Candidate]) {
                for c in list {
                    let key = String(decoding: c.word, as: UTF8.self)
                    if let existing = merged[key], existing.editCost <= c.editCost {
                        continue
                    }
                    merged[key] = c
                }
            }
            add(fuzzyMatches(raw, typed: typed, touchPoints: touchPoints))
            add(apostropheVariants(raw, typed: typed))
            add(properNounPossessives(raw, typed: typed))
            add(wordSplits(raw, typed: typed))
            if typed.count >= 2 { add(completions(raw, typed: typed)) }
            add(userLexiconCandidates(typed: typed))

            // Profanity ("never correct to") is offered only when typed exactly.
            var kept = merged.values.filter {
                $0.editCost == 0 || ($0.flags & Format.flagNeverCorrectTo) == 0
            }
            let bigramFreqs = previousWord
                .flatMap { asciiBytes(Self.normalize($0)) }
                .map { prev -> [UInt32: UInt8] in
                    var freqs: [UInt32: UInt8] = [:]
                    for entry in bigramRun(raw, prevWord: prev) {
                        freqs[entry.nextId] = entry.freq
                    }
                    return freqs
                } ?? [:]
            for i in kept.indices {
                if let wordId = terminalWordId(raw, word: kept[i].word),
                   let freq = bigramFreqs[wordId] {
                    kept[i].bigramFreq = freq
                }
                kept[i].score = -kept[i].editCost
                    + Tuning.freqWeight * Float(kept[i].freq) / 255
                    + Tuning.bigramWeight * Float(kept[i].bigramFreq) / 255
            }
            return kept
        }

        scored.removeAll { String(decoding: $0.word, as: UTF8.self) == typedString }
        scored.sort {
            if $0.score != $1.score { return $0.score > $1.score }
            return String(decoding: $0.word, as: UTF8.self)
                < String(decoding: $1.word, as: UTF8.self)
        }

        let display = scored.prefix(Tuning.maxCandidates).map {
            Self.renderCandidate(
                String(decoding: $0.word, as: UTF8.self), flags: $0.flags
            )
        }

        // Autocorrect considers the best candidate that is safe to apply
        // blindly — see decoder.js `evaluate` for the rule-by-rule rationale.
        let topScore = scored.first?.score ?? 0
        let acTop = scored.first { c in
            if topScore - c.score > Tuning.autocorrectMaxScoreGap { return false }
            if c.completionExtra > Tuning.autocorrectMaxCompletionExtra { return false }
            if c.completionExtra > 0,
               c.freq < Tuning.commonFreqFloor
                || typed.count < Tuning.autocorrectCompletionMinTyped {
                return false
            }
            if c.splitHasBigram == false { return false }
            if typed.count <= 4, c.editCost > Tuning.shortTypedMaxEditCost {
                return false
            }
            return true
        }

        let isAllCapsAcronym = typedRaw.count <= 5
            && typedRaw == typedRaw.uppercased()
            && typedRaw.contains(where: { $0.isUppercase })
        let typedIsKnown = contains(typedString)
            || userLexicon.contains(typedString)
            || checkerSaysValid

        var topIsCorrection = false
        var replacement: String?
        if let acTop,
           !typedIsKnown,
           typedString.count > 1,
           !isAllCapsAcronym,
           !typedString.contains("-") {
            let acWord = String(decoding: acTop.word, as: UTF8.self)
            let shortTypedRareTop =
                typedString.count <= 3 && acTop.freq < Tuning.commonFreqFloor
            if !shortTypedRareTop,
               !userLexicon.isBlacklisted(typed: typedString, corrected: acWord) {
                let denom = Float(max(typedString.count, acWord.count))
                let confidence = 1 - acTop.editCost / denom
                var threshold = acTop.freq >= Tuning.commonFreqFloor
                    ? Tuning.confidenceCommon
                    : Tuning.confidenceRare
                if acTop.bigramFreq > 0 { threshold -= Tuning.confidenceBigramBonus }
                if confidence >= threshold {
                    topIsCorrection = true
                    replacement = Self.renderCandidate(acWord, flags: acTop.flags)
                }
            }
        }

        return Evaluation(
            candidates: display,
            topIsCorrection: topIsCorrection,
            verbatim: topIsCorrection ? typedRaw : nil,
            replacement: replacement
        )
    }

    /// Title-case form of `word` when the dictionary flags it a proper noun,
    /// else nil.
    private func properNounForm(_ word: String) -> String? {
        guard let typed = asciiBytes(word) else { return nil }
        let isProper: Bool = bytes.withUnsafeBytes { raw in
            guard let node = findTerminal(raw, typed) else { return false }
            return nodeFlags(nodePacked(raw, node)) & Format.flagProperNoun != 0
        }
        guard isProper else { return nil }
        return word.prefix(1).uppercased() + word.dropFirst()
    }

    /// Proper nouns (France, Monday, Google) render title-case; split
    /// candidates (contain a space) keep their per-half casing.
    private static func renderCandidate(_ word: String, flags: UInt8) -> String {
        guard flags & Format.flagProperNoun != 0, !word.contains(" ") else {
            return word
        }
        return word.prefix(1).uppercased() + word.dropFirst()
    }

    // MARK: - Trie primitives

    private func nodeFirstChild(_ raw: UnsafeRawBufferPointer, _ index: Int) -> UInt32 {
        loadU32(raw, nodesOffset + index * Format.nodeSize)
    }

    private func nodeLabelRange(_ raw: UnsafeRawBufferPointer, _ index: Int) -> (offset: Int, length: Int) {
        let base = nodesOffset + index * Format.nodeSize
        return (labelsOffset + Int(loadU32(raw, base + 4)), Int(raw[base + 12]))
    }

    private func nodePacked(_ raw: UnsafeRawBufferPointer, _ index: Int) -> UInt32 {
        loadU32(raw, nodesOffset + index * Format.nodeSize + 8)
    }

    private func nodeChildCount(_ raw: UnsafeRawBufferPointer, _ index: Int) -> Int {
        Int(raw[nodesOffset + index * Format.nodeSize + 13])
    }

    private func nodeFreq(_ raw: UnsafeRawBufferPointer, _ index: Int) -> UInt8 {
        raw[nodesOffset + index * Format.nodeSize + 14]
    }

    private func nodeMaxSubtreeFreq(_ raw: UnsafeRawBufferPointer, _ index: Int) -> UInt8 {
        raw[nodesOffset + index * Format.nodeSize + 15]
    }

    private func nodeIsTerminal(_ packed: UInt32) -> Bool {
        (packed >> 24) & UInt32(Format.flagTerminal) != 0
    }

    private func nodeFlags(_ packed: UInt32) -> UInt8 {
        UInt8((packed >> 24) & 0xFF)
    }

    private func loadU32(_ raw: UnsafeRawBufferPointer, _ offset: Int) -> UInt32 {
        UInt32(raw[offset]) | (UInt32(raw[offset + 1]) << 8)
            | (UInt32(raw[offset + 2]) << 16) | (UInt32(raw[offset + 3]) << 24)
    }

    private func loadU24(_ raw: UnsafeRawBufferPointer, _ offset: Int) -> UInt32 {
        UInt32(raw[offset]) | (UInt32(raw[offset + 1]) << 8)
            | (UInt32(raw[offset + 2]) << 16)
    }

    /// Walks `word` through the trie. Returns the landing node index and the
    /// unconsumed remainder of its label ("" = landed on a node boundary), or
    /// nil when the word diverges from every path.
    private func walk(
        _ raw: UnsafeRawBufferPointer, _ word: [UInt8]
    ) -> (node: Int, labelRestOffset: Int, labelRestLength: Int)? {
        var index = 0
        var pos = 0
        while true {
            if pos == word.count { return (index, 0, 0) }
            let firstChild = nodeFirstChild(raw, index)
            if firstChild == Format.leaf { return nil }
            var childIndex = -1
            for c in 0..<nodeChildCount(raw, index) {
                let candidate = Int(firstChild) + c
                let (labelOffset, _) = nodeLabelRange(raw, candidate)
                if raw[labelOffset] == word[pos] {
                    childIndex = candidate
                    break
                }
            }
            if childIndex < 0 { return nil }
            let (labelOffset, labelLength) = nodeLabelRange(raw, childIndex)
            var k = 0
            while k < labelLength, pos + k < word.count,
                  raw[labelOffset + k] == word[pos + k] {
                k += 1
            }
            if pos + k == word.count {
                return (childIndex, labelOffset + k, labelLength - k)
            }
            if k < labelLength { return nil }
            index = childIndex
            pos += k
        }
    }

    private func findTerminal(
        _ raw: UnsafeRawBufferPointer, _ word: [UInt8]
    ) -> Int? {
        guard let hit = walk(raw, word), hit.labelRestLength == 0,
              nodeIsTerminal(nodePacked(raw, hit.node)) else { return nil }
        return hit.node
    }

    private func terminalWordId(
        _ raw: UnsafeRawBufferPointer, word: [UInt8]
    ) -> UInt32? {
        // Split candidates contain a space and can never be trie words.
        if word.contains(0x20) { return nil }
        guard let node = findTerminal(raw, word) else { return nil }
        let id = nodePacked(raw, node) & Format.nonTerminalWordId
        return id == Format.nonTerminalWordId ? nil : id
    }

    private func topString(_ raw: UnsafeRawBufferPointer, id: UInt32) -> String? {
        guard Int(id) < topStringsCount else { return nil }
        let base = topStringsOffset
        let poolStart = base + 4 * (topStringsCount + 1)
        let start = Int(loadU32(raw, base + 4 * Int(id)))
        let end = Int(loadU32(raw, base + 4 * (Int(id) + 1)))
        var out = [UInt8]()
        out.reserveCapacity(end - start)
        for i in start..<end { out.append(raw[poolStart + i]) }
        return String(decoding: out, as: UTF8.self)
    }

    private func bigramRun(
        _ raw: UnsafeRawBufferPointer, prevWord: [UInt8]
    ) -> [(nextId: UInt32, freq: UInt8)] {
        guard let prevId = terminalWordId(raw, word: prevWord) else { return [] }
        var lo = 0
        var hi = bigramCount
        while lo < hi {
            let mid = (lo + hi) / 2
            if loadU24(raw, bigramsOffset + mid * 8) < prevId {
                lo = mid + 1
            } else {
                hi = mid
            }
        }
        var results: [(UInt32, UInt8)] = []
        var i = lo
        while i < bigramCount {
            let off = bigramsOffset + i * 8
            if loadU24(raw, off) != prevId { break }
            results.append((loadU24(raw, off + 3), raw[off + 6]))
            i += 1
        }
        return results
    }

    // MARK: - Candidate sources (mirror decoder.js)

    private func editBudget(_ typedLength: Int) -> Float {
        if typedLength <= 4 { return 1.0 }
        if typedLength <= 8 { return 2.0 }
        return 2.5
    }

    private func applyFirstLetterSurcharge(
        typed: [UInt8], word: [UInt8], editCost: Float
    ) -> Float {
        if editCost == 0 || typed[0] == word[0] { return editCost }
        let transposedFirstPair = typed.count >= 2 && word.count >= 2
            && typed[0] == word[1] && typed[1] == word[0]
        return transposedFirstPair ? editCost : editCost + Tuning.firstLetterSurcharge
    }

    /// Substitution cost for consuming candidate byte `c` where the user typed
    /// `t`. With a touch point, cost scales with the tap's distance from `c`'s
    /// key center; without one, falls back to the adjacency graph. `center` is
    /// `c`'s key center; the DP caller resolves it once per candidate byte so
    /// the inner loop over typed positions doesn't repeat the lookup. Mirrors
    /// decoder.js `substitutionCost`.
    private func substitutionCost(
        _ t: UInt8, _ c: UInt8, _ touch: TouchPoint?, _ center: (x: Float, y: Float)?
    ) -> Float {
        if t == c { return 0 }
        if let touch, let center {
            let dx = touch.x - center.x
            let dy = touch.y - center.y
            let d = (dx * dx + dy * dy).squareRoot()
            let cost = Tuning.subTouchBase
                + Tuning.subTouchPerUnit * max(0, d - Tuning.subTouchDeadZone)
            return min(Tuning.subOther, max(Tuning.subTouchMin, cost))
        }
        return KeyAdjacency.isAdjacent(t, c) ? Tuning.subAdjacent : Tuning.subOther
    }

    /// Weighted Damerau-Levenshtein DP over trie descent (see decoder.js
    /// `fuzzyMatches` for the transition-by-transition rationale).
    private func fuzzyMatches(
        _ raw: UnsafeRawBufferPointer, typed: [UInt8], touchPoints: [TouchPoint?]? = nil
    ) -> [Candidate] {
        let n = typed.count
        let budget = editBudget(n)
        // A stale buffer must degrade to the adjacency model, never skew costs
        // against the wrong characters.
        let touches = touchPoints?.count == n ? touchPoints : nil

        func insertCost(_ i: Int) -> Float {
            i >= 2 && typed[i - 1] == typed[i - 2]
                ? Tuning.insertDuplicate : Tuning.insertOther
        }

        var row0 = [Float](repeating: 0, count: n + 1)
        for i in 1...max(1, n) where i <= n {
            row0[i] = row0[i - 1] + insertCost(i)
        }

        var results: [Candidate] = []
        var rows: [[Float]] = [row0]
        var pathChars: [UInt8] = []

        func dfs(_ index: Int) {
            let depthBefore = pathChars.count
            let (labelOffset, labelLength) = index == 0
                ? (0, 0) : nodeLabelRange(raw, index)
            var pruned = false
            var li = 0
            while li < labelLength {
                let c = raw[labelOffset + li]
                let j = pathChars.count + 1
                let prevRow = rows[j - 1]
                let deleteCost: Float = j >= 2 && c == pathChars[j - 2]
                    ? Tuning.deletionDuplicate : Tuning.deletion
                var newRow = [Float](repeating: 0, count: n + 1)
                newRow[0] = prevRow[0] + deleteCost
                var rowMin = newRow[0]
                let center = KeyAdjacency.center(c)
                for i in 1...n {
                    let t = typed[i - 1]
                    let subCost = substitutionCost(t, c, touches?[i - 1] ?? nil, center)
                    var best = min(
                        prevRow[i - 1] + subCost,
                        newRow[i - 1] + insertCost(i),
                        prevRow[i] + deleteCost
                    )
                    if j >= 2, i >= 2, t == pathChars[j - 2], typed[i - 2] == c {
                        best = min(best, rows[j - 2][i - 2] + Tuning.transposition)
                    }
                    newRow[i] = best
                    rowMin = min(rowMin, best)
                }
                rows.append(newRow)
                pathChars.append(c)
                if rowMin > budget + Tuning.epsilon {
                    pruned = true
                    break
                }
                li += 1
            }
            if !pruned {
                let packed = nodePacked(raw, index)
                if nodeIsTerminal(packed), !pathChars.isEmpty {
                    let editCost = applyFirstLetterSurcharge(
                        typed: typed, word: pathChars, editCost: rows[rows.count - 1][n]
                    )
                    if editCost <= budget + Tuning.epsilon {
                        results.append(Candidate(
                            word: pathChars,
                            editCost: editCost,
                            freq: nodeFreq(raw, index),
                            flags: nodeFlags(packed)
                        ))
                    }
                }
                let firstChild = nodeFirstChild(raw, index)
                if firstChild != Format.leaf {
                    for c in 0..<nodeChildCount(raw, index) {
                        dfs(Int(firstChild) + c)
                    }
                }
            }
            rows.removeLast(rows.count - (depthBefore + 1))
            pathChars.removeLast(pathChars.count - depthBefore)
        }
        if n > 0 { dfs(0) }
        return results
    }

    /// Exact-prefix completions, best-first over `maxSubtreeFreq`.
    private func completions(
        _ raw: UnsafeRawBufferPointer, typed: [UInt8]
    ) -> [Candidate] {
        guard let hit = walk(raw, typed) else { return [] }
        var results: [Candidate] = []
        var queue: [(index: Int, suffix: [UInt8])] = []
        if hit.labelRestLength > 0 {
            var rest = [UInt8]()
            for i in 0..<hit.labelRestLength { rest.append(raw[hit.labelRestOffset + i]) }
            queue.append((hit.node, rest))
        } else {
            let firstChild = nodeFirstChild(raw, hit.node)
            if firstChild != Format.leaf {
                for c in 0..<nodeChildCount(raw, hit.node) {
                    let child = Int(firstChild) + c
                    let (labelOffset, labelLength) = nodeLabelRange(raw, child)
                    var suffix = [UInt8]()
                    for i in 0..<labelLength { suffix.append(raw[labelOffset + i]) }
                    queue.append((child, suffix))
                }
            }
        }
        while !queue.isEmpty, results.count < Tuning.maxCompletions {
            // Best-first: pop the entry whose subtree holds the highest
            // frequency (ties by node index for determinism).
            var bestAt = 0
            for i in 1..<queue.count {
                let a = queue[i], b = queue[bestAt]
                let fa = nodeMaxSubtreeFreq(raw, a.index)
                let fb = nodeMaxSubtreeFreq(raw, b.index)
                if fa > fb || (fa == fb && a.index < b.index) { bestAt = i }
            }
            let (index, suffix) = queue.remove(at: bestAt)
            let packed = nodePacked(raw, index)
            if nodeIsTerminal(packed), !suffix.isEmpty {
                let penalty = min(
                    Tuning.completionCap,
                    Tuning.completionPerChar * Float(suffix.count)
                )
                results.append(Candidate(
                    word: typed + suffix,
                    editCost: penalty,
                    freq: nodeFreq(raw, index),
                    flags: nodeFlags(packed),
                    completionExtra: suffix.count
                ))
            }
            let firstChild = nodeFirstChild(raw, index)
            if firstChild != Format.leaf {
                for c in 0..<nodeChildCount(raw, index) {
                    let child = Int(firstChild) + c
                    let (labelOffset, labelLength) = nodeLabelRange(raw, child)
                    var childSuffix = suffix
                    for i in 0..<labelLength { childSuffix.append(raw[labelOffset + i]) }
                    queue.append((child, childSuffix))
                }
            }
        }
        return results
    }

    /// Apostrophe restoration: cant → can't (len-1 exact probes).
    private func apostropheVariants(
        _ raw: UnsafeRawBufferPointer, typed: [UInt8]
    ) -> [Candidate] {
        let apostrophe = UInt8(ascii: "'")
        if typed.contains(apostrophe) { return [] }
        var results: [Candidate] = []
        for i in 1..<max(1, typed.count) where i < typed.count {
            var variant = typed
            variant.insert(apostrophe, at: i)
            if let node = findTerminal(raw, variant) {
                results.append(Candidate(
                    word: variant,
                    editCost: Tuning.apostropheRestore,
                    freq: nodeFreq(raw, node),
                    flags: nodeFlags(nodePacked(raw, node))
                ))
            }
        }
        return results
    }

    /// Proper-noun possessive restoration: johns → "John's". Mirrors
    /// decoder.js `properNounPossessives`.
    private func properNounPossessives(
        _ raw: UnsafeRawBufferPointer, typed: [UInt8]
    ) -> [Candidate] {
        let apostrophe = UInt8(ascii: "'")
        let sByte = UInt8(ascii: "s")
        guard typed.count >= 3, typed.last == sByte,
              !typed.contains(apostrophe) else { return [] }
        if findTerminal(raw, typed) != nil { return [] }
        let base = Array(typed[0..<(typed.count - 1)])
        guard let node = findTerminal(raw, base) else { return [] }
        let flags = nodeFlags(nodePacked(raw, node))
        guard flags & Format.flagProperNoun != 0 else { return [] }
        var word = base
        word.append(apostrophe)
        word.append(sByte)
        return [Candidate(
            word: word,
            editCost: Tuning.apostropheRestore,
            freq: nodeFreq(raw, node),
            flags: flags
        )]
    }

    /// The expansion to use when a split half is itself a forced-replacement
    /// entry, or nil when it is not eligible. Real contractions always expand
    /// to an apostrophe form (build.js asserts this); forced corrections
    /// (calender → calendar) never do, and their typed form is an ordinary
    /// misspelling, so a split around it is not self-evident and must earn
    /// bigram evidence like any other split. Mirrors decoder.js
    /// `splitContraction`.
    private func splitContraction(_ half: String) -> String? {
        guard let expansion = contractions[half], expansion.contains("'") else {
            return nil
        }
        return expansion
    }

    /// Missing-space restoration: alot → "a lot", imnot → "I'm not".
    private func wordSplits(
        _ raw: UnsafeRawBufferPointer, typed: [UInt8]
    ) -> [Candidate] {
        guard typed.count >= 3,
              !typed.contains(UInt8(ascii: "'")),
              !typed.contains(UInt8(ascii: "-")) else { return [] }
        let typedIsValid = findTerminal(raw, typed) != nil
        var results: [Candidate] = []
        for i in 1..<typed.count {
            let leftBytes = Array(typed[0..<i])
            let rightBytes = Array(typed[i...])
            let leftString = String(decoding: leftBytes, as: UTF8.self)
            let rightString = String(decoding: rightBytes, as: UTF8.self)
            let leftContraction = splitContraction(leftString)
            let rightContraction = splitContraction(rightString)
            let leftNode = findTerminal(raw, leftBytes)
            let rightNode = findTerminal(raw, rightBytes)
            let leftFreq = leftNode.map { nodeFreq(raw, $0) }
            let rightFreq = rightNode.map { nodeFreq(raw, $0) }
            if leftContraction == nil,
               leftFreq == nil || leftFreq! < Tuning.commonFreqFloor { continue }
            if rightContraction == nil,
               rightFreq == nil || rightFreq! < Tuning.commonFreqFloor { continue }
            let contractionHalf = leftContraction != nil || rightContraction != nil
            var hasBigram = false
            if !contractionHalf, let rightNode {
                let rightId = nodePacked(raw, rightNode) & Format.nonTerminalWordId
                hasBigram = bigramRun(raw, prevWord: leftBytes)
                    .contains { $0.nextId == rightId }
            }
            if typedIsValid, !hasBigram { continue }
            func renderHalf(_ bytes: [UInt8], _ contraction: String?) -> String {
                if let contraction { return contraction }
                let word = String(decoding: bytes, as: UTF8.self)
                return word == "i" ? "I" : word
            }
            let rendered = renderHalf(leftBytes, leftContraction) + " "
                + renderHalf(rightBytes, rightContraction)
            results.append(Candidate(
                word: Array(rendered.utf8),
                editCost: Tuning.wordSplit,
                freq: min(leftFreq ?? 255, rightFreq ?? 255),
                flags: (leftNode.map { nodeFlags(nodePacked(raw, $0)) } ?? 0)
                    | (rightNode.map { nodeFlags(nodePacked(raw, $0)) } ?? 0),
                splitHasBigram: contractionHalf || hasBigram
            ))
        }
        return results
    }

    /// Learned-word candidates: plain weighted DL against the (small) user
    /// lexicon plus prefix completions. Native-only extension of the
    /// reference (the jest suite models the lexicon via its vetoes instead).
    private func userLexiconCandidates(typed: [UInt8]) -> [Candidate] {
        let n = typed.count
        guard n > 0 else { return [] }
        let budget = editBudget(n)
        var results: [Candidate] = []
        for word in userLexicon.allWords() {
            guard let target = asciiBytes(word), !target.isEmpty else { continue }
            guard let freq = userLexicon.freqQ(word) else { continue }
            if target.count > n, target.starts(with: typed) {
                let extra = target.count - n
                results.append(Candidate(
                    word: target,
                    editCost: min(
                        Tuning.completionCap,
                        Tuning.completionPerChar * Float(extra)
                    ),
                    freq: freq,
                    flags: 0,
                    completionExtra: extra
                ))
                continue
            }
            if abs(target.count - n) > 2 { continue }
            let cost = weightedDistance(typed: typed, target: target, budget: budget)
            if cost <= budget + Tuning.epsilon {
                let surcharged = applyFirstLetterSurcharge(
                    typed: typed, word: target, editCost: cost
                )
                if surcharged <= budget + Tuning.epsilon {
                    results.append(Candidate(
                        word: target, editCost: surcharged, freq: freq, flags: 0
                    ))
                }
            }
        }
        return results
    }

    /// Plain two-word weighted Damerau-Levenshtein with the same costs as the
    /// trie DP; used only for the user lexicon.
    private func weightedDistance(
        typed: [UInt8], target: [UInt8], budget: Float
    ) -> Float {
        let n = typed.count
        func insertCost(_ i: Int) -> Float {
            i >= 2 && typed[i - 1] == typed[i - 2]
                ? Tuning.insertDuplicate : Tuning.insertOther
        }
        var rows: [[Float]] = []
        var row0 = [Float](repeating: 0, count: n + 1)
        for i in 1...max(1, n) where i <= n {
            row0[i] = row0[i - 1] + insertCost(i)
        }
        rows.append(row0)
        for j in 1...target.count {
            let c = target[j - 1]
            let deleteCost: Float = j >= 2 && c == target[j - 2]
                ? Tuning.deletionDuplicate : Tuning.deletion
            var row = [Float](repeating: 0, count: n + 1)
            row[0] = rows[j - 1][0] + deleteCost
            var rowMin = row[0]
            for i in 1...n {
                let t = typed[i - 1]
                let subCost: Float = t == c
                    ? 0
                    : (KeyAdjacency.isAdjacent(t, c)
                        ? Tuning.subAdjacent : Tuning.subOther)
                var best = min(
                    rows[j - 1][i - 1] + subCost,
                    row[i - 1] + insertCost(i),
                    rows[j - 1][i] + deleteCost
                )
                if j >= 2, i >= 2, t == target[j - 2], typed[i - 2] == c {
                    best = min(best, rows[j - 2][i - 2] + Tuning.transposition)
                }
                row[i] = best
                rowMin = min(rowMin, best)
            }
            if rowMin > budget + Tuning.epsilon { return .infinity }
            rows.append(row)
        }
        return rows[target.count][n]
    }

    /// ASCII bytes of a normalized word, or nil when it contains characters
    /// outside the dictionary alphabet (the engine then abstains).
    private func asciiBytes(_ word: String) -> [UInt8]? {
        var out = [UInt8]()
        out.reserveCapacity(word.utf8.count)
        for byte in word.utf8 {
            if byte >= 128 { return nil }
            out.append(byte)
        }
        return out.isEmpty ? nil : out
    }
}
