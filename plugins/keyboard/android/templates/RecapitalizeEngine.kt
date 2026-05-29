package com.a1lab.echos.ime

/**
 * Case rotation for the selection-recapitalize gesture (§4.7): tapping shift
 * while text is selected cycles all-lower -> Title Case -> ALL-UPPER. Stateless
 * — the host's live selection carries the rotation, since Android re-selects
 * the replaced text after each step.
 */
object RecapitalizeEngine {

    /** The next case form for [text], or null when it has no letters to recase. */
    fun nextCase(text: String): String? {
        if (text.none { it.isLetter() }) return null
        val lower = text.lowercase()
        val upper = text.uppercase()
        val title = titleCase(text)
        // Order matters: a single uppercase letter equals its own title form,
        // so test against upper before title.
        return when (text) {
            upper -> lower
            title -> upper
            lower -> title
            else -> lower // mixed case (or untouched original) starts at lower
        }
    }

    /** First letter of each whitespace-delimited word uppercased, rest lower. */
    private fun titleCase(text: String): String {
        val sb = StringBuilder(text.length)
        var atWordStart = true
        for (ch in text) {
            if (ch.isLetter()) {
                sb.append(if (atWordStart) ch.uppercase() else ch.lowercase())
                atWordStart = false
            } else {
                sb.append(ch)
                atWordStart = ch.isWhitespace()
            }
        }
        return sb.toString()
    }
}
