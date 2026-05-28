package com.a1lab.echos.ime

import android.text.InputType
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection

/**
 * Walks the text before the cursor to decide whether the next typed
 * character should be auto-capitalized. Mirrors LatinIME's
 * `CapsModeUtils` simple-mode walk: skip opening punctuation → walk
 * over spaces → if we hit a sentence terminator (or start-of-input /
 * newline) it's a sentence boundary, so capitalize. Otherwise lowercase.
 *
 * Does not implement the abbreviation state machine — start with the
 * simple rule, which covers ~95% of cases.
 */
object AutoCapEngine {

    enum class Decision { CAPITALIZE, LOWERCASE, DISABLED }

    private const val CONTEXT_WINDOW = 1024

    /**
     * Reads the host's [InputConnection] and the current [EditorInfo] to
     * decide whether the next typed character should be capitalized.
     * Returns `DISABLED` when the host field opts out of auto-cap.
     */
    fun decide(ic: InputConnection?, editorInfo: EditorInfo?): Decision {
        if (ic == null) return Decision.DISABLED

        val variation = editorInfo?.inputType?.and(InputType.TYPE_MASK_VARIATION) ?: 0
        val klass = editorInfo?.inputType?.and(InputType.TYPE_MASK_CLASS) ?: 0
        if (klass != InputType.TYPE_CLASS_TEXT) return Decision.DISABLED

        // Variations where the host wants no auto-cap.
        when (variation) {
            InputType.TYPE_TEXT_VARIATION_URI,
            InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS,
            InputType.TYPE_TEXT_VARIATION_PASSWORD,
            InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD,
            InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD,
            InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS,
            InputType.TYPE_TEXT_VARIATION_FILTER -> return Decision.DISABLED
        }

        val flags = editorInfo?.inputType ?: 0
        val capCharacters = (flags and InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS) != 0
        if (capCharacters) return Decision.CAPITALIZE
        val wantsCap = (
            (flags and InputType.TYPE_TEXT_FLAG_CAP_SENTENCES) != 0 ||
                (flags and InputType.TYPE_TEXT_FLAG_CAP_WORDS) != 0
        )
        // When the field doesn't request any auto-cap, leave it alone —
        // matches how stock Android keyboards behave on raw text fields.
        if (!wantsCap) return Decision.DISABLED

        val before = ic.getTextBeforeCursor(CONTEXT_WINDOW, 0)?.toString().orEmpty()
        return decide(before)
    }

    /** Lifted out for direct unit testing. */
    fun decide(textBeforeCursor: String): Decision {
        if (textBeforeCursor.isEmpty()) return Decision.CAPITALIZE

        val chars = textBeforeCursor.takeLast(CONTEXT_WINDOW)
        var idx = chars.length - 1

        // 1. Skip trailing opening-punctuation runs.
        while (idx >= 0 && SpacingAndPunctuations.isOpeningPunctuation(chars[idx])) {
            idx--
        }

        if (idx < 0) return Decision.CAPITALIZE
        if (!chars[idx].isWhitespace()) return Decision.LOWERCASE

        // Walk back across the whitespace run.
        var sawNewline = false
        while (idx >= 0 && chars[idx].isWhitespace()) {
            if (chars[idx] == '\n') sawNewline = true
            idx--
        }
        if (sawNewline) return Decision.CAPITALIZE
        if (idx < 0) return Decision.CAPITALIZE

        return if (SpacingAndPunctuations.isSentenceTerminator(chars[idx])) {
            Decision.CAPITALIZE
        } else {
            Decision.LOWERCASE
        }
    }
}
