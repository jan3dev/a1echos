import Foundation

/// Reads the keyboard's user-tunable settings from the App Group shared
/// `UserDefaults`. The RN app writes its preference to its own sandbox, then
/// the main-app transcription listener mirrors it into this shared suite (the
/// extension can't read the app's Documents directory — only the App Group
/// container — so the mirror is what bridges the two sandboxes).
///
/// Autocorrect defaults on (matching the native iOS keyboard, and safe now
/// that backspace offers a one-tap revert and reverted pairs are
/// blacklisted); haptics default off.
enum KeyboardSettings {

    /// Same App Group the IPC channel uses (`IPCClient.appGroupID`).
    static let appGroupID = "group.com.a1lab.echos.shared"

    /// When true (default), the engine's confident correction auto-applies on
    /// a separator and the next backspace reverts it. When false, suggestions
    /// are tap-only.
    private static let autocorrectKey = "EchosKeyboard.autocorrect"

    /// When true, the keyboard plays a light haptic on each key press. When
    /// false (default), it's silent — matching the iOS native keyboard.
    private static let hapticKey = "EchosKeyboard.hapticFeedback"

    struct Values {
        var autocorrect: Bool = true
        var hapticFeedback: Bool = false
    }

    static func load() -> Values {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return Values()
        }
        // `bool(forKey:)` returns false for a missing key, which would flip
        // the autocorrect default — read the raw object so absence keeps the
        // default.
        return Values(
            autocorrect: (defaults.object(forKey: autocorrectKey) as? Bool) ?? true,
            hapticFeedback: defaults.bool(forKey: hapticKey)
        )
    }
}
