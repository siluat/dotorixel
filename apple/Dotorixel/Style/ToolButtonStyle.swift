import SwiftUI

/// 44×44pt button style for LeftToolbar tool and undo/redo buttons.
/// Active state uses accent color background with white foreground.
struct ToolButtonStyle: ButtonStyle {
    var isActive: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        let isPressed = configuration.isPressed

        configuration.label
            .font(.system(size: DesignTokens.iconSize))
            .frame(width: DesignTokens.btnSize, height: DesignTokens.btnSize)
            .foregroundStyle(isActive ? .white : DesignTokens.textSecondary)
            .background(
                isActive
                    ? (isPressed ? DesignTokens.accentText : DesignTokens.accent)
                    : (isPressed ? DesignTokens.bgActive : SwiftUI.Color.clear)
            )
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusMd))
    }
}
