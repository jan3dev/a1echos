package com.a1lab.echos.ime

/**
 * Shared character classes that feed auto-capitalization, smart
 * double-space-to-period, recapitalize, and (later) smart punctuation.
 * Mirrors AOSP LatinIME's `SpacingAndPunctuations` so the heuristics
 * downstream can be ported one-for-one.
 */
object SpacingAndPunctuations {

    /** Ends a sentence and triggers auto-cap on the following word. */
    val SENTENCE_TERMINATORS: Set<Char> = setOf('.', '?', '!')

    /** Char committed by the smart-double-space helper. */
    const val SENTENCE_SEPARATOR: Char = '.'

    /** Splits a word in two. */
    val WORD_SEPARATORS: Set<Char> = setOf(
        ' ', '\t', '\n',
        '(', ')', '[', ']', '{', '}',
        '*', '&', '<', '>', '+', '=', '|',
        '.', ',', ';', ':', '!', '?', '/', '_', '"',
    )

    /** Opens a quoted/parenthetical fragment; auto-cap skips over these. */
    val OPENING_PUNCTUATION: Set<Char> = setOf(
        '(', '[', '{', '"', '\'', '<',
    )

    /** Blocks smart double-space-to-period when preceding the trailing space. */
    val PUNCTUATION_EXCLUDED_FROM_DOUBLE_SPACE: Set<Char> = setOf(
        ',', ';', ':', '!', '?', '.', '-', '_',
    )

    /** Symbols (besides letters/digits) that may precede the replaced space. */
    val DOUBLE_SPACE_PERIOD_ALLOWED_PRECEDING_CHARS: Set<Char> = setOf(
        '\'', '"', ')', ']', '}', '>', '+', '%',
    )

    fun isSentenceTerminator(c: Char): Boolean = c in SENTENCE_TERMINATORS

    fun isWordSeparator(c: Char): Boolean = c in WORD_SEPARATORS

    fun isOpeningPunctuation(c: Char): Boolean = c in OPENING_PUNCTUATION

    /**
     * True when smart double-space-to-period is allowed to fire on top of
     * `previousChar`. Excludes the punctuation listed above; accepts
     * letters/digits, the explicit allowed set, and Unicode "Other Symbol"
     * (emoji and the like).
     */
    fun allowsDoubleSpacePeriod(previousChar: Char): Boolean {
        if (previousChar in PUNCTUATION_EXCLUDED_FROM_DOUBLE_SPACE) return false
        if (previousChar.isLetterOrDigit()) return true
        if (previousChar in DOUBLE_SPACE_PERIOD_ALLOWED_PRECEDING_CHARS) return true
        if (Character.getType(previousChar) == Character.OTHER_SYMBOL.toInt()) return true
        return false
    }
}
