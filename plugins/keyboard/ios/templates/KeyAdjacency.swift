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

    /// Letter-key centers in key-grid units (key width = 1.0) on the standard
    /// QWERTY 10/9/7 layout — rows at y 0.5/1.5/2.5, home and bottom rows
    /// indented by 0.5 and 1.5 key widths. Mirrors `KEY_CENTERS` in decoder.js;
    /// native key views normalize taps into this same space.
    private static let centers: [(x: Float, y: Float)?] = {
        var centers = [(x: Float, y: Float)?](repeating: nil, count: 128)
        let rows: [(String, Float, Float)] = [
            ("qwertyuiop", 0.5, 0.5),
            ("asdfghjkl", 1.0, 1.5),
            ("zxcvbnm", 2.0, 2.5),
        ]
        for (letters, x0, y) in rows {
            for (i, ch) in letters.utf8.enumerated() {
                centers[Int(ch)] = (x0 + Float(i), y)
            }
        }
        return centers
    }()

    static func center(_ a: UInt8) -> (x: Float, y: Float)? {
        guard a < 128 else { return nil }
        return centers[Int(a)]
    }
}
