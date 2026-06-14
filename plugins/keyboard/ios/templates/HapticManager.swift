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
