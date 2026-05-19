package com.a1lab.echos.ime

import android.content.Context

// Keyword sources: (1) Character.getName for Unicode scalar names; (2)
// `manualKeywords` for colloquial terms ("happy" for 😀, "love" for ❤️).
// Substring scan over a few hundred entries; no trie / scoring library.
class EmojiSearchIndex(context: Context) {

    private data class Entry(
        val emoji: String,
        val keywords: List<String>,
    )

    private val entries: List<Entry>

    init {
        val seen = HashSet<String>()
        val built = mutableListOf<Entry>()
        for (category in EmojiCategory.values()) {
            if (category == EmojiCategory.RECENTS) continue
            for (emoji in EmojiData.emojis(category, context)) {
                if (!seen.add(emoji)) continue
                val unicode = unicodeKeywords(emoji)
                val manual = manualKeywords[emoji].orEmpty()
                built.add(Entry(emoji, (unicode + manual).distinct()))
            }
        }
        entries = built
    }

    fun search(query: String): List<String> {
        val q = query.lowercase().trim()
        if (q.isEmpty()) return emptyList()
        val matches = ArrayList<String>(minOf(entries.size, 60))
        for (entry in entries) {
            for (kw in entry.keywords) {
                if (kw.contains(q)) {
                    matches.add(entry.emoji)
                    break
                }
            }
        }
        return matches
    }

    // Variation selectors / ZWJ have no codepoint name and are skipped silently.
    private fun unicodeKeywords(emoji: String): List<String> {
        val words = HashSet<String>()
        var i = 0
        while (i < emoji.length) {
            val cp = emoji.codePointAt(i)
            val name = try { Character.getName(cp) } catch (_: IllegalArgumentException) { null }
            if (name != null) {
                for (word in name.lowercase().split(' ')) {
                    if (word.isNotEmpty()) words.add(word)
                }
            }
            i += Character.charCount(cp)
        }
        return words.toList()
    }

    companion object {
        private val manualKeywords: Map<String, List<String>> = mapOf(
            "😀" to listOf("happy", "smile", "grin", "joy"),
            "😃" to listOf("happy", "smile", "open"),
            "😄" to listOf("happy", "smile", "joy"),
            "😁" to listOf("happy", "smile", "beam", "teeth"),
            "😆" to listOf("laugh", "smile", "happy", "haha"),
            "😅" to listOf("sweat", "smile", "phew", "relief"),
            "🤣" to listOf("laugh", "rofl", "rolling", "haha"),
            "😂" to listOf("laugh", "tears", "joy", "haha", "cry"),
            "🙂" to listOf("smile", "slight"),
            "🙃" to listOf("upside", "down", "silly"),
            "😉" to listOf("wink"),
            "😊" to listOf("happy", "smile", "blush"),
            "😍" to listOf("love", "heart", "eyes"),
            "🥰" to listOf("love", "hearts", "happy"),
            "😘" to listOf("kiss", "love"),
            "😎" to listOf("cool", "sunglasses"),
            "🤔" to listOf("think", "hmm", "thinking"),
            "😢" to listOf("cry", "sad", "tear"),
            "😭" to listOf("cry", "sob", "sad"),
            "😡" to listOf("angry", "mad", "rage"),
            "🥺" to listOf("plead", "puppy", "begging"),
            "😴" to listOf("sleep", "zzz", "tired"),
            "😱" to listOf("scream", "shock", "fear"),
            "😮" to listOf("wow", "shock", "surprise"),
            "🤯" to listOf("mind", "blown", "wow"),
            "👍" to listOf("thumbs", "up", "yes", "like", "ok"),
            "👎" to listOf("thumbs", "down", "no", "dislike"),
            "👏" to listOf("clap", "applause"),
            "🙏" to listOf("pray", "thanks", "please"),
            "❤️" to listOf("love", "heart", "red"),
            "💔" to listOf("heartbreak", "sad", "broken"),
            "💯" to listOf("100", "hundred", "perfect"),
            "🔥" to listOf("fire", "lit", "hot"),
            "✨" to listOf("sparkle", "shine", "magic"),
            "🐶" to listOf("dog", "puppy"),
            "🐱" to listOf("cat", "kitten"),
            "🦊" to listOf("fox"),
            "🐼" to listOf("panda"),
            "🦁" to listOf("lion"),
            "🐸" to listOf("frog"),
            "🍕" to listOf("pizza"),
            "🍔" to listOf("burger", "hamburger"),
            "🍟" to listOf("fries", "chips"),
            "🌮" to listOf("taco"),
            "🍣" to listOf("sushi"),
            "☕️" to listOf("coffee", "drink"),
            "🍺" to listOf("beer"),
            "🎉" to listOf("party", "celebrate"),
            "🎂" to listOf("birthday", "cake"),
            "💩" to listOf("poop", "shit"),
            "👀" to listOf("eyes", "look"),
        )
    }
}
