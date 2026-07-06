package com.a1lab.echos.ime

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.textservice.SentenceSuggestionsInfo
import android.view.textservice.SpellCheckerSession
import android.view.textservice.SuggestionsInfo
import android.view.textservice.TextInfo
import android.view.textservice.TextServicesManager
import java.util.Locale

/**
 * On-device word suggestions (§5.5). English routes through the bundled
 * [CorrectionEngine] (frequency-ranked lexicon, fat-finger edit distance,
 * contractions, splits, bigram context, learned words) — synchronous, always
 * available, and independent of any system spell checker, which closes the
 * OEM gap where `newSpellCheckerSession` returns null (HyperOS etc.).
 *
 * Non-English device locales keep the original [SpellCheckerSession] path:
 * async fire-and-forget requests whose results arrive on a binder thread and
 * are hopped to the main thread before invoking [onResults]. Stale results
 * (superseded by a newer keystroke) are dropped via the echoed sequence id.
 *
 * The keyboard keeps a commit-based text model (no `setComposingText`), so the
 * "current word" is the trailing run of non-separator characters read from the
 * committed text before the cursor — see [currentWordBefore]. This keeps
 * auto-cap and double-space→period working unchanged.
 */
class SuggestionEngine(
    context: Context,
    private val correctionEngine: CorrectionEngine,
    private val onResults: (word: String, result: Result) -> Unit,
) : SpellCheckerSession.SpellCheckerSessionListener {

    /**
     * One lookup's result. [topIsCorrection] is true when the typed word
     * looks like a typo and [replacement] is safe for autocorrect on a
     * separator. [verbatim] (the typed word) is set only in that case and
     * feeds the strip's quoted "keep what I typed" slot.
     */
    data class Result(
        val candidates: List<String>,
        val topIsCorrection: Boolean,
        val verbatim: String?,
        val replacement: String?,
    ) {
        companion object {
            val EMPTY = Result(emptyList(), false, null, null)
        }
    }

    companion object {
        private const val TAG = "EchosSuggest"
        private const val MAX_CANDIDATES = 3
        private const val MAX_WORD_LENGTH = 32

        /**
         * The in-progress word: the trailing run of non-separator characters
         * immediately before the cursor. Empty when the cursor sits after a
         * separator (idle), when the token carries a digit, or when it is
         * unreasonably long. The mid-word guard (cursor inside a word) lives in
         * the caller, which has the after-cursor context.
         */
        fun currentWordBefore(textBeforeCursor: String): String {
            val sb = StringBuilder()
            var idx = textBeforeCursor.length - 1
            while (idx >= 0 && !SpacingAndPunctuations.isWordSeparator(textBeforeCursor[idx])) {
                sb.append(textBeforeCursor[idx])
                idx--
            }
            val word = sb.reverse().toString()
            if (word.isEmpty() || word.length > MAX_WORD_LENGTH) return ""
            if (word.any { it.isDigit() }) return ""
            return word
        }

        /**
         * The committed word before the in-progress one — bigram context for
         * ranking and next-word prediction. Returns null when sentence
         * punctuation (not a plain space) separates them.
         */
        fun previousWordBefore(textBeforeCursor: String, currentWord: String): String? {
            var end = textBeforeCursor.length
            if (currentWord.isNotEmpty() && textBeforeCursor.endsWith(currentWord)) {
                end -= currentWord.length
            }
            while (end > 0 && SpacingAndPunctuations.isWordSeparator(textBeforeCursor[end - 1])) {
                if (textBeforeCursor[end - 1] != ' ') return null
                end--
            }
            var start = end
            while (start > 0 && !SpacingAndPunctuations.isWordSeparator(textBeforeCursor[start - 1])) {
                start--
            }
            val word = textBeforeCursor.substring(start, end)
            return word.ifEmpty { null }
        }

        /**
         * Cases [candidate] to mirror [typed]'s pattern: ALL-CAPS when the
         * typed word is all upper (and longer than one letter), Title when it
         * leads with a capital, otherwise the dictionary form. More robust than
         * reading the shift state, which may have already dropped to OFF after
         * the first letter.
         */
        fun matchCase(typed: String, candidate: String): String {
            if (typed.isEmpty() || candidate.isEmpty()) return candidate
            val letters = typed.filter { it.isLetter() }
            if (letters.length > 1 && letters.all { it.isUpperCase() }) {
                return candidate.uppercase()
            }
            if (typed[0].isUpperCase()) {
                return candidate.replaceFirstChar { it.uppercase() }
            }
            return candidate
        }
    }

    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())

    private var session: SpellCheckerSession? = null
    private var currentLocale: Locale? = null

    // Written on the main thread (requests originate there), read on the binder
    // thread in the result callbacks — mark volatile for visibility.
    @Volatile private var requestSeq: Int = 0
    @Volatile private var latestWord: String = ""

    /** English + loaded dictionary → the bundled engine serves lookups;
     *  everything else uses the system spell checker (when one exists). */
    val usesBundledEngine: Boolean
        get() = correctionEngine.isLoaded &&
            (currentLocale ?: Locale.getDefault()).language == "en"

    /**
     * Prepares lookups for [locale]. With the bundled engine active no
     * spell-checker session is needed; otherwise creates (or recreates) one.
     * A null session then means no system spell checker is enabled — requests
     * no-op and the strip stays empty (the caller nudges the user once).
     */
    fun start(locale: Locale) {
        val localeChanged = currentLocale != locale
        currentLocale = locale
        if (correctionEngine.isLoaded && locale.language == "en") {
            close(keepLocale = true)
            return
        }
        // Reuse a live session only for the same locale; a locale switch must
        // tear down the stale session and recreate it for the new one.
        if (session != null && !localeChanged) return
        close(keepLocale = true)
        val tsm = appContext.getSystemService(Context.TEXT_SERVICES_MANAGER_SERVICE)
            as? TextServicesManager
        if (tsm == null) {
            Log.w(TAG, "start($locale): TextServicesManager unavailable — suggestions disabled")
            return
        }
        // referToSpellCheckerLanguageSettings = true: the locale is a hint; the
        // user's configured spell-checker locale wins.
        session = tsm.newSpellCheckerSession(null, locale, this, true)
        if (session == null) {
            Log.w(
                TAG,
                "start($locale): newSpellCheckerSession returned null — " +
                    "no system spell checker is enabled (Settings → System → " +
                    "Languages → Spell checker). Suggestions/autocorrect disabled.",
            )
        } else {
            Log.i(TAG, "start($locale): spell-checker session created")
        }
    }

    fun close(keepLocale: Boolean = false) {
        session?.close()
        session = null
        if (!keepLocale) currentLocale = null
    }

    /**
     * Synchronous lookup via the bundled engine — used directly on the
     * space/punctuation commit path so the autocorrect decision can never be
     * stale. Returns [Result.EMPTY] when the engine doesn't serve this locale.
     */
    fun lookupNow(word: String, previousWord: String?): Result {
        if (!usesBundledEngine || word.isEmpty()) return Result.EMPTY
        val evaluation = correctionEngine.evaluate(word, previousWord)
        return Result(
            candidates = evaluation.candidates.map { matchCase(word, it) },
            topIsCorrection = evaluation.topIsCorrection,
            verbatim = evaluation.verbatim,
            replacement = evaluation.replacement?.let { matchCase(word, it) },
        )
    }

    /** Next-word prediction for an empty composing word (§5.12): top bigram
     *  continuations of the word just committed. */
    fun predictions(previousWord: String): List<String> {
        if (!usesBundledEngine) return emptyList()
        return correctionEngine.nextWords(previousWord)
    }

    /**
     * Issues a lookup for [word]; the result arrives via [onResults] on the
     * main thread — synchronously (bundled engine) or async (system checker).
     * Caller is expected to debounce.
     */
    fun request(word: String, previousWord: String?) {
        if (word.isEmpty()) return
        if (usesBundledEngine) {
            onResults(word, lookupNow(word, previousWord))
            return
        }
        val s = session ?: return
        requestSeq += 1
        latestWord = word
        s.getSentenceSuggestions(arrayOf(TextInfo(word, 0, requestSeq)), MAX_CANDIDATES)
    }

    /**
     * True when lookups can produce results: the bundled engine serves this
     * locale, or a system spell-checker session is live. False only on
     * non-English devices without any system checker — the caller uses this
     * to nudge the user toward enabling one.
     */
    fun isReady(): Boolean = usesBundledEngine || session != null

    override fun onGetSentenceSuggestions(results: Array<out SentenceSuggestionsInfo>?) {
        if (results == null) return
        val seq = requestSeq
        val word = latestWord
        for (sentence in results) {
            for (i in 0 until sentence.suggestionsCount) {
                val info = sentence.getSuggestionsInfoAt(i) ?: continue
                if (info.sequence != seq) continue
                deliver(word, parse(info, word))
                return
            }
        }
    }

    override fun onGetSuggestions(results: Array<out SuggestionsInfo>?) {
        if (results == null) return
        val seq = requestSeq
        val word = latestWord
        val info = results.firstOrNull { it.sequence == seq } ?: return
        deliver(word, parse(info, word))
    }

    private fun parse(info: SuggestionsInfo, word: String): Result {
        val looksLikeTypo =
            (info.suggestionsAttributes and SuggestionsInfo.RESULT_ATTR_LOOKS_LIKE_TYPO) != 0
        val typedKey = word.lowercase()
        val seen = HashSet<String>()
        val out = ArrayList<String>(MAX_CANDIDATES)
        for (i in 0 until info.suggestionsCount) {
            val suggestion = info.getSuggestionAt(i) ?: continue
            val key = suggestion.lowercase()
            if (key == typedKey || key in seen) continue
            seen.add(key)
            out.add(matchCase(word, suggestion))
            if (out.size == MAX_CANDIDATES) break
        }
        val topIsCorrection = looksLikeTypo && out.isNotEmpty()
        return Result(
            candidates = out,
            topIsCorrection = topIsCorrection,
            verbatim = if (topIsCorrection) word else null,
            replacement = if (topIsCorrection) out.first() else null,
        )
    }

    private fun deliver(word: String, result: Result) {
        mainHandler.post {
            // Drop if a newer request superseded this word while in flight.
            if (word != latestWord) return@post
            onResults(word, result)
        }
    }
}
