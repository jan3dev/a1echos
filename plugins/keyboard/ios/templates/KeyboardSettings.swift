import Foundation

/// Reads the keyboard's user-tunable settings from the App Group shared
/// `UserDefaults`. The RN app writes its preference to its own sandbox, then
/// the main-app transcription listener mirrors it into this shared suite (the
/// extension can't read the app's Documents directory — only the App Group
/// container — so the mirror is what bridges the two sandboxes).
///
/// Everything defaults to the conservative "suggest" behaviour, so a missing
/// suite / missing key never enables a surprising edit.
enum KeyboardSettings {

    /// Same App Group the IPC channel uses (`IPCClient.appGroupID`).
    static let appGroupID = "group.com.a1lab.echos.shared"

    /// When true, the top spelling guess auto-applies on space and the next
    /// backspace reverts it. When false (default), suggestions are tap-only.
    private static let autocorrectKey = "EchosKeyboard.autocorrect"

    /// When true, the keyboard plays a light haptic on each key press. When
    /// false (default), it's silent — matching the iOS native keyboard.
    private static let hapticKey = "EchosKeyboard.hapticFeedback"

    struct Values {
        var autocorrect: Bool = false
        var hapticFeedback: Bool = false
    }

    static func load() -> Values {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return Values()
        }
        return Values(
            autocorrect: defaults.bool(forKey: autocorrectKey),
            hapticFeedback: defaults.bool(forKey: hapticKey)
        )
    }
}
