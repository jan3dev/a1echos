import AudioToolbox
import UIKit

/// Provides haptic feedback for keyboard interactions.
enum HapticManager {

    /// `.rigid` is the shortest, sharpest transient UIKit offers; the stock
    /// keyboard's tick is a crisp click, and `.light` at full intensity reads
    /// longer and heavier next to it.
    private static let keyGenerator = UIImpactFeedbackGenerator(style: .rigid)
    private static let selectionGenerator = UISelectionFeedbackGenerator()

    // ponytail: tuned by feel against the stock keyboard; adjust here only.
    static var keyTapIntensity: CGFloat = 0.55

    /// Gates all feedback. Defaults on; the view controller sets it from the
    /// user's `KeyboardSettings.hapticFeedback` preference whenever settings
    /// load. Requires Full Access — without it the generators are inert.
    static var isEnabled = true

    /// Short, light tick for key presses.
    static func keyTap() {
        guard isEnabled else { return }
        keyGenerator.impactOccurred(intensity: keyTapIntensity)
    }

    /// Light selection tick — used while scrubbing across the emoji category
    /// strip so each category the finger crosses registers, matching the
    /// native slide-to-browse feel.
    static func selectionChanged() {
        guard isEnabled else { return }
        selectionGenerator.selectionChanged()
    }

    /// Prepare generators for low-latency feedback.
    static func prepare() {
        keyGenerator.prepare()
        selectionGenerator.prepare()
    }
}

/// Plays the native key-click sounds via `AudioServicesPlaySystemSound` — the
/// standard approach for custom keyboards (`playInputClick()` requires being
/// the responder chain's input view and is unreliable in extensions). The
/// system sound IDs match the native keyboard's three click types. Gated by
/// the in-app "Key sound" setting; also needs Full Access (silently no-ops
/// without it) and respects the ringer/silent switch.
enum SoundManager {

    private static let clickSound: SystemSoundID = 1104
    private static let deleteSound: SystemSoundID = 1155
    private static let modifierSound: SystemSoundID = 1156

    /// Gated by the user's `KeyboardSettings.keySound` preference; the view
    /// controller updates it whenever settings load.
    static var isEnabled = true

    /// Standard key-click for regular key presses.
    static func keyTap() {
        guard isEnabled else { return }
        AudioServicesPlaySystemSound(clickSound)
    }

    /// Click variant for the delete key.
    static func deleteTap() {
        guard isEnabled else { return }
        AudioServicesPlaySystemSound(deleteSound)
    }

    /// Click variant for modifier keys (shift, layout switch, space, return).
    static func modifierTap() {
        guard isEnabled else { return }
        AudioServicesPlaySystemSound(modifierSound)
    }
}

/// Combined tactile + audible feedback for a committed key press. Every
/// text-entry commit (character keys, suggestion taps, emoji, skin-tone picks)
/// fires both, so those sites call this rather than pairing the two managers by
/// hand — "key press = haptic + click" is a mechanism, not a per-site
/// convention. Mode/chrome events that want haptic *only* (spacebar cursor-drag
/// entry, the record toggle) still call `HapticManager.keyTap()` directly.
enum KeyFeedback {

    /// Which of the three native clicks a committed press plays.
    enum Sound { case standard, delete, modifier }

    /// Haptic + system click for a committed key press.
    static func keyTap(_ sound: Sound = .standard) {
        HapticManager.keyTap()
        switch sound {
        case .standard: SoundManager.keyTap()
        case .delete: SoundManager.deleteTap()
        case .modifier: SoundManager.modifierTap()
        }
    }

    /// Feedback for a key button, mapping its type to the matching click.
    /// Native iOS plays three distinct clicks: regular keys, delete, and
    /// modifiers (shift, layout switches, space, return).
    static func keyTap(for type: KeyboardLayout.KeyType) {
        switch type {
        case .delete:
            keyTap(.delete)
        case .character, .comma, .period, .emoji:
            keyTap(.standard)
        default:
            keyTap(.modifier)
        }
    }
}
