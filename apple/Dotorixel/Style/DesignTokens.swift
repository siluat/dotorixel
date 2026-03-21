import SwiftUI

/// Design tokens matching the web editor's `pebble-tokens.css`.
enum PebbleTokens {
    // MARK: - Colors

    /// Editor background — #EFECE8
    static let bg = SwiftUI.Color(red: 0.937, green: 0.925, blue: 0.910)
    /// Panel background — rgba(255,255,255,0.93)
    static let panelBg = SwiftUI.Color.white.opacity(0.93)
    /// Panel border — #DDD9D4
    static let panelBorder = SwiftUI.Color(red: 0.867, green: 0.851, blue: 0.831)
    /// Primary text — #2D2D2D
    static let textPrimary = SwiftUI.Color(red: 0.176, green: 0.176, blue: 0.176)
    /// Secondary text — #8A8A8A
    static let textSecondary = SwiftUI.Color(red: 0.541, green: 0.541, blue: 0.541)
    /// Muted text — #AAA5A0
    static let textMuted = SwiftUI.Color(red: 0.667, green: 0.647, blue: 0.627)

    /// Accent (acorn brown) — oklch(0.55 0.15 45)
    static let accent = SwiftUI.Color(red: 0.639, green: 0.357, blue: 0.161)
    /// Accent dark — oklch(0.45 0.17 45)
    static let accentDark = SwiftUI.Color(red: 0.510, green: 0.255, blue: 0.078)
    /// Button background — #F5F2EE
    static let btnBg = SwiftUI.Color(red: 0.961, green: 0.949, blue: 0.933)
    /// Button hover background — #EDEAE5
    static let btnBgHover = SwiftUI.Color(red: 0.929, green: 0.918, blue: 0.898)

    // MARK: - Sizing

    static let panelRadius: CGFloat = 20
    static let panelRadiusLg: CGFloat = 28
    static let btnRadius: CGFloat = 12
    static let btnSize: CGFloat = 40
    static let edgeGap: CGFloat = 16
    static let fontSize: CGFloat = 13
    static let iconSize: CGFloat = 18
}
