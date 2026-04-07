import SwiftUI

/// Icon button style for TopBar and general icon buttons.
/// No background by default, subtle background on hover, stronger on press.
struct IconButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        IconButtonBody(configuration: configuration, isEnabled: isEnabled)
    }
}

/// Extracted body view so `@State` (hover tracking) works inside `ButtonStyle`.
private struct IconButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let isEnabled: Bool
    @State private var isHovered = false

    var body: some View {
        configuration.label
            .font(.system(size: DesignTokens.iconSize))
            .frame(width: DesignTokens.btnSize, height: DesignTokens.btnSize)
            .foregroundStyle(DesignTokens.textPrimary)
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusMd))
            .opacity(isEnabled ? 1.0 : DesignTokens.disabledOpacity)
            .onHover { isHovered = $0 }
    }

    private var background: SwiftUI.Color {
        if configuration.isPressed { return DesignTokens.bgActive }
        if isHovered { return DesignTokens.bgHover }
        return .clear
    }
}
