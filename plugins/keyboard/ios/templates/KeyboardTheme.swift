import UIKit

/// Keyboard appearance tokens matching the iOS 26 stock keyboard as closely
/// as UIKit lets a third-party keyboard get. The `.keyboard` input-view style
/// supplies the native translucent backdrop, so the root background stays
/// `.clear` and we only pin the per-key fills + brand accent.
///
/// iOS 26 unified the idle fill for every key — letters, modifiers, and the
/// 123/ABC switch all share `keyBackground`. Only modifier keys flash to
/// `specialKeyPressed` while held; the layout-switch key never flashes.
struct KeyboardTheme {

    /// Root keyboard backdrop. Clear so the `UIInputView(.keyboard)` native
    /// blur shows through.
    let keyboardBackground: UIColor = .clear

    /// Character / space key fill. In light mode this is pure white; in dark
    /// mode it's the lighter gray that stock iOS uses so character keys
    /// visually pop above the blurred background.
    let keyBackground: UIColor = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            // #3C3C3C — default dark-mode character key fill.
            return UIColor(red: 60 / 255.0, green: 60 / 255.0, blue: 60 / 255.0, alpha: 1.0)
        }
        return .white
    }

    /// Primary label / glyph color.
    let keyText: UIColor = .label

    /// Secondary label (sub-label on number rows etc.).
    let keyTextSecondary: UIColor = .secondaryLabel

    /// Pressed-state fill for modifier keys (shift / delete / #+= / globe /
    /// emoji). On iOS 26 every key shares the same idle fill, and these
    /// modifier keys flash to this darker grey only while held.
    let specialKeyPressed: UIColor = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            // ~#47494B
            return UIColor(red: 0.28, green: 0.29, blue: 0.30, alpha: 1.0)
        }
        // ~#ADB3B8
        return UIColor(red: 0.68, green: 0.70, blue: 0.72, alpha: 1.0)
    }

    /// Brand accent — return key fill and top-bar record button idle.
    /// Matches the Figma spec (DS Echos App).
    let micButtonBackground: UIColor = UIColor(hex: 0x5773EF)

    /// Recording indicator color.
    let micButtonRecording: UIColor = UIColor(hex: 0xFF3B13)

    /// Icon tint on filled brand surfaces.
    let micButtonIcon: UIColor = .white

    /// Drop-shadow color used on each key to match stock iOS's subtle elevation.
    /// Dark-mode was previously 0.45α which crushed the floating-key look in
    /// low-light; KeyboardKit / stock iOS use a much lighter shadow (~0.25α)
    /// so the keys read as raised, not glued.
    let keyShadow: UIColor = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor.black.withAlphaComponent(0.25)
            : UIColor.black.withAlphaComponent(0.15)
    }

    // MARK: - Geometry tokens

    /// Corner radius for the character (alphanumeric) keys. Slightly tighter
    /// than the system keys so the QWERTY rows read as a continuous band of
    /// pill cells — matches the visual hierarchy KeyboardKit and stock iOS 26
    /// use to separate "letter" from "function" affordances.
    let cornerRadiusCharacter: CGFloat = 6

    /// Corner radius for system keys (shift / delete / 123 / return / mic).
    /// A touch larger than `cornerRadiusCharacter` so the rounder shape reads
    /// as the action affordance.
    let cornerRadiusSystem: CGFloat = 8

    // MARK: - Emoji picker tokens

    /// Background fill behind the active category icon in the emoji picker's
    /// category strip. Mirrors KeyboardKit's pill-highlighted active tab.
    let emojiCategorySelectedFill: UIColor = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return UIColor.white.withAlphaComponent(0.12)
        }
        return UIColor.black.withAlphaComponent(0.08)
    }

    /// Search-pill fill in the emoji picker. Native iOS 26 renders the
    /// search field as a tone *lighter* than the keyboard backdrop in
    /// both appearances — a near-white pill on the light grey backdrop,
    /// and a subtle lift over the dark backdrop. Using a black overlay
    /// in light mode makes the field read as recessed/darker, which
    /// breaks parity with the system emoji keyboard.
    let emojiSearchBarFill: UIColor = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return UIColor.white.withAlphaComponent(0.18)
        }
        return UIColor.white.withAlphaComponent(0.7)
    }

    /// Tint for inactive category icons. Active ones use `keyText`.
    let emojiCategoryInactiveTint: UIColor = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return UIColor.white.withAlphaComponent(0.55)
        }
        return UIColor.black.withAlphaComponent(0.40)
    }

    /// Caption color above each section block in the emoji scroll view.
    let emojiSectionHeaderText: UIColor = .secondaryLabel

    /// Background flash drawn behind an emoji cell while it's pressed.
    let emojiCellPressedFill: UIColor = UIColor { traits in
        if traits.userInterfaceStyle == .dark {
            return UIColor.white.withAlphaComponent(0.10)
        }
        return UIColor.black.withAlphaComponent(0.06)
    }
}

// MARK: - UIColor Hex Extension

extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1.0) {
        self.init(
            red: CGFloat((hex >> 16) & 0xFF) / 255.0,
            green: CGFloat((hex >> 8) & 0xFF) / 255.0,
            blue: CGFloat(hex & 0xFF) / 255.0,
            alpha: alpha
        )
    }
}
