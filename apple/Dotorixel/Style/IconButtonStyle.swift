import SwiftUI

/// Icon button style for TopBar and general icon buttons.
/// No background by default, subtle background on hover/press.
struct IconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: DesignTokens.iconSize))
            .frame(width: DesignTokens.btnSize, height: DesignTokens.btnSize)
            .foregroundStyle(DesignTokens.textPrimary)
            .background(
                configuration.isPressed ? DesignTokens.bgActive : SwiftUI.Color.clear
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusMd))
    }
}
