import SwiftUI

/// 44×44pt button style for LeftToolbar buttons.
///
/// Active state uses semi-transparent accent background (`accentSubtle`) with
/// accent foreground — matching the web's `.tool-btn.active` treatment.
/// The `tint` parameter controls inactive foreground color, allowing tool buttons
/// (`textSecondary`) and action buttons (`textTertiary`) to share one style.
struct ToolButtonStyle: ButtonStyle {
    var isActive: Bool = false
    var tint: SwiftUI.Color = DesignTokens.textSecondary
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let isPressed = configuration.isPressed
        // Visual size matches web's .tool-btn 36×36; outer frame keeps 44pt touch target
        let visualSize: CGFloat = 36

        configuration.label
            .frame(width: visualSize, height: visualSize)
            .foregroundStyle(isActive ? DesignTokens.accent : tint)
            .background(background(isPressed: isPressed))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
            .frame(width: DesignTokens.btnSize, height: DesignTokens.btnSize)
            .contentShape(Rectangle())
            .opacity(isEnabled ? 1.0 : DesignTokens.disabledOpacity)
    }

    private func background(isPressed: Bool) -> SwiftUI.Color {
        if isActive {
            return DesignTokens.accentSubtle
        }
        return isPressed ? DesignTokens.bgActive : .clear
    }
}
