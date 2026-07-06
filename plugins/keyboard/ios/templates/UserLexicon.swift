import Foundation

/// The keyboard's learned vocabulary (§5.11): words the user actually types
/// ("figma", "sats", teammate names) plus a blacklist of autocorrects the user
/// reverted, so the same wrong fix is never auto-applied twice. Persisted as
/// JSON in the App Group container — no Full Access, no network.
///
/// Learning rules (mirrored by `UserLexicon.kt`):
///  - an unknown word committed with a separator twice is learned,
///  - tapping the verbatim strip slot learns immediately,
///  - reverting an autocorrect blacklists that exact typed→corrected pair.
final class UserLexicon {

    private struct Entry: Codable {
        var c: Int // commit count
        var t: TimeInterval // last-used epoch seconds
    }

    private struct Store: Codable {
        var version: Int = 1
        var words: [String: Entry] = [:]
        var blacklist: [String: TimeInterval] = [:]
        /// Word pairs the user actually types, keyed "prev next" — feeds
        /// next-word prediction ahead of the static bigram table.
        var bigrams: [String: Entry] = [:]
    }

    static let maxWords = 5000
    static let maxBlacklist = 500
    static let maxBigrams = 2000
    private static let learnAfterCommits = 2
    private static let flushAfterMutations = 20
    private static let fileName = "keyboard-user-lexicon.json"

    private var store = Store()
    /// Unknown words seen once; promoted into `store.words` on the second
    /// commit. In-memory only — a word must prove itself within one session.
    private var pendingWords: [String: Int] = [:]
    private var mutationsSinceFlush = 0
    private var loaded = false

