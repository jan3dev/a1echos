import Foundation

/// QWERTY key-neighborhood table for the fat-finger substitution model:
/// substituting a physically adjacent key costs less than a random one.
/// Derived from the staggered 3-row layout (horizontal neighbors plus the
/// nearest keys in the adjacent rows).
///
/// Must stay identical to `KEY_ADJACENCY` in
/// `scripts/keyboard-dictionary/decoder.js` (the reference implementation)
/// and `KeyAdjacency.kt` (the Android twin).
enum KeyAdjacency {

    private static let neighbors: [Character: String] = [
        "q": "wa", "w": "qeas", "e": "wrsd", "r": "etdf", "t": "ryfg",
        "y": "tugh", "u": "yihj", "i": "uojk", "o": "ipkl", "p": "ol",
        "a": "qwsz", "s": "weadzx", "d": "ersfxc", "f": "rtdgcv", "g": "tyfhvb",
        "h": "yugjbn", "j": "uihknm", "k": "iojlm", "l": "opk",
        "z": "asx", "x": "sdzc", "c": "dfxv", "v": "fgcb", "b": "ghvn",
        "n": "hjbm", "m": "jkn",
    ]

    /// Bitset over ASCII pairs so the DP inner loop pays a table read, not a
    /// dictionary hash. Non-letters (`'`, `-`) have no neighbors.
    private static let table: [Bool] = {
        var table = [Bool](repeating: false, count: 128 * 128)
        for (key, adjacent) in neighbors {
            let a = Int(key.asciiValue!)
            for n in adjacent.utf8 {
                table[a * 128 + Int(n)] = true
            }
        }
        return table
    }()

    static func isAdjacent(_ a: UInt8, _ b: UInt8) -> Bool {
        guard a < 128, b < 128 else { return false }
        return table[Int(a) * 128 + Int(b)]
    }
}
