package com.a1lab.echos.ime

import android.content.Context
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/**
 * On-device correction/completion engine over the bundled "ECHD" dictionary
 * binary (compiled by `scripts/keyboard-dictionary/build.js` from an
 * 82k-word frequency lexicon + bigrams + contractions, shipped in assets/).
 *
 * The search is a weighted Damerau-Levenshtein DP over a path-compressed
 * trie, with QWERTY-adjacency substitution costs, prefix completions,
 * apostrophe restoration (cant → can't), word splits (alot → "a lot",
 * imnot → "I'm not"), bigram context boosts, and the user's learned lexicon.
 *
 * `scripts/keyboard-dictionary/decoder.js` is the reference implementation —
 * the algorithm, tuning constants, and gates here mirror it 1:1 (jest golden
 * vectors pin its behavior). `CorrectionEngine.swift` is the iOS twin. Keep
 * all three in sync.
 *
 * Unlike iOS there is no system fallback lexicon here, so this engine also
 * closes the OEM gap where no system spell checker exists at all.
 */
class CorrectionEngine(private val userLexicon: UserLexicon) {

    // -- Tuning (mirror of decoder.js TUNING) --

    private object Tuning {
        const val SUB_ADJACENT = 0.6f
        const val SUB_OTHER = 1.0f
        const val SUB_TOUCH_MIN = 0.35f
        const val SUB_TOUCH_BASE = 0.25f
        const val SUB_TOUCH_PER_UNIT = 0.55f
        const val SUB_TOUCH_DEAD_ZONE = 0.4f
        const val INSERT_DUPLICATE = 0.5f
        const val INSERT_OTHER = 1.0f
        const val DELETION_DUPLICATE = 0.5f
        const val DELETION = 0.9f
        const val TRANSPOSITION = 0.5f
        const val FIRST_LETTER_SURCHARGE = 0.5f
        const val APOSTROPHE_RESTORE = 0.15f
        const val WORD_SPLIT = 0.45f
        const val COMPLETION_PER_CHAR = 0.2f
        const val COMPLETION_CAP = 0.9f
        const val AUTOCORRECT_MAX_COMPLETION_EXTRA = 2
        const val AUTOCORRECT_COMPLETION_MIN_TYPED = 5
        const val AUTOCORRECT_MAX_SCORE_GAP = 0.25f
        const val SHORT_TYPED_MAX_EDIT_COST = 0.9f
        const val FREQ_WEIGHT = 0.35f
        const val BIGRAM_WEIGHT = 0.4f
        const val MAX_CANDIDATES = 3
        const val MAX_COMPLETIONS = 8
        const val CONFIDENCE_COMMON = 0.6f
        const val CONFIDENCE_RARE = 0.72f
        const val CONFIDENCE_BIGRAM_BONUS = 0.08f
        const val COMMON_FREQ_FLOOR = 64
        const val EPSILON = 1e-6f
        const val PREDICTION_FALLBACK_SCAN = 16
    }

    private object Format {
        const val HEADER_SIZE = 64
        const val NODE_SIZE = 16
        const val LEAF = -1 // 0xFFFFFFFF as signed Int
        const val NON_TERMINAL_WORD_ID = 0xFFFFFF
        const val FLAG_TERMINAL = 0x01
        const val FLAG_NEVER_CORRECT_TO = 0x02
        const val FLAG_PROPER_NOUN = 0x04
        const val MAX_TYPED_LENGTH = 32
        const val ASSET_NAME = "keyboard_dictionary.echd"
    }

    /** Contractions whose typed form is ALSO a valid word (its, ill, id,
     *  lets). Auto-applied only when sentence-initial AND typed with a
     *  leading capital ("Its way" -> "It's way") — the capitalization comes
     *  from auto-cap, so this naturally limits to sentence starts, where the
     *  contraction reading dominates. Mid-sentence lowercase "its"/"ill"
     *  stay untouched. Mirrors decoder.js AMBIGUOUS_SENTENCE_INITIAL. */
    private val ambiguousSentenceInitial = mapOf(
        "its" to "It's",
        "ill" to "I'll",
        "id" to "I'd",
        "lets" to "Let's",
    )

    /** Curated sentence-openers shown when there is no previous word (empty
     *  field or just after sentence-terminal punctuation). Lowercase; the
     *  caller applies sentence casing. Mirrors decoder.js SENTENCE_STARTERS. */
    private val sentenceStarters = listOf("i", "the", "you", "it", "we", "thanks", "hey")

    /** A key tap in normalized key-grid units (key width = 1.0), matching
     *  `KeyAdjacency.center`. Fed per typed character to refine substitution
     *  costs; mirrors decoder.js `touchPoints`. */
    data class TouchPoint(val x: Float, val y: Float)

    data class Evaluation(
        val candidates: List<String>,
        val topIsCorrection: Boolean,
        /** The typed word, set only when a correction is pending — feeds the
         *  strip's quoted "keep what I typed" slot. */
        val verbatim: String?,
        /** The word autocorrect-on-separator should apply. May differ from
         *  `candidates[0]`: the strip can lead with a speculative completion
         *  ("wichita") while the safe correction ("which") is what commits. */
        val replacement: String?,
    ) {
        companion object {
            val EMPTY = Evaluation(emptyList(), false, null, null)
        }
    }

