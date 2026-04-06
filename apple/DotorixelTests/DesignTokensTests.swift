import Testing
import SwiftUI
@testable import Dotorixel

// MARK: - Color assertion helper

/// Asserts that a SwiftUI Color matches the expected hex value (sRGB, 8-bit per channel).
/// Tolerance accounts for floating-point conversion from hex → CGFloat.
private func assertColorMatchesHex(
    _ color: SwiftUI.Color,
    hex: UInt32,
    tolerance: CGFloat = 0.005,
    sourceLocation: SourceLocation = #_sourceLocation
) {
    let expectedR = CGFloat((hex >> 16) & 0xFF) / 255.0
    let expectedG = CGFloat((hex >> 8) & 0xFF) / 255.0
    let expectedB = CGFloat(hex & 0xFF) / 255.0

    let resolved = color.resolve(in: .init())

    #expect(
        abs(CGFloat(resolved.red) - expectedR) < tolerance
            && abs(CGFloat(resolved.green) - expectedG) < tolerance
            && abs(CGFloat(resolved.blue) - expectedB) < tolerance,
        """
        Color mismatch for #\(String(hex, radix: 16, uppercase: true)):
        expected RGB(\(expectedR), \(expectedG), \(expectedB))
        got      RGB(\(resolved.red), \(resolved.green), \(resolved.blue))
        """,
        sourceLocation: sourceLocation
    )
}

// MARK: - Color token tests

@Suite("DesignTokens — color values match web design-tokens.css")
struct DesignTokensColorTests {

    @Test("Surface colors")
    func surfaceColors() {
        assertColorMatchesHex(DesignTokens.bgBase, hex: 0xFDFBF8)
        assertColorMatchesHex(DesignTokens.bgSurface, hex: 0xF5F1EB)
        assertColorMatchesHex(DesignTokens.bgElevated, hex: 0xFFFFFF)
        assertColorMatchesHex(DesignTokens.bgHover, hex: 0xEDE8DF)
        assertColorMatchesHex(DesignTokens.bgActive, hex: 0xE5DED4)
    }

    @Test("Text colors")
    func textColors() {
        assertColorMatchesHex(DesignTokens.textPrimary, hex: 0x2D210F)
        assertColorMatchesHex(DesignTokens.textSecondary, hex: 0x7B6D59)
        assertColorMatchesHex(DesignTokens.textTertiary, hex: 0xA19383)
    }

    @Test("Border colors")
    func borderColors() {
        assertColorMatchesHex(DesignTokens.border, hex: 0xD8CFC2)
        assertColorMatchesHex(DesignTokens.borderSubtle, hex: 0xECE5D9)
    }

    @Test("Accent colors")
    func accentColors() {
        assertColorMatchesHex(DesignTokens.accent, hex: 0xB07A30)
        assertColorMatchesHex(DesignTokens.accentText, hex: 0x8D6226)
    }

    @Test("Accent subtle is accent at ~9% opacity (matches web #B07A3018)")
    func accentSubtle() {
        let resolved = DesignTokens.accentSubtle.resolve(in: .init())
        let tolerance: Float = 0.01
        #expect(abs(resolved.red - Float(0xB0) / 255.0) < tolerance)
        #expect(abs(resolved.green - Float(0x7A) / 255.0) < tolerance)
        #expect(abs(resolved.blue - Float(0x30) / 255.0) < tolerance)
        #expect(abs(resolved.opacity - Float(0x18) / 255.0) < tolerance)
    }

    @Test("Canvas colors")
    func canvasColors() {
        assertColorMatchesHex(DesignTokens.canvasBg, hex: 0xF0ECE5)
    }
}

// MARK: - Sizing token tests

@Suite("DesignTokens — sizing values match PRD spec")
struct DesignTokensSizingTests {

    @Test("Button size is 44pt (Apple HIG touch target)")
    func buttonSize() {
        #expect(DesignTokens.btnSize == 44)
    }

    @Test("Left toolbar width is 44pt")
    func leftToolbarWidth() {
        #expect(DesignTokens.leftToolbarWidth == 44)
    }

    @Test("Right panel width is 220pt")
    func rightPanelWidth() {
        #expect(DesignTokens.rightPanelWidth == 220)
    }

    @Test("Small border radius matches web --ds-radius-sm: 6px")
    func radiusSm() {
        #expect(DesignTokens.radiusSm == 6)
    }

    @Test("Border radius matches web --ds-radius-md: 12px")
    func radiusMd() {
        #expect(DesignTokens.radiusMd == 12)
    }

    @Test("Font size matches web --ds-font-size-md: 13px")
    func fontSize() {
        #expect(DesignTokens.fontSize == 13)
    }

    @Test("Icon size is 18pt")
    func iconSize() {
        #expect(DesignTokens.iconSize == 18)
    }

    @Test("Disabled opacity matches web .action-btn:disabled opacity: 0.4")
    func disabledOpacity() {
        #expect(DesignTokens.disabledOpacity == 0.4)
    }
}
