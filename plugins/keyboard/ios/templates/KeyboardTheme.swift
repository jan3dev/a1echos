import UIKit

/// Provides keyboard colors that adapt to the system appearance (light/dark).
/// Color values are from the Echos AquaPrimitiveColors design tokens.
struct KeyboardTheme {

    var keyboardBackground: UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: 0x090A0B)  // gray1000
                : UIColor(hex: 0xF4F5F6)  // gray50
        }
    }

    var keyBackground: UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: 0x131516)  // gray950
                : UIColor.white
        }
    }

    var keyBackgroundPressed: UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: 0x27292C)  // gray850
                : UIColor(hex: 0xE9EBEC)  // gray100
        }
    }

    var keyText: UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: 0xF4F5F6)  // gray50
                : UIColor(hex: 0x090A0B)  // gray1000
        }
    }

    var keyTextSecondary: UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: 0x8C9196)  // gray500
                : UIColor(hex: 0x5C6063)  // gray600
        }
    }

    var specialKeyBackground: UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: 0x27292C)  // gray850
                : UIColor(hex: 0xE9EBEC)  // gray100
        }
    }

    var specialKeyBackgroundPressed: UIColor {
        UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hex: 0x3B3E42)  // gray750
                : UIColor(hex: 0xCDD0D2)  // gray200
        }
    }

    var micButtonBackground: UIColor {
        UIColor(hex: 0x4361EE)  // neonBlue500 (same in both themes)
    }

    var micButtonRecording: UIColor {
        UIColor(hex: 0xFF3B13)  // scarlet500 (same in both themes)
    }

    var micButtonIcon: UIColor {
        .white
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
