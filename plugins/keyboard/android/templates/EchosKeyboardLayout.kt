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
        GLOBE,          // Switch IME (long-press surfaces system picker)
        EMOJI_COMMA,    // Tap -> ","; long-press -> emoji picker. Smiley icon
                        // sits above a small "," label, mirroring Gboard.
        SYMBOL_SWITCH,  // =\<  / ?123 toggle (between NUMBERS <-> SYMBOLS)
        NUMPAD_SWITCH,  // "1234" key — opens the calculator/numpad layout
        PERIOD,
    }

    data class Key(
        val label: String,
        val type: KeyType = KeyType.CHARACTER,
        val widthWeight: Float = 1f,
        val contentDescription: String = label,
        /// Optional drawable resource name (e.g. "ic_shift"). When set, the
        /// keyboard view renders this vector icon instead of `label`. Used
        /// for shift / return / delete / emoji so the glyphs match the iOS
        /// SF Symbols visually rather than relying on Unicode characters.
        val iconName: String? = null,
        /// When true the key is drawn on the darker `specialKeyBackground`
        /// (like the period / globe / delete keys) even though it's a plain
        /// CHARACTER — used by the email `@` and URL `/` so they read as
        /// field-punctuation keys, not letters.
        val useSpecialBackground: Boolean = false,
        /// When true the label renders in the smaller, centered special-key
        /// font instead of the full letter size. Set on the email `@`
        /// (mirrors iOS `usesCompactLabelFont`); the URL `/` leaves this off so
        /// it stays letter-sized like the period key.
        val useCompactFont: Boolean = false,
    )

    /// A keyboard row. Rows are laid out on a fixed cell grid anchored to
    /// the widest row (typically 10 cells) — `leadingPadCells` and
    /// `trailingPadCells` shift the keys horizontally within the grid so
    /// that, e.g., the "a" row indents half a cell on each side and "a"
    /// lands centered between "q" and "w". `heightMultiplier` lets a row
    /// claim more than the default key height (the NUMPAD layout uses 2.0
    /// on its number rows so the digit keys read as a real calculator).
    data class Row(
        val keys: List<Key>,
        val leadingPadCells: Float = 0f,
        val trailingPadCells: Float = 0f,
        val heightMultiplier: Float = 1f,
    )

    // -- QWERTY Letter Layout --

    val LETTERS_ROW_1 = Row(
        listOf("q", "w", "e", "r", "t", "y", "u", "i", "o", "p").map {
            Key(label = it)
        }
    )

    val LETTERS_ROW_2 = Row(
        keys = listOf("a", "s", "d", "f", "g", "h", "j", "k", "l").map {
            Key(label = it)
        },
        leadingPadCells = 0.5f,
        trailingPadCells = 0.5f,
    )

    val LETTERS_ROW_3 = Row(
        listOf(
            Key(label = "", type = KeyType.SHIFT, widthWeight = 1.5f, contentDescription = "Shift", iconName = "ic_shift"),
            Key(label = "z"),
            Key(label = "x"),
            Key(label = "c"),
            Key(label = "v"),
            Key(label = "b"),
            Key(label = "n"),
            Key(label = "m"),
            Key(label = "", type = KeyType.DELETE, widthWeight = 1.5f, contentDescription = "Delete", iconName = "ic_backspace_outline"),
        )
    )

    val LETTERS_ROW_4 = Row(
        listOf(
            Key(label = "?123", type = KeyType.MODE_SWITCH, widthWeight = 1.5f, contentDescription = "Numbers"),
            Key(label = ",", type = KeyType.EMOJI_COMMA, widthWeight = 1f, contentDescription = "Emoji, comma", iconName = "ic_emoji"),
            Key(label = "", type = KeyType.GLOBE, widthWeight = 1f, contentDescription = "Switch keyboard", iconName = "ic_globe"),
            Key(label = " ", type = KeyType.SPACE, widthWeight = 4f, contentDescription = "Space"),
            Key(label = ".", type = KeyType.PERIOD, widthWeight = 1f),
            Key(label = "", type = KeyType.RETURN, widthWeight = 1.5f, contentDescription = "Return", iconName = "ic_return"),
        )
    )

    val LETTER_ROWS = listOf(LETTERS_ROW_1, LETTERS_ROW_2, LETTERS_ROW_3, LETTERS_ROW_4)

    // -- Field-type letter variants (§9.2) --
    //
    // Email / URI reuse the QWERTY rows 1-3; only the bottom row changes,
    // mirroring Gboard. Each row-4 keeps the 10-cell weight total so the row
    // chrome doesn't resize between layouts. Gboard drops the comma on these
    // fields and surfaces the field-relevant punctuation instead.

    // Email: the comma/emoji slot becomes a dedicated `@`; the period is
    // already present. 1.5 + 1 + 1 + 4 + 1 + 1.5 = 10.
    val EMAIL_LETTERS_ROW_4 = Row(
        listOf(
            Key(label = "?123", type = KeyType.MODE_SWITCH, widthWeight = 1.5f, contentDescription = "Numbers"),
            Key(label = "@", widthWeight = 1f, useSpecialBackground = true, useCompactFont = true),
            Key(label = "", type = KeyType.GLOBE, widthWeight = 1f, contentDescription = "Switch keyboard", iconName = "ic_globe"),
            Key(label = " ", type = KeyType.SPACE, widthWeight = 4f, contentDescription = "Space"),
            Key(label = ".", type = KeyType.PERIOD, widthWeight = 1f),
            Key(label = "", type = KeyType.RETURN, widthWeight = 1.5f, contentDescription = "Return", iconName = "ic_return"),
        )
    )

    val EMAIL_LETTER_ROWS = listOf(LETTERS_ROW_1, LETTERS_ROW_2, LETTERS_ROW_3, EMAIL_LETTERS_ROW_4)

    // URI: `/`, `.` and a `.com` key (label inserted verbatim). Globe is kept
    // for the IME switcher. 1.5 + 1 + 1 + 2.6 + 1 + 1.4 + 1.5 = 10.
    val URI_LETTERS_ROW_4 = Row(
        listOf(
            Key(label = "?123", type = KeyType.MODE_SWITCH, widthWeight = 1.5f, contentDescription = "Numbers"),
            Key(label = "/", widthWeight = 1f, useSpecialBackground = true),
            Key(label = "", type = KeyType.GLOBE, widthWeight = 1f, contentDescription = "Switch keyboard", iconName = "ic_globe"),
            Key(label = " ", type = KeyType.SPACE, widthWeight = 2.6f, contentDescription = "Space"),
            Key(label = ".", type = KeyType.PERIOD, widthWeight = 1f),
            Key(label = ".com", widthWeight = 1.4f, contentDescription = "dot com"),
            Key(label = "", type = KeyType.RETURN, widthWeight = 1.5f, contentDescription = "Return", iconName = "ic_return"),
        )
    )

    val URI_LETTER_ROWS = listOf(LETTERS_ROW_1, LETTERS_ROW_2, LETTERS_ROW_3, URI_LETTERS_ROW_4)

    // -- Number Layout --

    val NUMBERS_ROW_1 = Row(
        listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "0").map {
            Key(label = it)
        }
    )

    val NUMBERS_ROW_2 = Row(
        listOf("@", "#", "$", "_", "&", "-", "+", "(", ")", "/").map {
            Key(label = it)
        }
    )

    // 1.5 + 7*1.0 + 1.5 = 10 cells. =\< toggles into symbols, then the 7
    // punctuation glyphs sit at standard width.
    val NUMBERS_ROW_3 = Row(
        listOf(
            Key(label = "=\\<", type = KeyType.SYMBOL_SWITCH, widthWeight = 1.5f, contentDescription = "Symbols"),
            Key(label = "*"),
            Key(label = "\""),
            Key(label = "'"),
            Key(label = ":"),
            Key(label = ";"),
            Key(label = "!"),
            Key(label = "?"),
            Key(label = "", type = KeyType.DELETE, widthWeight = 1.5f, contentDescription = "Delete", iconName = "ic_backspace_outline"),
        )
    )

    // Numbers row 4 drops the globe slot in favour of the NUMPAD key, the
    // way Gboard does for non-letter layouts.
    val NUMBERS_ROW_4 = Row(
        listOf(
            Key(label = "ABC", type = KeyType.MODE_SWITCH, widthWeight = 1.5f, contentDescription = "Letters"),
            Key(label = ","),
            Key(label = "1234", type = KeyType.NUMPAD_SWITCH, widthWeight = 1f, contentDescription = "Numeric pad"),
            Key(label = " ", type = KeyType.SPACE, widthWeight = 4f, contentDescription = "Space"),
            Key(label = ".", type = KeyType.PERIOD, widthWeight = 1f),
            Key(label = "", type = KeyType.RETURN, widthWeight = 1.5f, contentDescription = "Return", iconName = "ic_return"),
        )
    )

    val NUMBER_ROWS = listOf(NUMBERS_ROW_1, NUMBERS_ROW_2, NUMBERS_ROW_3, NUMBERS_ROW_4)

    // -- Symbol Layout --

    val SYMBOLS_ROW_1 = Row(
        listOf("~", "`", "|", "•", "√", "π", "÷", "×", "§", "Δ").map {
            Key(label = it)
        }
    )

    val SYMBOLS_ROW_2 = Row(
        listOf("£", "¢", "€", "¥", "^", "°", "=", "{", "}", "\\").map {
            Key(label = it)
        }
    )

    val SYMBOLS_ROW_3 = Row(
        listOf(
            Key(label = "?123", type = KeyType.SYMBOL_SWITCH, widthWeight = 1.5f, contentDescription = "Numbers"),
            Key(label = "%"),
            Key(label = "©"),
            Key(label = "®"),
            Key(label = "™"),
            Key(label = "✓", iconName = "ic_check", contentDescription = "Check"),
            Key(label = "["),
            Key(label = "]"),
            Key(label = "", type = KeyType.DELETE, widthWeight = 1.5f, contentDescription = "Delete", iconName = "ic_backspace_outline"),
        )
    )

    // Symbols row 4 swaps comma/period for < and >, but otherwise mirrors
    // the numbers row 4 (ABC, NUMPAD, space, return).
    val SYMBOLS_ROW_4 = Row(
        listOf(
            Key(label = "ABC", type = KeyType.MODE_SWITCH, widthWeight = 1.5f, contentDescription = "Letters"),
            Key(label = "<"),
            Key(label = "1234", type = KeyType.NUMPAD_SWITCH, widthWeight = 1f, contentDescription = "Numeric pad"),
            Key(label = " ", type = KeyType.SPACE, widthWeight = 4f, contentDescription = "Space"),
            Key(label = ">"),
            Key(label = "", type = KeyType.RETURN, widthWeight = 1.5f, contentDescription = "Return", iconName = "ic_return"),
        )
    )

    val SYMBOL_ROWS = listOf(SYMBOLS_ROW_1, SYMBOLS_ROW_2, SYMBOLS_ROW_3, SYMBOLS_ROW_4)

    // -- Numeric pad / calculator layout --
    //
    // NUMPAD is laid out cell-first: each cell occupies one or more
    // fractional rectangles inside a 5-column × 4-row grid. Some cells
    // contain a single Key; others host a vertical stack (the operator
    // column) or a horizontal split (the bottom-row pairs). Rendering
    // and pointer tracking treat each rendered key as one rect, so
    // sub-divided cells produce multiple rects.
    //
    // Grid coordinates:
    //   - col is the 5-col index (0-4)
    //   - row is the 4-row index (0-3); rows 0-2 are full-height number
    //     rows, row 3 is a shorter bottom-row.
    //   - rowSpan = 3 makes the cell span the three number rows; the
    //     operator column and utility column use this so a single cell
    //     contains the full vertical stack.

    enum class CellLayout { SINGLE, VERTICAL_STACK, HORIZONTAL_SPLIT }

    data class NumpadCell(
        val col: Int,
        val row: Int,
        val rowSpan: Int = 1,
        val colSpan: Int = 1,
        /// One key for SINGLE; multiple for VERTICAL_STACK or HORIZONTAL_SPLIT.
        val keys: List<Key>,
        val layout: CellLayout = CellLayout.SINGLE,
        /// HORIZONTAL_SPLIT only: per-sub-key width weights so we can
        /// render asymmetric splits (e.g. `comma` narrow + `!?#` wider).
        /// Length must match [keys] when non-null.
        val subWidthWeights: FloatArray? = null,
    )

    val NUMPAD_CELLS: List<NumpadCell> = listOf(
        // Col 0 row 0-2: operator stack (connected, no inter-key gap).
        // The stack itself is vertically scrollable — we list +, -, *, /
        // plus the bracket overflow (, ) here, even though only four
        // operators fit at once. The keyboard view applies a scroll
        // offset so the user can drag to reveal the brackets.
        NumpadCell(
            col = 0, row = 0, rowSpan = 3,
            keys = listOf(
                Key("+"),
                Key("-"),
                Key("*"),
                Key("/"),
                Key("("),
                Key(")"),
            ),
            layout = CellLayout.VERTICAL_STACK,
        ),
        NumpadCell(
            col = 0, row = 3,
            keys = listOf(Key("ABC", type = KeyType.MODE_SWITCH, contentDescription = "Letters")),
        ),

        // 3 x 3 digit grid (cols 1-3, rows 0-2).
        NumpadCell(col = 1, row = 0, keys = listOf(Key("1"))),
        NumpadCell(col = 2, row = 0, keys = listOf(Key("2"))),
        NumpadCell(col = 3, row = 0, keys = listOf(Key("3"))),
        NumpadCell(col = 1, row = 1, keys = listOf(Key("4"))),
        NumpadCell(col = 2, row = 1, keys = listOf(Key("5"))),
        NumpadCell(col = 3, row = 1, keys = listOf(Key("6"))),
        NumpadCell(col = 1, row = 2, keys = listOf(Key("7"))),
        NumpadCell(col = 2, row = 2, keys = listOf(Key("8"))),
        NumpadCell(col = 3, row = 2, keys = listOf(Key("9"))),

        // Bottom row (row 3): col 1 hosts `,` + `!?#`, col 3 hosts `=` +
        // `.`. The "!?#" and "=" sub-cells are slightly wider than the
        // punctuation ones (matches Gboard).
        NumpadCell(
            col = 1, row = 3,
            keys = listOf(
                Key(","),
                Key("!?#", type = KeyType.SYMBOL_SWITCH, contentDescription = "Symbols"),
            ),
            layout = CellLayout.HORIZONTAL_SPLIT,
            subWidthWeights = floatArrayOf(0.85f, 1.15f),
        ),
        NumpadCell(col = 2, row = 3, keys = listOf(Key("0"))),
        NumpadCell(
            col = 3, row = 3,
            keys = listOf(
                Key("="),
                Key(".", type = KeyType.PERIOD),
            ),
            layout = CellLayout.HORIZONTAL_SPLIT,
            subWidthWeights = floatArrayOf(1.15f, 0.85f),
        ),

        // Col 4: utility stack (rows 0-2) + return (row 3).
        NumpadCell(col = 4, row = 0, keys = listOf(Key("%"))),
        NumpadCell(col = 4, row = 1, keys = listOf(Key(" ", type = KeyType.SPACE, contentDescription = "Space"))),
        NumpadCell(
            col = 4, row = 2,
            keys = listOf(Key("", type = KeyType.DELETE, contentDescription = "Delete", iconName = "ic_backspace_outline")),
        ),
        NumpadCell(
            col = 4, row = 3,
            keys = listOf(Key("", type = KeyType.RETURN, contentDescription = "Return", iconName = "ic_return")),
        ),
    )

    /// Column width weights for the 5-col grid. Operator and utility
    /// columns are narrower than the digit columns; digit cols 1-3 are
    /// identical so the 3x3 grid keys all match exactly.
    val NUMPAD_COL_WEIGHTS: FloatArray = floatArrayOf(1.3f, 1.9f, 1.9f, 1.9f, 1.5f)

    // -- Auto numeric pad (4x4) for TYPE_CLASS_NUMBER (§9.2) --

    /// Four equal columns for the auto-activated numeric pad.
    val NUMERIC_PAD_4X4_COL_WEIGHTS: FloatArray = floatArrayOf(1f, 1f, 1f, 1f)

    /// The compact 4x4 numeric pad Gboard shows for `TYPE_CLASS_NUMBER`:
    ///
    /// ```
    /// 1   2   3   −
    /// 4   5   6   ␣
    /// 7   8   9   ⌫
    /// ,   0   .   ⏎
    /// ```
    ///
    /// Used for all three numeric field types (number / decimal / signed) —
    /// the full set of keys is always shown, matching Gboard, rather than
    /// gating `−` / `.` on the field's flags. Distinct from the scrollable
    /// 5-col calculator [NUMPAD_CELLS] (reached via the symbols-page "1234"
    /// key), which is unchanged. The `−` uses an ASCII hyphen-minus.
    val NUMERIC_PAD_4X4_CELLS: List<NumpadCell> = listOf(
        NumpadCell(col = 0, row = 0, keys = listOf(Key("1"))),
        NumpadCell(col = 1, row = 0, keys = listOf(Key("2"))),
        NumpadCell(col = 2, row = 0, keys = listOf(Key("3"))),
        // Inserts an ASCII "-"; rendered with the wider `ic_minus` glyph.
        NumpadCell(col = 3, row = 0, keys = listOf(Key("-", contentDescription = "Minus", iconName = "ic_minus"))),

        NumpadCell(col = 0, row = 1, keys = listOf(Key("4"))),
        NumpadCell(col = 1, row = 1, keys = listOf(Key("5"))),
        NumpadCell(col = 2, row = 1, keys = listOf(Key("6"))),
        NumpadCell(col = 3, row = 1, keys = listOf(Key(" ", type = KeyType.SPACE, contentDescription = "Space", iconName = "ic_space"))),

        NumpadCell(col = 0, row = 2, keys = listOf(Key("7"))),
        NumpadCell(col = 1, row = 2, keys = listOf(Key("8"))),
        NumpadCell(col = 2, row = 2, keys = listOf(Key("9"))),
        NumpadCell(
            col = 3, row = 2,
            keys = listOf(Key("", type = KeyType.DELETE, contentDescription = "Delete", iconName = "ic_backspace_outline")),
        ),

        NumpadCell(col = 0, row = 3, keys = listOf(Key(","))),
        NumpadCell(col = 1, row = 3, keys = listOf(Key("0"))),
        NumpadCell(col = 2, row = 3, keys = listOf(Key(".", type = KeyType.PERIOD))),
        // Gboard's numeric pad enter is a checkmark, not a return arrow.
        NumpadCell(
            col = 3, row = 3,
            keys = listOf(Key("", type = KeyType.RETURN, contentDescription = "Enter", iconName = "ic_check")),
        ),
    )

    // -- Numeric-password pad (§9.2) --

    /// Stripped, digits-only variant of [NUMERIC_PAD_4X4_CELLS] for
    /// `TYPE_CLASS_NUMBER` + `TYPE_NUMBER_VARIATION_PASSWORD` (PINs / numeric
    /// passcodes). The `−`, `,` and `.` cells are omitted — an absent grid slot
    /// renders empty, so no spacer key is needed. Digits, space, delete and
    /// the enter checkmark are retained. Reuses [NUMERIC_PAD_4X4_COL_WEIGHTS].
    ///
    /// ```
    /// 1   2   3
    /// 4   5   6   ␣
    /// 7   8   9   ⌫
    ///     0       ⏎
    /// ```
    val NUMERIC_PAD_PASSWORD_CELLS: List<NumpadCell> = listOf(
        NumpadCell(col = 0, row = 0, keys = listOf(Key("1"))),
        NumpadCell(col = 1, row = 0, keys = listOf(Key("2"))),
        NumpadCell(col = 2, row = 0, keys = listOf(Key("3"))),

        NumpadCell(col = 0, row = 1, keys = listOf(Key("4"))),
        NumpadCell(col = 1, row = 1, keys = listOf(Key("5"))),
        NumpadCell(col = 2, row = 1, keys = listOf(Key("6"))),
        NumpadCell(col = 3, row = 1, keys = listOf(Key(" ", type = KeyType.SPACE, contentDescription = "Space", iconName = "ic_space"))),

        NumpadCell(col = 0, row = 2, keys = listOf(Key("7"))),
        NumpadCell(col = 1, row = 2, keys = listOf(Key("8"))),
        NumpadCell(col = 2, row = 2, keys = listOf(Key("9"))),
        NumpadCell(
            col = 3, row = 2,
            keys = listOf(Key("", type = KeyType.DELETE, contentDescription = "Delete", iconName = "ic_backspace_outline")),
        ),

        NumpadCell(col = 1, row = 3, keys = listOf(Key("0"))),
        NumpadCell(
            col = 3, row = 3,
            keys = listOf(Key("", type = KeyType.RETURN, contentDescription = "Enter", iconName = "ic_check")),
        ),
    )

    // Row heights are computed directly in `EchosKeyboardView.computeCellKeyRects`
    // — bottom row matches letter-key height, digit rows fill the rest.
}