    private class Candidate(
        val word: ByteArray,
        val editCost: Float,
        val freq: Int,
        val flags: Int,
        val completionExtra: Int = 0,
        /** null = not a split; false = split without corpus evidence
         *  (tap-only); true = evidenced or contraction split. */
        val splitHasBigram: Boolean? = null,
    ) {
        var bigramFreq: Int = 0
        var score: Float = 0f
        val wordString: String by lazy { String(word, Charsets.UTF_8) }
    }

    // -- State --

    @Volatile
    var isLoaded: Boolean = false
        private set

    private lateinit var bytes: ByteArray
    private var nodesOffset = 0
    private var labelsOffset = 0
    private var topStringsOffset = 0
    private var topStringsCount = 0
    private var bigramsOffset = 0
    private var bigramCount = 0
    private var contractions: Map<String, String> = emptyMap()

    /** Context-aware confusable entries parsed from bundled `confusables.json`
     *  (ill -> I'll etc.), keyed by the lowercase plain word. */
    private class Confusable(val contraction: String, val next: Set<String>)
    private var confusables: Map<String, Confusable> = emptyMap()

    // -- Loading --

    /** Loads and validates the bundled binary. Call off the main thread;
     *  until it finishes [isLoaded] stays false and the router falls back to
     *  the system checker. */
    fun load(context: Context) {
        try {
            val data = context.assets.open(Format.ASSET_NAME).use { it.readBytes() }
            if (data.size < Format.HEADER_SIZE) return
            if (data[0] != 'E'.code.toByte() || data[1] != 'C'.code.toByte() ||
                data[2] != 'H'.code.toByte() || data[3] != 'D'.code.toByte()
            ) {
                return
            }
            if (readU16(data, 4) != 1) return

            nodesOffset = readU32(data, 16)
            labelsOffset = readU32(data, 20)
            topStringsOffset = readU32(data, 28)
            topStringsCount = readU32(data, 32)
            bigramsOffset = readU32(data, 36)
            bigramCount = readU32(data, 40)
            val contractionsOffset = readU32(data, 44)
            val contractionCount = readU32(data, 48)
            if (contractionsOffset + contractionCount * 6 > data.size) return

            val map = HashMap<String, String>()
            val poolStart = contractionsOffset + contractionCount * 6
            for (i in 0 until contractionCount) {
                val off = contractionsOffset + i * 6
                val typedOffset = readU16(data, off)
                val typedLen = data[off + 2].toInt() and 0xFF
                val replOffset = readU16(data, off + 3)
                val replLen = data[off + 5].toInt() and 0xFF
                val typed = String(data, poolStart + typedOffset, typedLen, Charsets.UTF_8)
                val repl = String(data, poolStart + replOffset, replLen, Charsets.UTF_8)
                map[typed] = repl
            }

            confusables = loadConfusables(context)
            bytes = data
            contractions = map
            isLoaded = true
        } catch (_: Exception) {
            // Missing/corrupt asset: engine stays unloaded, checker fallback runs.
        }
    }

