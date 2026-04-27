package com.a1lab.echos.ime

/**
 * Defines keyboard key layouts for QWERTY, numbers, and symbols.
 */
object EchosKeyboardLayout {

    enum class KeyType {
        CHARACTER,
        SHIFT,
        DELETE,
        SPACE,
        RETURN,
        MIC,
        MODE_SWITCH,    // 123 / ABC toggle
        GLOBE,          // Switch keyboard
        EMOJI,          // Cycle to next keyboard (emoji if user has one installed)
        SYMBOL_SWITCH,  // #+=  / 123 toggle
        COMMA,
        PERIOD,
    }

    data class Key(
        val label: String,
        val type: KeyType = KeyType.CHARACTER,
        val widthWeight: Float = 1f,
        val contentDescription: String = label,
    )

    data class Row(val keys: List<Key>)

    // -- QWERTY Letter Layout --

    val LETTERS_ROW_1 = Row(
        listOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p").map {
            Key(label = it)
        }
    )

    val LETTERS_ROW_2 = Row(
        listOf("a", "s", "d", "f", "g", "h", "j", "k", "l").map {
            Key(label = it)
        }
    )

    val LETTERS_ROW_3 = Row(
        listOf(
            Key(label = "\u21E7", type = KeyType.SHIFT, widthWeight = 1.5f, contentDescription = "Shift"),
            Key(label = "z"),
            Key(label = "x"),
            Key(label = "c"),
            Key(label = "v"),
            Key(label = "b"),
            Key(label = "n"),
            Key(label = "m"),
            Key(label = "\u232B", type = KeyType.DELETE, widthWeight = 1.5f, contentDescription = "Delete"),
        )
    )

    val LETTERS_ROW_4 = Row(
        listOf(
            Key(label = "123", type = KeyType.MODE_SWITCH, widthWeight = 1.2f, contentDescription = "Numbers"),
            Key(label = "\uD83D\uDE00", type = KeyType.EMOJI, widthWeight = 1f, contentDescription = "Emoji"),
            Key(label = "\uD83C\uDF10", type = KeyType.GLOBE, widthWeight = 1f, contentDescription = "Switch keyboard"),
            Key(label = ",", type = KeyType.COMMA, widthWeight = 1f),
            Key(label = " ", type = KeyType.SPACE, widthWeight = 3f, contentDescription = "Space"),
            Key(label = ".", type = KeyType.PERIOD, widthWeight = 1f),
            Key(label = "\u23CE", type = KeyType.RETURN, widthWeight = 1.2f, contentDescription = "Return"),
        )
    )

    val LETTER_ROWS = listOf(LETTERS_ROW_1, LETTERS_ROW_2, LETTERS_ROW_3, LETTERS_ROW_4)

    // -- Number Layout --

    val NUMBERS_ROW_1 = Row(
        listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0").map {
            Key(label = it)
        }
    )

    val NUMBERS_ROW_2 = Row(
        listOf("-", "/", ":", ";", "(", ")", "$", "&", "@", "\"").map {
            Key(label = it)
        }
    )

    val NUMBERS_ROW_3 = Row(
        listOf(
            Key(label = "#+=", type = KeyType.SYMBOL_SWITCH, widthWeight = 1.5f, contentDescription = "Symbols"),
            Key(label = "."),
            Key(label = ","),
            Key(label = "?"),
            Key(label = "!"),
            Key(label = "'"),
            Key(label = "\u232B", type = KeyType.DELETE, widthWeight = 1.5f, contentDescription = "Delete"),
        )
    )

    val NUMBERS_ROW_4 = Row(
        listOf(
            Key(label = "ABC", type = KeyType.MODE_SWITCH, widthWeight = 1.2f, contentDescription = "Letters"),
            Key(label = "\uD83D\uDE00", type = KeyType.EMOJI, widthWeight = 1f, contentDescription = "Emoji"),
            Key(label = "\uD83C\uDF10", type = KeyType.GLOBE, widthWeight = 1f, contentDescription = "Switch keyboard"),
            Key(label = ",", type = KeyType.COMMA, widthWeight = 1f),
            Key(label = " ", type = KeyType.SPACE, widthWeight = 3f, contentDescription = "Space"),
            Key(label = ".", type = KeyType.PERIOD, widthWeight = 1f),
            Key(label = "\u23CE", type = KeyType.RETURN, widthWeight = 1.2f, contentDescription = "Return"),
        )
    )

    val NUMBER_ROWS = listOf(NUMBERS_ROW_1, NUMBERS_ROW_2, NUMBERS_ROW_3, NUMBERS_ROW_4)

    // -- Symbol Layout --

    val SYMBOLS_ROW_1 = Row(
        listOf("[", "]", "{", "}", "#", "%", "^", "*", "+", "=").map {
            Key(label = it)
        }
    )

    val SYMBOLS_ROW_2 = Row(
        listOf("_", "\\", "|", "~", "<", ">", "\u20AC", "\u00A3", "\u00A5", "\u2022").map {
            Key(label = it)
        }
    )

    val SYMBOLS_ROW_3 = Row(
        listOf(
            Key(label = "123", type = KeyType.SYMBOL_SWITCH, widthWeight = 1.5f, contentDescription = "Numbers"),
            Key(label = "."),
            Key(label = ","),
            Key(label = "?"),
            Key(label = "!"),
            Key(label = "'"),
            Key(label = "\u232B", type = KeyType.DELETE, widthWeight = 1.5f, contentDescription = "Delete"),
        )
    )

    val SYMBOLS_ROW_4 = NUMBERS_ROW_4 // Same bottom row

    val SYMBOL_ROWS = listOf(SYMBOLS_ROW_1, SYMBOLS_ROW_2, SYMBOLS_ROW_3, SYMBOLS_ROW_4)
}
