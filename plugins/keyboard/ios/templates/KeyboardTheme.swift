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
            // ~#6B6C6D — matches stock iOS dark-mode character key.
            return UIColor(red: 0.42, green: 0.42, blue: 0.43, alpha: 1.0)
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
    let keyShadow: UIColor = UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor.black.withAlphaComponent(0.45)
            : UIColor.black.withAlphaComponent(0.15)
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