    private let fileURL: URL? = {
        guard
            let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: KeyboardSettings.appGroupID
            )
        else { return nil }
        let dir = container.appendingPathComponent("Library", isDirectory: true)
        try? FileManager.default.createDirectory(
            at: dir, withIntermediateDirectories: true
        )
        return dir.appendingPathComponent(UserLexicon.fileName)
    }()

    // MARK: - Persistence

    /// Called off the main thread at engine init. A missing or unparseable
    /// file starts fresh — learned words are a cache, never precious.
    func load() {
        defer { loaded = true }
        guard
            let url = fileURL,
            let data = try? Data(contentsOf: url),
            let decoded = try? JSONDecoder().decode(Store.self, from: data)
        else { return }
        store = decoded
    }

    /// Writes synchronously; callers flush from `viewWillDisappear` or after
    /// a burst of mutations, never on the keystroke path.
    func flush() {
        guard loaded, mutationsSinceFlush > 0, let url = fileURL else { return }
        mutationsSinceFlush = 0
        guard let data = try? JSONEncoder().encode(store) else { return }
        try? data.write(to: url, options: .atomic)
    }

    private func markMutated() {
        mutationsSinceFlush += 1
        if mutationsSinceFlush >= Self.flushAfterMutations {
            flush()
        }
    }

    // MARK: - Queries

    func contains(_ word: String) -> Bool {
        loaded && store.words[word.lowercased()] != nil
    }

    /// Candidate weight for a learned word, comparable to the dictionary's
    /// log-quantized byte: starts a bit below common words and grows with use.
    func freqQ(_ word: String) -> UInt8? {
        guard loaded, let entry = store.words[word.lowercased()] else { return nil }
        return UInt8(min(255, 96 + 16 * entry.c))
    }

    func isBlacklisted(typed: String, corrected: String) -> Bool {
        loaded && store.blacklist[Self.pairKey(typed, corrected)] != nil
    }

    /// All learned words — the correction engine fuzzy-matches against these
    /// alongside the bundled dictionary (≤5000 words, trivially fast).
    func allWords() -> [String] {
        loaded ? Array(store.words.keys) : []
    }

    /// Learned continuations of `previous`, most-used first. Linear scan over
    /// ≤2000 entries — trivially fast.
    func nextWords(after previous: String, limit: Int = 3) -> [String] {
        guard loaded else { return [] }
        let prefix = previous.lowercased() + " "
        return store.bigrams
            .filter { $0.key.hasPrefix(prefix) }
            .sorted { $0.value.c != $1.value.c ? $0.value.c > $1.value.c : $0.key < $1.key }
            .prefix(limit)
            .map { String($0.key.dropFirst(prefix.count)) }
    }

    // MARK: - Learning

    /// Feed every separator-committed word through here. Unknown words are
    /// learned on their second commit; known (dictionary or learned) words
    /// bump their use count so their suggestions strengthen.
    func observeCommit(word: String, isInDictionary: Bool) {
        guard loaded else { return }
        let key = word.lowercased()
        guard Self.isLearnable(key) else { return }
        if store.words[key] != nil {
            bump(key)
            return
        }
        if isInDictionary { return }
        let seen = (pendingWords[key] ?? 0) + 1
        if seen >= Self.learnAfterCommits {
            pendingWords.removeValue(forKey: key)
            learnNow(word)
        } else {
            pendingWords[key] = seen
        }
    }

    /// Immediate learn — the user explicitly kept the typed word by tapping
    /// the verbatim slot.
    func learnNow(_ word: String) {
        guard loaded else { return }
        let key = word.lowercased()
        guard Self.isLearnable(key) else { return }
        if store.words[key] != nil {
            bump(key)
            return
        }
        evictIfNeeded()
        store.words[key] = Entry(c: Self.learnAfterCommits, t: Self.now())
        markMutated()
    }

    /// Records a committed word pair for next-word prediction. Call with
    /// vetted words only (both known to the dictionary or lexicon) so typos
    /// never become predictions.
    func observeBigram(previous: String, word: String) {
        guard loaded else { return }
        let prev = previous.lowercased()
        let next = word.lowercased()
        // Unlike learned words, a 1-char prev is fine ("i think", "a coffee").
        guard (1...32).contains(prev.count),
              prev.allSatisfy({ ($0.isLetter && $0.isASCII) || $0 == "'" }),
              Self.isLearnable(next) else { return }
        let key = prev + " " + next
        if var entry = store.bigrams[key] {
            entry.c += 1
            entry.t = Self.now()
            store.bigrams[key] = entry
        } else {
            if store.bigrams.count >= Self.maxBigrams {
                let now = Self.now()
                let victim = store.bigrams.min { a, b in
                    Self.retentionScore(a.value, now: now)
                        < Self.retentionScore(b.value, now: now)
                }
                if let victim {
                    store.bigrams.removeValue(forKey: victim.key)
                }
            }
            store.bigrams[key] = Entry(c: 1, t: Self.now())
        }
        markMutated()
    }

    /// The user backspaced an autocorrect: never auto-apply this exact pair
    /// again (it stays available as a tappable suggestion).
    func recordRevert(typed: String, corrected: String) {
        guard loaded else { return }
        if store.blacklist.count >= Self.maxBlacklist {
            // FIFO by timestamp.
            if let oldest = store.blacklist.min(by: { $0.value < $1.value }) {
                store.blacklist.removeValue(forKey: oldest.key)
            }
        }
        store.blacklist[Self.pairKey(typed, corrected)] = Self.now()
        markMutated()
    }

    // MARK: - Internals

    private func bump(_ key: String) {
        guard var entry = store.words[key] else { return }
        entry.c += 1
        entry.t = Self.now()
        store.words[key] = entry
        markMutated()
    }

    /// Recency-weighted eviction: drop the entry with the lowest
    /// `count * exp(-ageDays / 90)` once the cap is reached.
    private func evictIfNeeded() {
        guard store.words.count >= Self.maxWords else { return }
        let now = Self.now()
        let victim = store.words.min { a, b in
            Self.retentionScore(a.value, now: now) <
                Self.retentionScore(b.value, now: now)
        }
        if let victim {
            store.words.removeValue(forKey: victim.key)
        }
    }

    private static func retentionScore(_ entry: Entry, now: TimeInterval) -> Double {
        let ageDays = max(0, now - entry.t) / 86_400
        return Double(entry.c) * exp(-ageDays / 90)
    }

    private static func isLearnable(_ key: String) -> Bool {
        guard key.count >= 2, key.count <= 32 else { return false }
        return key.allSatisfy { ($0.isLetter && $0.isASCII) || $0 == "'" }
    }

    private static func pairKey(_ typed: String, _ corrected: String) -> String {
        typed.lowercased() + "\u{2192}" + corrected.lowercased()
    }

    private static func now() -> TimeInterval {
        Date().timeIntervalSince1970
    }
}
