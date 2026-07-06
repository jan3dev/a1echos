package com.a1lab.echos.ime

/**
 * QWERTY key-neighborhood table for the fat-finger substitution model:
 * substituting a physically adjacent key costs less than a random one.
 * Derived from the staggered 3-row layout (horizontal neighbors plus the
 * nearest keys in the adjacent rows).
 *
 * Must stay identical to `KEY_ADJACENCY` in
 * `scripts/keyboard-dictionary/decoder.js` (the reference implementation)
 * and `KeyAdjacency.swift` (the iOS twin).
 */
object KeyAdjacency {

    private val neighbors = mapOf(
        'q' to "wa", 'w' to "qeas", 'e' to "wrsd", 'r' to "etdf", 't' to "ryfg",
        'y' to "tugh", 'u' to "yihj", 'i' to "uojk", 'o' to "ipkl", 'p' to "ol",
        'a' to "qwsz", 's' to "weadzx", 'd' to "ersfxc", 'f' to "rtdgcv",
        'g' to "tyfhvb", 'h' to "yugjbn", 'j' to "uihknm", 'k' to "iojlm",
        'l' to "opk",
        'z' to "asx", 'x' to "sdzc", 'c' to "dfxv", 'v' to "fgcb", 'b' to "ghvn",
        'n' to "hjbm", 'm' to "jkn",
    )

    /** Bitset over ASCII pairs so the DP inner loop pays a table read, not a
     *  map hash. Non-letters (`'`, `-`) have no neighbors. */
    private val table = BooleanArray(128 * 128).also { table ->
        for ((key, adjacent) in neighbors) {
            for (n in adjacent) {
                table[key.code * 128 + n.code] = true
            }
        }
    }

    fun isAdjacent(a: Byte, b: Byte): Boolean {
        val ai = a.toInt() and 0xFF
        val bi = b.toInt() and 0xFF
        if (ai >= 128 || bi >= 128) return false
        return table[ai * 128 + bi]
    }
}
