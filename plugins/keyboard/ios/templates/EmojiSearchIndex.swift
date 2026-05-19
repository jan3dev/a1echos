import Foundation

// Keyword sources: (1) Unicode scalar names via Unicode.Scalar.Properties.name
// — exhaustive and locale-stable; (2) `manualKeywords` for colloquial terms
// the Unicode names miss ("happy" for 😀, "love" for ❤️). Substring scan over
// a few hundred entries; no trie / scoring crate.
struct EmojiSearchIndex {

    private struct Entry {
        let emoji: String
        let keywords: [String]
    }

    private let entries: [Entry]

    init() {
        var built: [Entry] = []
        var seen = Set<String>()
        for cat in EmojiCategory.allCases where cat != .recents {
            for emoji in EmojiData.emojis(for: cat) {
                guard seen.insert(emoji).inserted else { continue }
                let unicode = EmojiSearchIndex.unicodeKeywords(for: emoji)
                let manual = EmojiSearchIndex.manualKeywords[emoji] ?? []
                let combined = Array(Set(unicode + manual))
                built.append(Entry(emoji: emoji, keywords: combined))
            }
        }
        self.entries = built
    }

    func search(_ query: String) -> [String] {
        let q = query
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return [] }
        var matches: [String] = []
        matches.reserveCapacity(min(entries.count, 60))
        for entry in entries {
            for kw in entry.keywords where kw.contains(q) {
                matches.append(entry.emoji)
                break
            }
        }
        return matches
    }

    // Variation selectors / ZWJ have no scalar name and are skipped silently.
    private static func unicodeKeywords(for emoji: String) -> [String] {
        var words = Set<String>()
        for scalar in emoji.unicodeScalars {
            guard let name = scalar.properties.name else { continue }
            for word in name.lowercased().split(separator: " ") {
                words.insert(String(word))
            }
        }
        return Array(words)
    }

    private static let manualKeywords: [String: [String]] = [
        "😀": ["happy", "smile", "grin", "joy"],
        "😃": ["happy", "smile", "open"],
        "😄": ["happy", "smile", "joy"],
        "😁": ["happy", "smile", "beam", "teeth"],
        "😆": ["laugh", "smile", "happy", "haha"],
        "😅": ["sweat", "smile", "phew", "relief"],
        "🤣": ["laugh", "rofl", "rolling", "haha"],
        "😂": ["laugh", "tears", "joy", "haha", "cry"],
        "🙂": ["smile", "slight"],
        "🙃": ["upside", "down", "silly"],
        "😉": ["wink"],
        "😊": ["happy", "smile", "blush"],
        "😍": ["love", "heart", "eyes"],
        "🥰": ["love", "hearts", "happy"],
        "😘": ["kiss", "love"],
        "😎": ["cool", "sunglasses"],
        "🤔": ["think", "hmm", "thinking"],
        "😢": ["cry", "sad", "tear"],
        "😭": ["cry", "sob", "sad"],
        "😡": ["angry", "mad", "rage"],
        "🥺": ["plead", "puppy", "begging"],
        "😴": ["sleep", "zzz", "tired"],
        "😱": ["scream", "shock", "fear"],
        "😮": ["wow", "shock", "surprise"],
        "🤯": ["mind", "blown", "wow"],
        "👍": ["thumbs", "up", "yes", "like", "ok"],
        "👎": ["thumbs", "down", "no", "dislike"],
        "👏": ["clap", "applause"],
        "🙏": ["pray", "thanks", "please"],
        "❤️": ["love", "heart", "red"],
        "💔": ["heartbreak", "sad", "broken"],
        "💯": ["100", "hundred", "perfect"],
        "🔥": ["fire", "lit", "hot"],
        "✨": ["sparkle", "shine", "magic"],
        "🐶": ["dog", "puppy"],
        "🐱": ["cat", "kitten"],
        "🦊": ["fox"],
        "🐼": ["panda"],
        "🦁": ["lion"],
        "🐸": ["frog"],
        "🍕": ["pizza"],
        "🍔": ["burger", "hamburger"],
        "🍟": ["fries", "chips"],
        "🌮": ["taco"],
        "🍣": ["sushi"],
        "☕️": ["coffee", "drink"],
        "🍺": ["beer"],
        "🎉": ["party", "celebrate"],
        "🎂": ["birthday", "cake"],
        "💩": ["poop", "shit"],
        "👀": ["eyes", "look"],
    ]
}
