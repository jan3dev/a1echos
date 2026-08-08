package com.a1lab.echos.ime

/**
 * Long-press variants for letter and symbol keys. Mirrors the iOS keyboard's
 * `AccentVariants` + `PunctuationVariants` tables (KeyboardLayout.swift) so
 * both platforms expose the same alternates. Keep the two in sync — the sets
 * are a superset of the stock English layout, extended toward the
 * international Latin diacritics the system surfaces once additional
 * Latin-script languages are enabled (e.g. `t` -> `ț ť ŧ ţ`).
 */
object AccentVariants {

    private val accentMap: Map<Char, List<String>> = mapOf(
        'a' to listOf("à", "á", "â", "ä", "æ", "ã", "å", "ā", "ą", "ǎ", "ă"),
        'b' to listOf("ḃ"),
        'c' to listOf("ç", "ć", "č", "ċ", "ĉ"),
        'd' to listOf("ð", "đ", "ď", "ḋ"),
        'e' to listOf("è", "é", "ê", "ë", "ē", "ė", "ę", "ě", "ĕ", "ẽ"),
        'g' to listOf("ğ", "ĝ", "ġ", "ģ"),
        'h' to listOf("ĥ", "ħ", "ḣ"),
        'i' to listOf("î", "ï", "í", "ī", "į", "ì", "ĩ", "ǐ", "ı"),
        'j' to listOf("ĵ"),
        'k' to listOf("ķ", "ĸ"),
        'l' to listOf("ł", "ĺ", "ļ", "ľ", "ŀ"),
        'n' to listOf("ñ", "ń", "ņ", "ň", "ŋ"),
        'o' to listOf("ô", "ö", "ò", "ó", "œ", "ø", "ō", "õ", "ő", "ǒ"),
        'r' to listOf("ŕ", "ř", "ŗ"),
        's' to listOf("ß", "ś", "š", "ş", "ŝ", "ș"),
        't' to listOf("ț", "ť", "ŧ", "ţ", "þ"),
        'u' to listOf("û", "ü", "ù", "ú", "ū", "ũ", "ů", "ű", "ų", "ǔ"),
        'w' to listOf("ŵ", "ẁ", "ẃ", "ẅ"),
        'y' to listOf("ÿ", "ý", "ŷ", "ỳ"),
        'z' to listOf("ž", "ź", "ż"),
    )

    /**
     * Punctuation/symbol popovers on the numbers and symbols pages. Unlike
     * [accentMap] each set already leads with the pressed key itself, so a
     * no-drag release re-types it — and unlike letters they never take the
     * paired number or the uppercase mapping. The period key is deliberately
     * absent: it is a `PERIOD` key with the richer LatinIME set below.
     */
    private val symbolMap: Map<String, List<String>> = mapOf(
        "?" to listOf("?", "¿"),
        "!" to listOf("!", "¡"),
        "'" to listOf("'", "‘", "`"),
        "\"" to listOf("\"", "”", "“", "„", "»", "«"),
        "&" to listOf("&", "§"),
        "£" to listOf("£", "€", "$", "¥", "₩", "₽", "¢"),
        "/" to listOf("/", "\\"),
        "-" to listOf("-", "–", "—", "•"),
        "0" to listOf("0", "°"),
        "%" to listOf("%", "‰"),
        "=" to listOf("=", "≠", "≈"),
    )

    /**
     * Top-row letters → number paired with each key. Long-pressing the key
     * surfaces this number alongside any accent variants, matching the
     * Gboard convention where holding `q` types `1`.
     */
    private val topRowNumbers: Map<Char, String> = mapOf(
        'q' to "1", 'w' to "2", 'e' to "3", 'r' to "4", 't' to "5",
        'y' to "6", 'u' to "7", 'i' to "8", 'o' to "9", 'p' to "0",
    )

    /**
     * Punctuation marks surfaced when long-pressing the period key (LatinIME
     * period `moreKeys`). "." is first so a no-drag release re-types a period.
     */
    private val periodPunctuation: List<String> =
        listOf(".", ",", "?", "!", "'", "\"", ":", ";", "-", "(", ")", "/")

    fun punctuationForPeriod(): List<String> = periodPunctuation

    /**
     * Number associated with a top-row letter, or null. Used by the keyboard
     * view to draw the small secondary label in the corner of the key.
     */
    fun numberFor(character: String): String? {
        val first = character.lowercase().firstOrNull() ?: return null
        return topRowNumbers[first]
    }

    /**
     * Returns the variants surfaced when the key is long-pressed. Symbol keys
     * return their set verbatim; letter keys return the paired number (if
     * any) first, then the original character, then the accent variants.
     * Default selection is index 0 (so a long-press + release on a top-row
     * letter inserts the number, like Gboard).
     */
    fun variants(character: String, uppercase: Boolean): List<String> {
        symbolMap[character]?.let { return it }
        val first = character.lowercase().firstOrNull() ?: return emptyList()
        val number = topRowNumbers[first]
        val accents = accentMap[first].orEmpty()
        if (number == null && accents.isEmpty()) return emptyList()
        val list = buildList {
            if (number != null) add(number)
            add(first.toString())
            addAll(accents)
        }
        return if (uppercase) list.map { it.uppercase() } else list
    }

    fun hasVariants(character: String): Boolean {
        if (symbolMap.containsKey(character)) return true
        val first = character.lowercase().firstOrNull() ?: return false
        return topRowNumbers.containsKey(first) || accentMap.containsKey(first)
    }
}
