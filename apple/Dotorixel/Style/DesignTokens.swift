import SwiftUI

/// Design tokens matching the web editor's `design-tokens.css`.
/// Light theme only — dark mode is out of scope for this task.
enum DesignTokens {
    // MARK: - Surface Colors

    /// --ds-bg-base: #FDFBF8
    static let bgBase = SwiftUI.Color(red: 0xFD / 255.0, green: 0xFB / 255.0, blue: 0xF8 / 255.0)
    /// --ds-bg-surface: #F5F1EB
    static let bgSurface = SwiftUI.Color(red: 0xF5 / 255.0, green: 0xF1 / 255.0, blue: 0xEB / 255.0)
    /// --ds-bg-elevated: #FFFFFF
    static let bgElevated = SwiftUI.Color.white
    /// --ds-bg-hover: #EDE8DF
    static let bgHover = SwiftUI.Color(red: 0xED / 255.0, green: 0xE8 / 255.0, blue: 0xDF / 255.0)
    /// --ds-bg-active: #E5DED4
    static let bgActive = SwiftUI.Color(red: 0xE5 / 255.0, green: 0xDE / 255.0, blue: 0xD4 / 255.0)

    // MARK: - Text Colors

    /// --ds-text-primary: #2D210F
    static let textPrimary = SwiftUI.Color(red: 0x2D / 255.0, green: 0x21 / 255.0, blue: 0x0F / 255.0)
    /// --ds-text-secondary: #7B6D59
    static let textSecondary = SwiftUI.Color(red: 0x7B / 255.0, green: 0x6D / 255.0, blue: 0x59 / 255.0)
    /// --ds-text-tertiary: #A19383
    static let textTertiary = SwiftUI.Color(red: 0xA1 / 255.0, green: 0x93 / 255.0, blue: 0x83 / 255.0)

    // MARK: - Border Colors

    /// --ds-border: #D8CFC2
    static let border = SwiftUI.Color(red: 0xD8 / 255.0, green: 0xCF / 255.0, blue: 0xC2 / 255.0)
    /// --ds-border-subtle: #ECE5D9
    static let borderSubtle = SwiftUI.Color(red: 0xEC / 255.0, green: 0xE5 / 255.0, blue: 0xD9 / 255.0)

    // MARK: - Accent Colors

    /// --ds-accent: #B07A30
    static let accent = SwiftUI.Color(red: 0xB0 / 255.0, green: 0x7A / 255.0, blue: 0x30 / 255.0)
    /// --ds-accent-subtle: #B07A3018 (accent at ~9% opacity, active tool background)
    static let accentSubtle = SwiftUI.Color(red: 0xB0 / 255.0, green: 0x7A / 255.0, blue: 0x30 / 255.0, opacity: 0x18 / 255.0)
    /// --ds-accent-text: #8D6226
    static let accentText = SwiftUI.Color(red: 0x8D / 255.0, green: 0x62 / 255.0, blue: 0x26 / 255.0)

    // MARK: - Editor-Specific Colors

    /// --ds-canvas-bg: #F0ECE5
    static let canvasBg = SwiftUI.Color(red: 0xF0 / 255.0, green: 0xEC / 255.0, blue: 0xE5 / 255.0)

    // MARK: - Sizing

    /// Apple HIG touch target minimum
    static let btnSize: CGFloat = 44
    /// --ds-radius-sm: 6px
    static let radiusSm: CGFloat = 6
    /// --ds-radius-md: 12px
    static let radiusMd: CGFloat = 12
    /// --ds-font-size-sm: 11px
    static let fontSizeSm: CGFloat = 11
    /// --ds-font-size-md: 13px
    static let fontSize: CGFloat = 13
    /// Icon size within buttons
    static let iconSize: CGFloat = 18
    /// Left toolbar fixed width (PRD spec)
    static let leftToolbarWidth: CGFloat = 44
    /// Right panel fixed width (PRD spec)
    static let rightPanelWidth: CGFloat = 220
    /// Opacity for disabled controls (matches web .action-btn:disabled)
    static let disabledOpacity: Double = 0.4
}
