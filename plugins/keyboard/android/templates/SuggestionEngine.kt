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
 * On-device word suggestions backed by the Android system spell checker
 * (`SpellCheckerSession`). This is the Phase 3 "smart input" layer (§5.5):
 * offline, no extra permission, no bundled data — spelling completions /
 * corrections only, no prefix-less next-word prediction.
 *
 * The session is ASYNC: requests are fire-and-forget and results arrive on a
 * binder thread via [SpellCheckerSession.SpellCheckerSessionListener]. We hop
 * back to the main thread before invoking [onResults]. Stale results
 * (superseded by a newer keystroke) are dropped by comparing the request
 * sequence the framework echoes back on each `SuggestionsInfo`.
 *
 * The keyboard keeps a commit-based text model (no `setComposingText`), so the
 * "current word" is the trailing run of non-separator characters read from the
 * committed text before the cursor — see [currentWordBefore]. This keeps
 * auto-cap and double-space→period working unchanged.
 *
 * When no spell-checker service is enabled, [newSpellCheckerSession] returns
 * null and every request is a no-op, so the strip simply never appears.
 */
class SuggestionEngine(
    context: Context,
    private val onResults: (word: String, candidates: List<String>, looksLikeTypo: Boolean) -> Unit,
) : SpellCheckerSession.SpellCheckerSessionListener {

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

    /**
     * Creates (or recreates) the session for [locale]. A null session means no
     * spell-checker service is enabled — requests then no-op and the strip
     * stays empty.
     */
    fun start(locale: Locale) {
        if (session != null && currentLocale == locale) return
        close()
        val tsm = appContext.getSystemService(Context.TEXT_SERVICES_MANAGER_SERVICE)
            as? TextServicesManager
        if (tsm == null) {
            Log.w(TAG, "start($locale): TextServicesManager unavailable — suggestions disabled")
            return
        }
        // referToSpellCheckerLanguageSettings = true: the locale is a hint; the
        // user's configured spell-checker locale wins.
        session = tsm.newSpellCheckerSession(null, locale, this, true)
        currentLocale = locale
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

    fun close() {
        session?.close()
        session = null
        currentLocale = null
    }

    /**
     * Issues an async lookup for [word]; the result arrives via [onResults] on
     * the main thread. No-op with no session or an empty word. Caller is
     * expected to debounce.
     */
    fun request(word: String) {
        val s = session ?: return
        if (word.isEmpty()) return
        requestSeq += 1
        latestWord = word
        s.getSentenceSuggestions(arrayOf(TextInfo(word, 0, requestSeq)), MAX_CANDIDATES)
    }

    /**
     * True when a system spell-checker session is live. False means no checker
     * is enabled on the device (common on HyperOS/OEM builds that ship the
     * AOSP spell checker disabled or absent) — every [request] then no-ops and
     * the strip/autocorrect stay empty. The caller uses this to nudge the user
     * toward enabling one. iOS has no equivalent gap (`UITextChecker` is
     * always bundled).
     */
    fun isReady(): Boolean = session != null

    override fun onGetSentenceSuggestions(results: Array<out SentenceSuggestionsInfo>?) {
        if (results == null) return
        val seq = requestSeq
        val word = latestWord
        for (sentence in results) {
            for (i in 0 until sentence.suggestionsCount) {
                val info = sentence.getSuggestionsInfoAt(i) ?: continue
                if (info.sequence != seq) continue
                val (candidates, looksLikeTypo) = parse(info, word)
                deliver(word, candidates, looksLikeTypo)
                return
            }
        }
    }

    override fun onGetSuggestions(results: Array<out SuggestionsInfo>?) {
        if (results == null) return
        val seq = requestSeq
        val word = latestWord
        val info = results.firstOrNull { it.sequence == seq } ?: return
        val (candidates, looksLikeTypo) = parse(info, word)
        deliver(word, candidates, looksLikeTypo)
    }

    private fun parse(info: SuggestionsInfo, word: String): Pair<List<String>, Boolean> {
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
        return out to looksLikeTypo
    }

    private fun deliver(word: String, candidates: List<String>, looksLikeTypo: Boolean) {
        mainHandler.post {
            // Drop if a newer request superseded this word while in flight.
            if (word != latestWord) return@post
            onResults(word, candidates, looksLikeTypo)
        }
    }
}
