package com.a1lab.echos.ime

import android.content.Context
import java.io.File
import kotlin.math.exp
import kotlin.math.min
import org.json.JSONObject

/**
 * The keyboard's learned vocabulary (§5.11): words the user actually types
 * ("figma", "sats", teammate names) plus a blacklist of autocorrects the user
 * reverted, so the same wrong fix is never auto-applied twice. Persisted as
 * JSON in the app's files directory (same channel as keyboard-settings.json).
 *
 * Learning rules (mirrored by `UserLexicon.swift`):
 *  - an unknown word committed with a separator twice is learned,
 *  - tapping the verbatim strip slot learns immediately,
 *  - reverting an autocorrect blacklists that exact typed→corrected pair.
 */
class UserLexicon(baseDir: File) {

    constructor(context: Context) : this(context.applicationContext.filesDir)

    companion object {
        const val MAX_WORDS = 5000
        const val MAX_BLACKLIST = 500
        const val MAX_BIGRAMS = 2000
        private const val LEARN_AFTER_COMMITS = 2
        private const val FLUSH_AFTER_MUTATIONS = 20
        private const val FILENAME = "keyboard-user-lexicon.json"

        private fun isLearnable(key: String): Boolean {
            if (key.length < 2 || key.length > 32) return false
            return key.all { (it in 'a'..'z') || it == '\'' }
        }

        private fun isBigramHalf(key: String): Boolean {
            // Unlike learned words, a 1-char prev is fine ("i think").
            if (key.isEmpty() || key.length > 32) return false
            return key.all { (it in 'a'..'z') || it == '\'' }
        }
    }

    private data class Entry(var count: Int, var lastUsed: Long)

    private val file = File(baseDir, FILENAME)
    private val words = HashMap<String, Entry>()
    private val blacklist = HashMap<String, Long>()

    /** Word pairs the user actually types, keyed "prev next" — feeds
     *  next-word prediction ahead of the static bigram table. */
    private val bigrams = HashMap<String, Entry>()

    /** Unknown words seen once; promoted into [words] on the second commit.
     *  In-memory only — a word must prove itself within one session. */
    private val pendingWords = HashMap<String, Int>()
    private var mutationsSinceFlush = 0
    @Volatile
    private var loaded = false

    // -- Persistence --

    /** Called off the main thread at engine init. A missing or unparseable
     *  file starts fresh — learned words are a cache, never precious. */
    fun load() {
        try {
            if (file.exists()) {
                val json = JSONObject(file.readText(Charsets.UTF_8))
                val wordsJson = json.optJSONObject("words") ?: JSONObject()
                for (key in wordsJson.keys()) {
                    val entry = wordsJson.optJSONObject(key) ?: continue
                    words[key] = Entry(entry.optInt("c", 1), entry.optLong("t", 0L))
                }
                val blacklistJson = json.optJSONObject("blacklist") ?: JSONObject()
                for (key in blacklistJson.keys()) {
                    blacklist[key] = blacklistJson.optLong(key, 0L)
                }
                val bigramsJson = json.optJSONObject("bigrams") ?: JSONObject()
                for (key in bigramsJson.keys()) {
                    val entry = bigramsJson.optJSONObject(key) ?: continue
                    bigrams[key] = Entry(entry.optInt("c", 1), entry.optLong("t", 0L))
                }
            }
        } catch (_: Exception) {
            words.clear()
            blacklist.clear()
            bigrams.clear()
        }
        loaded = true
    }

    /** Writes synchronously; callers flush from `onFinishInputView` or after
     *  a burst of mutations, never on the keystroke path. */
    fun flush() {
        if (!loaded || mutationsSinceFlush == 0) return
        mutationsSinceFlush = 0
        try {
            val wordsJson = JSONObject()
            for ((key, entry) in words) {
                wordsJson.put(
                    key,
                    JSONObject().put("c", entry.count).put("t", entry.lastUsed),
                )
            }
            val blacklistJson = JSONObject()
            for ((key, time) in blacklist) {
                blacklistJson.put(key, time)
            }
            val bigramsJson = JSONObject()
            for ((key, entry) in bigrams) {
                bigramsJson.put(
                    key,
                    JSONObject().put("c", entry.count).put("t", entry.lastUsed),
                )
            }
            val root = JSONObject()
                .put("version", 1)
                .put("words", wordsJson)
                .put("blacklist", blacklistJson)
                .put("bigrams", bigramsJson)
            val tmp = File(file.parentFile, "$FILENAME.tmp")
            tmp.writeText(root.toString(), Charsets.UTF_8)
            tmp.renameTo(file)
        } catch (_: Exception) {
            // Learned words are best-effort; never crash the keyboard.
        }
    }

    private fun markMutated() {
        mutationsSinceFlush += 1
        if (mutationsSinceFlush >= FLUSH_AFTER_MUTATIONS) flush()
    }

