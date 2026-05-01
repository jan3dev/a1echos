package com.a1lab.echos.ime

/**
 * Accent variants surfaced when the user long-presses a letter key. Mirrors
 * the iOS keyboard's `AccentVariants` table so both platforms expose the
 * same alternates for the English layout.
 */
object AccentVariants {

    private val accentMap: Map<Char, List<String>> = mapOf(
        'a' to listOf("à", "á", "â", "ä", "æ", "ã", "å", "ā"),
        'c' to listOf("ç", "ć", "č"),
        'e' to listOf("è", "é", "ê", "ë", "ē", "ė", "ę"),
        'i' to listOf("î", "ï", "í", "ī", "į", "ì"),
        'l' to listOf("ł"),
        'n' to listOf("ñ", "ń"),
        'o' to listOf("ô", "ö", "ò", "ó", "œ", "ø", "ō", "õ"),
        's' to listOf("ß", "ś", "š"),
        'u' to listOf("û", "ü", "ù", "ú", "ū"),
        'y' to listOf("ÿ"),
        'z' to listOf("ž", "ź", "ż"),
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
     * Number associated with a top-row letter, or null. Used by the keyboard
     * view to draw the small secondary label in the corner of the key.
     */
    fun numberFor(character: String): String? {
        val first = character.lowercase().firstOrNull() ?: return null
        return topRowNumbers[first]
    }

    /**
     * Returns the variants surfaced when the key is long-pressed, in order:
     * the paired number (if any) first, then the original character, then
     * the accent variants. Default selection is index 0 (so a long-press +
     * release on a top-row letter inserts the number, like Gboard).
     */
    fun variants(character: String, uppercase: Boolean): List<String> {
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
        val first = character.lowercase().firstOrNull() ?: return false
        return topRowNumbers.containsKey(first) || accentMap.containsKey(first)
    }
}
