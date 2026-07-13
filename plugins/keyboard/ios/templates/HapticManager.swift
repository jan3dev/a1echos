import UIKit

/// Provides haptic feedback for keyboard interactions.
enum HapticManager {

    private static let lightGenerator = UIImpactFeedbackGenerator(style: .light)
    private static let mediumGenerator = UIImpactFeedbackGenerator(style: .medium)

    /// Gates all feedback. Defaults off to match the native keyboard (whose
    /// haptics are opt-in); the view controller sets it from the user's
    /// `KeyboardSettings.hapticFeedback` preference whenever settings load.
    static var isEnabled = false

    /// Light tap for regular key presses.
    static func keyTap() {
        guard isEnabled else { return }
        lightGenerator.impactOccurred()
    }

    /// Medium impact for special actions (mic press, shift).
    static func specialTap() {
        guard isEnabled else { return }
        mediumGenerator.impactOccurred()
    }

    /// Prepare generators for low-latency feedback.
    static func prepare() {
        lightGenerator.prepare()
        mediumGenerator.prepare()
    }
}

/// Plays the native key-click sound for keyboard interactions via
/// `UIDevice.playInputClick()`. The system only produces the click when the
/// input view adopts `UIInputViewAudioFeedback` (KeyboardView does), the
/// keyboard has Full Access, and the user's system "Keyboard Clicks" setting is
/// on — so the on/off control lives in iOS Settings, matching the native
/// keyboard. There is deliberately no in-app toggle (it could only ever further
/// mute the system preference, never enable it).
enum SoundManager {

    /// Standard key-click for regular key presses.
    static func keyTap() {
        UIDevice.current.playInputClick()
    }
}

/// Combined tactile + audible feedback for a committed key press. Every
/// text-entry commit (character keys, suggestion taps, emoji, skin-tone picks)
/// fires both, so those sites call this rather than pairing the two managers by
/// hand — "key press = haptic + click" is a mechanism, not a per-site
/// convention. Mode/chrome events that want haptic *only* (spacebar cursor-drag
/// entry, the record toggle) still call `HapticManager.keyTap()` directly.
enum KeyFeedback {

    /// Haptic + system click for a committed key press.
    static func keyTap() {
        HapticManager.keyTap()
        SoundManager.keyTap()
    }
}
