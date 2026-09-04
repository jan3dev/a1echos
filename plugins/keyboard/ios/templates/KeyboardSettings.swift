import Foundation

/// Reads the keyboard's user-tunable settings from the App Group shared
/// `UserDefaults`. The RN app writes its preference to its own sandbox, then
/// the main-app transcription listener mirrors it into this shared suite (the
/// extension can't read the app's Documents directory — only the App Group
/// container — so the mirror is what bridges the two sandboxes).
///
/// Autocorrect defaults on (matching the native iOS keyboard, and safe now
/// that backspace offers a one-tap revert and reverted pairs are
/// blacklisted); haptics and key sounds default on.
enum KeyboardSettings {

    /// Same App Group the IPC channel uses (`IPCClient.appGroupID`).
    static let appGroupID = "group.com.a1lab.echos.shared"

    /// When true (default), the engine's confident correction auto-applies on
    /// a separator and the next backspace reverts it. When false, suggestions
    /// are tap-only.
    private static let autocorrectKey = "EchosKeyboard.autocorrect"

    /// When true (default), the keyboard plays a light haptic on each key
    /// press.
    private static let hapticKey = "EchosKeyboard.hapticFeedback"

    /// When true (default), the keyboard plays a key click on each key press.
    /// The click needs Full Access — without it the tap is silently dropped.
    private static let keySoundKey = "EchosKeyboard.keySound"

    struct Values {
        var autocorrect: Bool = true
        var hapticFeedback: Bool = true
        var keySound: Bool = true
    }

    static func load() -> Values {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return Values()
        }
        // `bool(forKey:)` returns false for a missing key, which would flip
        // the on-by-default flags — read the raw object so absence keeps the
        // default.
        return Values(
            autocorrect: (defaults.object(forKey: autocorrectKey) as? Bool) ?? true,
            hapticFeedback: (defaults.object(forKey: hapticKey) as? Bool) ?? true,
            keySound: (defaults.object(forKey: keySoundKey) as? Bool) ?? true
        )
    }
}