    /** Parses the bundled confusables table. Independent of the dictionary — a
     *  missing/invalid file just leaves the feature off. */
    private fun loadConfusables(context: Context): Map<String, Confusable> {
        return try {
            val text = context.assets.open("confusables.json").use {
                it.readBytes().toString(Charsets.UTF_8)
            }
            val json = org.json.JSONObject(text)
            val map = HashMap<String, Confusable>()
            for (key in json.keys()) {
                if (key.startsWith("_")) continue
                val entry = json.optJSONObject(key) ?: continue
                val contraction = entry.optString("contraction", "")
                val nextArr = entry.optJSONArray("next") ?: continue
                if (contraction.isEmpty()) continue
                val next = HashSet<String>()
                for (i in 0 until nextArr.length()) {
                    next.add(nextArr.getString(i).lowercase())
                }
                map[key.lowercase()] = Confusable(contraction, next)
            }
            map
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun readU16(data: ByteArray, offset: Int): Int =
        (data[offset].toInt() and 0xFF) or ((data[offset + 1].toInt() and 0xFF) shl 8)

    private fun readU32(data: ByteArray, offset: Int): Int =
        (data[offset].toInt() and 0xFF) or
            ((data[offset + 1].toInt() and 0xFF) shl 8) or
            ((data[offset + 2].toInt() and 0xFF) shl 16) or
            ((data[offset + 3].toInt() and 0xFF) shl 24)

    private fun readU24(offset: Int): Int =
        (bytes[offset].toInt() and 0xFF) or
            ((bytes[offset + 1].toInt() and 0xFF) shl 8) or
            ((bytes[offset + 2].toInt() and 0xFF) shl 16)

    // -- Public API --

    companion object {
        /** Normalizes a typed token for lookup: lowercase, smart apostrophe → '. */
        fun normalize(word: String): String =
            word.lowercase().replace('’', '\'')
    }

    /** True when the exact (lowercased) word is in the bundled dictionary. */
    fun contains(word: String): Boolean {
        if (!isLoaded) return false
        val typed = asciiBytes(normalize(word)) ?: return false
        return findTerminal(typed) >= 0
    }

    /** Context-aware confusable correction (retroactive). Mirrors decoder.js
     *  `contextualContraction`: returns the contraction the previous word
     *  should become given the word that just followed it, or null to leave
     *  it. Fires only for a lowercase plain word whose follower is in its
     *  trigger set and whose pair isn't blacklisted. */
    fun contextualContraction(prevWordRaw: String, nextWord: String): String? {
        if (!isLoaded || prevWordRaw.isEmpty() || nextWord.isEmpty()) return null
        val plain = prevWordRaw.lowercase()
        if (prevWordRaw != plain) return null
        val entry = confusables[plain] ?: return null
        if (!entry.next.contains(nextWord.lowercase())) return null
        if (userLexicon.isBlacklisted(plain, entry.contraction.lowercase())) return null
        return entry.contraction
    }

    /** Top continuations of [prevWord] — the next-word prediction strip shown
     *  right after a separator. Pairs the user actually types (learned in
     *  [UserLexicon]) lead; the static bigram table fills the rest. Proper
     *  nouns render title-case. */
    fun nextWords(prevWord: String, limit: Int = Tuning.MAX_CANDIDATES): List<String> {
        if (!isLoaded) return emptyList()
        val normalizedPrev = normalize(prevWord)
        val prev = if (normalizedPrev.isEmpty()) null else asciiBytes(normalizedPrev)
        val results = ArrayList<String>(limit)
        val seen = HashSet<String>()
        if (normalizedPrev.isNotEmpty()) seen.add(normalizedPrev.lowercase())
        fun add(word: String) {
            if (results.size >= limit) return
            val key = word.lowercase()
            if (key in seen || (key.length < 2 && key != "i")) return
            seen.add(key)
            results.add(word)
        }
        if (prev != null) {
            for (word in userLexicon.nextWords(normalizedPrev)) add(renderStored(word))
            for ((nextId, _) in bigramRun(prev)) topString(nextId)?.let { add(renderStored(it)) }
        } else {
            // No context (sentence start): curated openers.
            for (starter in sentenceStarters) add(renderStored(starter))
        }
        // Fill remaining slots from the frequency-ranked word list so the strip
        // is never left half-empty.
        var id = 0
        while (results.size < limit && id < Tuning.PREDICTION_FALLBACK_SCAN) {
            topString(id)?.let { add(renderStored(it)) }
            id++
        }
        return results.take(limit)
    }

    /** Renders a dictionary-stored (lowercase) word for display: proper nouns
     *  (France, Monday, Google) get title case. */
    private fun renderStored(word: String): String {
        if (word.contains(' ')) return word
        val bytes = asciiBytes(word) ?: return word
        val node = findTerminal(bytes)
        if (node < 0) return word
        if (nodeFlags(nodePacked(node)) and Format.FLAG_PROPER_NOUN == 0) return word
        return word.replaceFirstChar { it.uppercase() }
    }

    /** Title-case form of [word] when the dictionary flags it a proper noun,
     *  else null. */
    private fun properNounForm(word: String): String? {
        val typed = asciiBytes(word) ?: return null
        val node = findTerminal(typed)
        if (node < 0) return null
        if (nodeFlags(nodePacked(node)) and Format.FLAG_PROPER_NOUN == 0) return null
        return word.replaceFirstChar { it.uppercase() }
    }

    /** Proper nouns render title-case; split candidates (contain a space)
     *  keep their per-half casing. */
    private fun renderCandidate(word: String, flags: Int): String {
        if (flags and Format.FLAG_PROPER_NOUN == 0 || word.contains(' ')) return word
        return word.replaceFirstChar { it.uppercase() }
    }

    /**
     * Full evaluation of the in-progress word: display candidates plus the
     * autocorrect verdict. [externallyValid] is the platform veto slot (the
     * user lexicon is consulted internally; Android has no always-present
     * system lexicon to veto with, so callers normally pass false).
     */
    fun evaluate(
        typedRaw: String,
        previousWord: String?,
        externallyValid: Boolean = false,
        touchPoints: List<TouchPoint?>? = null,
    ): Evaluation {
        if (!isLoaded) return Evaluation.EMPTY
        val typedString = normalize(typedRaw)
        if (typedString.isEmpty() || typedString.length > Format.MAX_TYPED_LENGTH) {
            return Evaluation.EMPTY
        }
        if (typedString.any { it.isDigit() }) return Evaluation.EMPTY
        val typed = asciiBytes(typedString) ?: return Evaluation.EMPTY

        // The sole one-character correction: standalone lowercase "i" becomes
        // "I" (mid-sentence, where auto-cap can't help).
        if (typedRaw == "i" && !userLexicon.isBlacklisted("i", "i")) {
            return Evaluation(
                candidates = listOf("I"),
                topIsCorrection = true,
                verbatim = typedRaw,
                replacement = "I",
            )
        }

        val ambiguous = ambiguousSentenceInitial[typedString]
        if (ambiguous != null && previousWord == null &&
            typedRaw == typedString.replaceFirstChar { it.uppercase() } &&
            !userLexicon.isBlacklisted(typedString, ambiguous)
        ) {
            return Evaluation(
                candidates = listOf(ambiguous),
                topIsCorrection = true,
                verbatim = typedRaw,
                replacement = ambiguous,
            )
        }

        val contraction = contractions[typedString]
        if (contraction != null &&
            !userLexicon.isBlacklisted(typedString, contraction)
        ) {
            return Evaluation(
                candidates = listOf(contraction),
                topIsCorrection = true,
                verbatim = typedRaw,
                replacement = contraction,
            )
        }

        // Proper nouns typed all-lowercase self-correct to title case
        // (france -> France), like native iOS.
        if (typedRaw == typedString &&
            !userLexicon.isBlacklisted(typedString, typedString)
        ) {
            val properForm = properNounForm(typedString)
            if (properForm != null) {
                return Evaluation(
                    candidates = listOf(properForm),
                    topIsCorrection = true,
                    verbatim = typedRaw,
                    replacement = properForm,
                )
            }
        }

        val merged = HashMap<String, Candidate>()
        fun add(list: List<Candidate>) {
            for (c in list) {
                val existing = merged[c.wordString]
                if (existing == null || c.editCost < existing.editCost) {
                    merged[c.wordString] = c
                }
            }
        }
        add(fuzzyMatches(typed, touchPoints))
        add(apostropheVariants(typed))
        add(properNounPossessives(typed))
        add(wordSplits(typed))
        if (typed.size >= 2) add(completions(typed))
        add(userLexiconCandidates(typed))

        // Profanity ("never correct to") is offered only when typed exactly.
        val kept = merged.values.filter {
            it.editCost == 0f || (it.flags and Format.FLAG_NEVER_CORRECT_TO) == 0
        }
        val bigramFreqs = HashMap<Int, Int>()
        previousWord?.let { asciiBytes(normalize(it)) }?.let { prev ->
            for ((nextId, freq) in bigramRun(prev)) {
                bigramFreqs[nextId] = freq
            }
        }
        for (c in kept) {
            terminalWordId(c.word)?.let { wordId ->
                c.bigramFreq = bigramFreqs[wordId] ?: 0
            }
            c.score = -c.editCost +
                Tuning.FREQ_WEIGHT * c.freq / 255f +
                Tuning.BIGRAM_WEIGHT * c.bigramFreq / 255f
        }

        val scored = kept
            .filter { it.wordString != typedString }
            .sortedWith(
                compareByDescending<Candidate> { it.score }.thenBy { it.wordString },
            )

        val display = scored.take(Tuning.MAX_CANDIDATES).map {
            renderCandidate(it.wordString, it.flags)
        }

        // Autocorrect considers the best candidate that is safe to apply
        // blindly — see decoder.js `evaluate` for the rule-by-rule rationale.
        val topScore = scored.firstOrNull()?.score ?: 0f
        val acTop = scored.firstOrNull { c ->
            if (topScore - c.score > Tuning.AUTOCORRECT_MAX_SCORE_GAP) return@firstOrNull false
            if (c.completionExtra > Tuning.AUTOCORRECT_MAX_COMPLETION_EXTRA) return@firstOrNull false
            if (c.completionExtra > 0 &&
                (c.freq < Tuning.COMMON_FREQ_FLOOR ||
                    typed.size < Tuning.AUTOCORRECT_COMPLETION_MIN_TYPED)
            ) {
                return@firstOrNull false
            }
            if (c.splitHasBigram == false) return@firstOrNull false
            if (typed.size <= 4 && c.editCost > Tuning.SHORT_TYPED_MAX_EDIT_COST) {
                return@firstOrNull false
            }
            true
        }

        val isAllCapsAcronym = typedRaw.length <= 5 &&
            typedRaw == typedRaw.uppercase() &&
            typedRaw.any { it.isUpperCase() }
        val typedIsKnown = contains(typedString) ||
            userLexicon.contains(typedString) ||
            externallyValid

        var topIsCorrection = false
        var replacement: String? = null
        if (acTop != null && !typedIsKnown && typedString.length > 1 &&
            !isAllCapsAcronym && !typedString.contains('-')
        ) {
            val acWord = acTop.wordString
            val shortTypedRareTop =
                typedString.length <= 3 && acTop.freq < Tuning.COMMON_FREQ_FLOOR
            if (!shortTypedRareTop &&
                !userLexicon.isBlacklisted(typedString, acWord)
            ) {
                val denom = max(typedString.length, acWord.length).toFloat()
                val confidence = 1f - acTop.editCost / denom
                var threshold = if (acTop.freq >= Tuning.COMMON_FREQ_FLOOR) {
                    Tuning.CONFIDENCE_COMMON
                } else {
                    Tuning.CONFIDENCE_RARE
                }
                if (acTop.bigramFreq > 0) threshold -= Tuning.CONFIDENCE_BIGRAM_BONUS
                if (confidence >= threshold) {
                    topIsCorrection = true
                    replacement = renderCandidate(acWord, acTop.flags)
                }
            }
        }

        return Evaluation(
            candidates = display,
            topIsCorrection = topIsCorrection,
            verbatim = if (topIsCorrection) typedRaw else null,
            replacement = replacement,
        )
    }

    // -- Trie primitives --

    private fun nodeFirstChild(index: Int): Int =
        readU32(bytes, nodesOffset + index * Format.NODE_SIZE)

    private fun nodeLabelOffset(index: Int): Int =
        labelsOffset + readU32(bytes, nodesOffset + index * Format.NODE_SIZE + 4)

    private fun nodeLabelLen(index: Int): Int =
        bytes[nodesOffset + index * Format.NODE_SIZE + 12].toInt() and 0xFF

    private fun nodePacked(index: Int): Int =
        readU32(bytes, nodesOffset + index * Format.NODE_SIZE + 8)

    private fun nodeChildCount(index: Int): Int =
        bytes[nodesOffset + index * Format.NODE_SIZE + 13].toInt() and 0xFF

    private fun nodeFreq(index: Int): Int =
        bytes[nodesOffset + index * Format.NODE_SIZE + 14].toInt() and 0xFF

    private fun nodeMaxSubtreeFreq(index: Int): Int =
        bytes[nodesOffset + index * Format.NODE_SIZE + 15].toInt() and 0xFF

    private fun nodeIsTerminal(packed: Int): Boolean =
        (packed ushr 24) and Format.FLAG_TERMINAL != 0

    private fun nodeFlags(packed: Int): Int = (packed ushr 24) and 0xFF

    /** Walks [word] through the trie. Returns (nodeIndex, labelRestOffset,
     *  labelRestLength), or null when the word diverges from every path. */
    private fun walk(word: ByteArray): Triple<Int, Int, Int>? {
        var index = 0
        var pos = 0
        while (true) {
            if (pos == word.size) return Triple(index, 0, 0)
            val firstChild = nodeFirstChild(index)
            if (firstChild == Format.LEAF) return null
            var childIndex = -1
            for (c in 0 until nodeChildCount(index)) {
                val candidate = firstChild + c
                if (bytes[nodeLabelOffset(candidate)] == word[pos]) {
                    childIndex = candidate
                    break
                }
            }
            if (childIndex < 0) return null
            val labelOffset = nodeLabelOffset(childIndex)
            val labelLength = nodeLabelLen(childIndex)
            var k = 0
            while (k < labelLength && pos + k < word.size &&
                bytes[labelOffset + k] == word[pos + k]
            ) {
                k++
            }
            if (pos + k == word.size) {
                return Triple(childIndex, labelOffset + k, labelLength - k)
            }
            if (k < labelLength) return null
            index = childIndex
            pos += k
        }
    }

    /** Exact lookup; returns the terminal node index or -1. */
    private fun findTerminal(word: ByteArray): Int {
        val hit = walk(word) ?: return -1
        if (hit.third != 0) return -1
        return if (nodeIsTerminal(nodePacked(hit.first))) hit.first else -1
    }

    private fun terminalWordId(word: ByteArray): Int? {
        // Split candidates contain a space and can never be trie words.
        if (word.contains(' '.code.toByte())) return null
        val node = findTerminal(word)
        if (node < 0) return null
        val id = nodePacked(node) and Format.NON_TERMINAL_WORD_ID
        return if (id == Format.NON_TERMINAL_WORD_ID) null else id
    }

    private fun topString(id: Int): String? {
        if (id >= topStringsCount) return null
        val base = topStringsOffset
        val poolStart = base + 4 * (topStringsCount + 1)
        val start = readU32(bytes, base + 4 * id)
        val end = readU32(bytes, base + 4 * (id + 1))
        return String(bytes, poolStart + start, end - start, Charsets.UTF_8)
    }

    private fun bigramRun(prevWord: ByteArray): List<Pair<Int, Int>> {
        val prevId = terminalWordId(prevWord) ?: return emptyList()
        var lo = 0
        var hi = bigramCount
        while (lo < hi) {
            val mid = (lo + hi) / 2
            if (readU24(bigramsOffset + mid * 8) < prevId) lo = mid + 1 else hi = mid
        }
        val results = ArrayList<Pair<Int, Int>>()
        var i = lo
        while (i < bigramCount) {
            val off = bigramsOffset + i * 8
            if (readU24(off) != prevId) break
            results.add(readU24(off + 3) to (bytes[off + 6].toInt() and 0xFF))
            i++
        }
        return results
    }

    // -- Candidate sources (mirror decoder.js) --

    private fun editBudget(typedLength: Int): Float = when {
        typedLength <= 4 -> 1.0f
        typedLength <= 8 -> 2.0f
        else -> 2.5f
    }

    private fun applyFirstLetterSurcharge(
        typed: ByteArray,
        word: ByteArray,
        editCost: Float,
    ): Float {
        if (editCost == 0f || typed[0] == word[0]) return editCost
        val transposedFirstPair = typed.size >= 2 && word.size >= 2 &&
            typed[0] == word[1] && typed[1] == word[0]
        return if (transposedFirstPair) editCost else editCost + Tuning.FIRST_LETTER_SURCHARGE
    }

    /** Substitution cost for consuming candidate byte [c] where the user typed
     *  [t]. With a touch point, cost scales with the tap's distance from [c]'s
     *  key center; without one, falls back to the adjacency graph. [center] is
     *  [c]'s key center; the DP caller resolves it once per candidate byte so
     *  the inner loop over typed positions doesn't repeat the (allocating)
     *  lookup. Mirrors decoder.js `substitutionCost`. */
    private fun substitutionCost(
        t: Byte, c: Byte, touch: TouchPoint?, center: Pair<Float, Float>?
    ): Float {
        if (t == c) return 0f
        if (touch != null && center != null) {
            val dx = touch.x - center.first
            val dy = touch.y - center.second
            val d = kotlin.math.sqrt(dx * dx + dy * dy)
            val cost = Tuning.SUB_TOUCH_BASE +
                Tuning.SUB_TOUCH_PER_UNIT * max(0f, d - Tuning.SUB_TOUCH_DEAD_ZONE)
            return min(Tuning.SUB_OTHER, max(Tuning.SUB_TOUCH_MIN, cost))
        }
        return if (KeyAdjacency.isAdjacent(t, c)) Tuning.SUB_ADJACENT else Tuning.SUB_OTHER
    }

    /** Weighted Damerau-Levenshtein DP over trie descent (see decoder.js
     *  `fuzzyMatches` for the transition-by-transition rationale). */
    private fun fuzzyMatches(
        typed: ByteArray, touchPoints: List<TouchPoint?>? = null
    ): List<Candidate> {
        val n = typed.size
        if (n == 0) return emptyList()
        val budget = editBudget(n)
        // A stale buffer must degrade to the adjacency model, never skew costs
        // against the wrong characters.
        val touches = if (touchPoints?.size == n) touchPoints else null

        fun insertCost(i: Int): Float =
            if (i >= 2 && typed[i - 1] == typed[i - 2]) {
                Tuning.INSERT_DUPLICATE
            } else {
                Tuning.INSERT_OTHER
            }

        val row0 = FloatArray(n + 1)
        for (i in 1..n) row0[i] = row0[i - 1] + insertCost(i)

        val results = ArrayList<Candidate>()
        val rows = ArrayList<FloatArray>().apply { add(row0) }
        val pathChars = ArrayList<Byte>()

        fun dfs(index: Int) {
            val depthBefore = pathChars.size
            val labelOffset = if (index == 0) 0 else nodeLabelOffset(index)
            val labelLength = if (index == 0) 0 else nodeLabelLen(index)
            var pruned = false
            var li = 0
            while (li < labelLength) {
                val c = bytes[labelOffset + li]
                val j = pathChars.size + 1
                val prevRow = rows[j - 1]
                // Omitting a doubled letter (helo -> hello) is as common a
                // typo as inserting one.
                val deleteCost = if (j >= 2 && c == pathChars[j - 2]) {
                    Tuning.DELETION_DUPLICATE
                } else {
                    Tuning.DELETION
                }
                val newRow = FloatArray(n + 1)
                newRow[0] = prevRow[0] + deleteCost
                var rowMin = newRow[0]
                val center = KeyAdjacency.center(c)
                for (i in 1..n) {
                    val t = typed[i - 1]
                    val subCost = substitutionCost(t, c, touches?.get(i - 1), center)
                    var best = minOf(
                        prevRow[i - 1] + subCost,
                        newRow[i - 1] + insertCost(i),
                        prevRow[i] + deleteCost,
                    )
                    if (j >= 2 && i >= 2 && t == pathChars[j - 2] && typed[i - 2] == c) {
                        best = min(best, rows[j - 2][i - 2] + Tuning.TRANSPOSITION)
                    }
                    newRow[i] = best
                    if (best < rowMin) rowMin = best
                }
                rows.add(newRow)
                pathChars.add(c)
                if (rowMin > budget + Tuning.EPSILON) {
                    pruned = true
                    break
                }
                li++
            }
            if (!pruned) {
                val packed = nodePacked(index)
                if (nodeIsTerminal(packed) && pathChars.isNotEmpty()) {
                    val word = pathChars.toByteArray()
                    val editCost = applyFirstLetterSurcharge(
                        typed, word, rows[rows.size - 1][n],
                    )
                    if (editCost <= budget + Tuning.EPSILON) {
                        results.add(
                            Candidate(word, editCost, nodeFreq(index), nodeFlags(packed)),
                        )
                    }
                }
                val firstChild = nodeFirstChild(index)
                if (firstChild != Format.LEAF) {
                    for (c in 0 until nodeChildCount(index)) {
                        dfs(firstChild + c)
                    }
                }
            }
            while (rows.size > depthBefore + 1) rows.removeAt(rows.size - 1)
            while (pathChars.size > depthBefore) pathChars.removeAt(pathChars.size - 1)
        }
        dfs(0)
        return results
    }

    /** Exact-prefix completions, best-first over `maxSubtreeFreq`. */
    private fun completions(typed: ByteArray): List<Candidate> {
        val hit = walk(typed) ?: return emptyList()
        val results = ArrayList<Candidate>()
        val queue = ArrayList<Pair<Int, ByteArray>>()
        if (hit.third > 0) {
            queue.add(hit.first to bytes.copyOfRange(hit.second, hit.second + hit.third))
        } else {
            val firstChild = nodeFirstChild(hit.first)
            if (firstChild != Format.LEAF) {
                for (c in 0 until nodeChildCount(hit.first)) {
                    val child = firstChild + c
                    val off = nodeLabelOffset(child)
                    queue.add(child to bytes.copyOfRange(off, off + nodeLabelLen(child)))
                }
            }
        }
        while (queue.isNotEmpty() && results.size < Tuning.MAX_COMPLETIONS) {
            // Best-first: pop the entry whose subtree holds the highest
            // frequency (ties by node index for determinism).
            var bestAt = 0
            for (i in 1 until queue.size) {
                val fa = nodeMaxSubtreeFreq(queue[i].first)
                val fb = nodeMaxSubtreeFreq(queue[bestAt].first)
                if (fa > fb || (fa == fb && queue[i].first < queue[bestAt].first)) {
                    bestAt = i
                }
            }
            val (index, suffix) = queue.removeAt(bestAt)
            val packed = nodePacked(index)
            if (nodeIsTerminal(packed) && suffix.isNotEmpty()) {
                val penalty = min(
                    Tuning.COMPLETION_CAP,
                    Tuning.COMPLETION_PER_CHAR * suffix.size,
                )
                results.add(
                    Candidate(
                        typed + suffix,
                        penalty,
                        nodeFreq(index),
                        nodeFlags(packed),
                        completionExtra = suffix.size,
                    ),
                )
            }
            val firstChild = nodeFirstChild(index)
            if (firstChild != Format.LEAF) {
                for (c in 0 until nodeChildCount(index)) {
                    val child = firstChild + c
                    val off = nodeLabelOffset(child)
                    queue.add(
                        child to (suffix + bytes.copyOfRange(off, off + nodeLabelLen(child))),
                    )
                }
            }
        }
        return results
    }

    /** Proper-noun possessive restoration: johns → "John's". Mirrors
     *  decoder.js `properNounPossessives`. */
    private fun properNounPossessives(typed: ByteArray): List<Candidate> {
        val apostrophe = '\''.code.toByte()
        val sByte = 's'.code.toByte()
        if (typed.size < 3 || typed.last() != sByte || typed.contains(apostrophe)) {
            return emptyList()
        }
        if (findTerminal(typed) >= 0) return emptyList()
        val base = typed.copyOfRange(0, typed.size - 1)
        val node = findTerminal(base)
        if (node < 0) return emptyList()
        val flags = nodeFlags(nodePacked(node))
        if (flags and Format.FLAG_PROPER_NOUN == 0) return emptyList()
        val word = ByteArray(base.size + 2)
        base.copyInto(word)
        word[base.size] = apostrophe
        word[base.size + 1] = sByte
        return listOf(Candidate(word, Tuning.APOSTROPHE_RESTORE, nodeFreq(node), flags))
    }

    /** Apostrophe restoration: cant → can't (len-1 exact probes). */
    private fun apostropheVariants(typed: ByteArray): List<Candidate> {
        val apostrophe = '\''.code.toByte()
        if (typed.contains(apostrophe)) return emptyList()
        val results = ArrayList<Candidate>()
        for (i in 1 until typed.size) {
            val variant = ByteArray(typed.size + 1)
            typed.copyInto(variant, 0, 0, i)
            variant[i] = apostrophe
            typed.copyInto(variant, i + 1, i)
            val node = findTerminal(variant)
            if (node >= 0) {
                results.add(
                    Candidate(
                        variant,
                        Tuning.APOSTROPHE_RESTORE,
                        nodeFreq(node),
                        nodeFlags(nodePacked(node)),
                    ),
                )
            }
        }
        return results
    }

    /** Missing-space restoration: alot → "a lot", imnot → "I'm not". */
    private fun wordSplits(typed: ByteArray): List<Candidate> {
        if (typed.size < 3 ||
            typed.contains('\''.code.toByte()) ||
            typed.contains('-'.code.toByte())
        ) {
            return emptyList()
        }
        val typedIsValid = findTerminal(typed) >= 0
        val results = ArrayList<Candidate>()
        for (i in 1 until typed.size) {
            val leftBytes = typed.copyOfRange(0, i)
            val rightBytes = typed.copyOfRange(i, typed.size)
            val leftString = String(leftBytes, Charsets.UTF_8)
            val rightString = String(rightBytes, Charsets.UTF_8)
            val leftContraction = contractions[leftString]
            val rightContraction = contractions[rightString]
            val leftNode = findTerminal(leftBytes)
            val rightNode = findTerminal(rightBytes)
            val leftFreq = if (leftNode >= 0) nodeFreq(leftNode) else null
            val rightFreq = if (rightNode >= 0) nodeFreq(rightNode) else null
            if (leftContraction == null &&
                (leftFreq == null || leftFreq < Tuning.COMMON_FREQ_FLOOR)
            ) {
                continue
            }
            if (rightContraction == null &&
                (rightFreq == null || rightFreq < Tuning.COMMON_FREQ_FLOOR)
            ) {
                continue
            }
            val contractionHalf = leftContraction != null || rightContraction != null
            var hasBigram = false
            if (!contractionHalf && rightNode >= 0) {
                val rightId = nodePacked(rightNode) and Format.NON_TERMINAL_WORD_ID
                hasBigram = bigramRun(leftBytes).any { it.first == rightId }
            }
            if (typedIsValid && !hasBigram) continue
            fun renderHalf(word: String, contraction: String?): String =
                contraction ?: if (word == "i") "I" else word
            val rendered = renderHalf(leftString, leftContraction) + " " +
                renderHalf(rightString, rightContraction)
            results.add(
                Candidate(
                    rendered.toByteArray(Charsets.UTF_8),
                    Tuning.WORD_SPLIT,
                    min(leftFreq ?: 255, rightFreq ?: 255),
                    (if (leftNode >= 0) nodeFlags(nodePacked(leftNode)) else 0) or
                        (if (rightNode >= 0) nodeFlags(nodePacked(rightNode)) else 0),
                    // Contraction splits are self-evident; plain splits need
                    // corpus evidence before autocorrect may apply them.
                    splitHasBigram = contractionHalf || hasBigram,
                ),
            )
        }
        return results
    }

    /** Learned-word candidates: plain weighted DL against the (small) user
     *  lexicon plus prefix completions. Native-only extension of the
     *  reference (the jest suite models the lexicon via its vetoes instead). */
    private fun userLexiconCandidates(typed: ByteArray): List<Candidate> {
        val n = typed.size
        if (n == 0) return emptyList()
        val budget = editBudget(n)
        val results = ArrayList<Candidate>()
        for (word in userLexicon.allWords()) {
            val target = asciiBytes(word) ?: continue
            val freq = userLexicon.freqQ(word) ?: continue
            if (target.size > n && startsWith(target, typed)) {
                val extra = target.size - n
                results.add(
                    Candidate(
                        target,
                        min(Tuning.COMPLETION_CAP, Tuning.COMPLETION_PER_CHAR * extra),
                        freq,
                        0,
                        completionExtra = extra,
                    ),
                )
                continue
            }
            if (abs(target.size - n) > 2) continue
            val cost = weightedDistance(typed, target, budget)
            if (cost <= budget + Tuning.EPSILON) {
                val surcharged = applyFirstLetterSurcharge(typed, target, cost)
                if (surcharged <= budget + Tuning.EPSILON) {
                    results.add(Candidate(target, surcharged, freq, 0))
                }
            }
        }
        return results
    }

    private fun startsWith(target: ByteArray, prefix: ByteArray): Boolean {
        if (prefix.size > target.size) return false
        for (i in prefix.indices) {
            if (target[i] != prefix[i]) return false
        }
        return true
    }

    /** Plain two-word weighted Damerau-Levenshtein with the same costs as the
     *  trie DP; used only for the user lexicon. */
    private fun weightedDistance(typed: ByteArray, target: ByteArray, budget: Float): Float {
        val n = typed.size
        fun insertCost(i: Int): Float =
            if (i >= 2 && typed[i - 1] == typed[i - 2]) {
                Tuning.INSERT_DUPLICATE
            } else {
                Tuning.INSERT_OTHER
            }
        val rows = ArrayList<FloatArray>()
        val row0 = FloatArray(n + 1)
        for (i in 1..n) row0[i] = row0[i - 1] + insertCost(i)
        rows.add(row0)
        for (j in 1..target.size) {
            val c = target[j - 1]
            val deleteCost = if (j >= 2 && c == target[j - 2]) {
                Tuning.DELETION_DUPLICATE
            } else {
                Tuning.DELETION
            }
            val row = FloatArray(n + 1)
            row[0] = rows[j - 1][0] + deleteCost
            var rowMin = row[0]
            for (i in 1..n) {
                val t = typed[i - 1]
                val subCost = when {
                    t == c -> 0f
                    KeyAdjacency.isAdjacent(t, c) -> Tuning.SUB_ADJACENT
                    else -> Tuning.SUB_OTHER
                }
                var best = minOf(
                    rows[j - 1][i - 1] + subCost,
                    row[i - 1] + insertCost(i),
                    rows[j - 1][i] + deleteCost,
                )
                if (j >= 2 && i >= 2 && t == target[j - 2] && typed[i - 2] == c) {
                    best = min(best, rows[j - 2][i - 2] + Tuning.TRANSPOSITION)
                }
                row[i] = best
                if (best < rowMin) rowMin = best
            }
            if (rowMin > budget + Tuning.EPSILON) return Float.POSITIVE_INFINITY
            rows.add(row)
        }
        return rows[target.size][n]
    }

    /** ASCII bytes of a normalized word, or null when it contains characters
     *  outside the dictionary alphabet (the engine then abstains). */
    private fun asciiBytes(word: String): ByteArray? {
        if (word.isEmpty()) return null
        val out = ByteArray(word.length)
        for (i in word.indices) {
            val code = word[i].code
            if (code >= 128) return null
            out[i] = code.toByte()
        }
        return out
    }
}
