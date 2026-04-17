import UIKit

/// Provides haptic feedback for keyboard interactions.
enum HapticManager {

    private static let lightGenerator = UIImpactFeedbackGenerator(style: .light)
    private static let mediumGenerator = UIImpactFeedbackGenerator(style: .medium)

    /// Light tap for regular key presses.
    static func keyTap() {
        lightGenerator.impactOccurred()
    }

    /// Medium impact for special actions (mic press, shift).
    static func specialTap() {
        mediumGenerator.impactOccurred()
    }

    /// Prepare generators for low-latency feedback.
    static func prepare() {
        lightGenerator.prepare()
        mediumGenerator.prepare()
    }
}