    // -- Queries --

    fun contains(word: String): Boolean =
        loaded && words.containsKey(word.lowercase())

    /** Candidate weight for a learned word, comparable to the dictionary's
     *  log-quantized byte: starts a bit below common words, grows with use. */
    fun freqQ(word: String): Int? {
        if (!loaded) return null
        val entry = words[word.lowercase()] ?: return null
        return min(255, 96 + 16 * entry.count)
    }

    fun isBlacklisted(typed: String, corrected: String): Boolean =
        loaded && blacklist.containsKey(pairKey(typed, corrected))

    /** All learned words — the correction engine fuzzy-matches against these
     *  alongside the bundled dictionary (≤5000 words, trivially fast). */
    fun allWords(): List<String> = if (loaded) words.keys.toList() else emptyList()

    /** Learned continuations of [previous], most-used first. Linear scan over
     *  ≤2000 entries — trivially fast. */
    fun nextWords(previous: String, limit: Int = 3): List<String> {
        if (!loaded) return emptyList()
        val prefix = previous.lowercase() + " "
        return bigrams.entries
            .filter { it.key.startsWith(prefix) }
            .sortedWith(
                compareByDescending<Map.Entry<String, Entry>> { it.value.count }
                    .thenBy { it.key },
            )
            .take(limit)
            .map { it.key.removePrefix(prefix) }
    }

    /** Records a committed word pair for next-word prediction. Call with
     *  vetted words only (both known to the dictionary or lexicon) so typos
     *  never become predictions. */
    fun observeBigram(previous: String, word: String) {
        if (!loaded) return
        val prev = previous.lowercase()
        val next = word.lowercase()
        if (!isBigramHalf(prev) || !isLearnable(next)) return
        val key = "$prev $next"
        val existing = bigrams[key]
        if (existing != null) {
            existing.count += 1
            existing.lastUsed = now()
        } else {
            if (bigrams.size >= MAX_BIGRAMS) {
                val nowSeconds = now()
                bigrams.minByOrNull { retentionScore(it.value, nowSeconds) }
                    ?.let { bigrams.remove(it.key) }
            }
            bigrams[key] = Entry(1, now())
        }
        markMutated()
    }

    // -- Learning --

    /** Feed every separator-committed word through here. Unknown words are
     *  learned on their second commit; known (dictionary or learned) words
     *  bump their use count so their suggestions strengthen. */
    fun observeCommit(word: String, isInDictionary: Boolean) {
        if (!loaded) return
        val key = word.lowercase()
        if (!isLearnable(key)) return
        if (words.containsKey(key)) {
            bump(key)
            return
        }
        if (isInDictionary) return
        val seen = (pendingWords[key] ?: 0) + 1
        if (seen >= LEARN_AFTER_COMMITS) {
            pendingWords.remove(key)
            learnNow(word)
        } else {
            pendingWords[key] = seen
        }
    }

    /** Immediate learn — the user explicitly kept the typed word by tapping
     *  the verbatim slot. */
    fun learnNow(word: String) {
        if (!loaded) return
        val key = word.lowercase()
        if (!isLearnable(key)) return
        if (words.containsKey(key)) {
            bump(key)
            return
        }
        evictIfNeeded()
        words[key] = Entry(LEARN_AFTER_COMMITS, now())
        markMutated()
    }

    /** The user backspaced an autocorrect: never auto-apply this exact pair
     *  again (it stays available as a tappable suggestion). */
    fun recordRevert(typed: String, corrected: String) {
        if (!loaded) return
        if (blacklist.size >= MAX_BLACKLIST) {
            blacklist.minByOrNull { it.value }?.let { blacklist.remove(it.key) }
        }
        blacklist[pairKey(typed, corrected)] = now()
        markMutated()
    }

    // -- Internals --

    private fun bump(key: String) {
        val entry = words[key] ?: return
        entry.count += 1
        entry.lastUsed = now()
        markMutated()
    }

    /** Recency-weighted eviction: drop the entry with the lowest
     *  `count * exp(-ageDays / 90)` once the cap is reached. */
    private fun evictIfNeeded() {
        if (words.size < MAX_WORDS) return
        val nowSeconds = now()
        words.minByOrNull { retentionScore(it.value, nowSeconds) }
            ?.let { words.remove(it.key) }
    }

    /** Recency-weighted keep score: usage count decayed by age (90-day
     *  half-life-ish). Lowest score is evicted first. */
    private fun retentionScore(entry: Entry, nowSeconds: Long): Double {
        val ageDays = ((nowSeconds - entry.lastUsed).coerceAtLeast(0L)) / 86_400.0
        return entry.count * exp(-ageDays / 90.0)
    }

    private fun pairKey(typed: String, corrected: String): String =
        typed.lowercase() + "→" + corrected.lowercase()

    private fun now(): Long = System.currentTimeMillis() / 1000
}
