import SwiftUI

/// Button style matching the web's `PebbleButton` component.
/// 40×40 rounded icon button with acorn brown active state.
struct PebbleButtonStyle: ButtonStyle {
    var isActive: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        let isPressed = configuration.isPressed

        configuration.label
            .font(.system(size: PebbleTokens.iconSize))
            .frame(width: PebbleTokens.btnSize, height: PebbleTokens.btnSize)
            .foregroundStyle(isActive ? .white : PebbleTokens.textSecondary)
            .background(
                isActive
                    ? (isPressed ? PebbleTokens.accentDark : PebbleTokens.accent)
                    : (isPressed ? PebbleTokens.btnBgHover : PebbleTokens.btnBg)
            )
            .clipShape(RoundedRectangle(cornerRadius: PebbleTokens.btnRadius))
            .shadow(
                color: isActive ? PebbleTokens.accent.opacity(0.3) : .black.opacity(0.06),
                radius: isActive ? 4 : 3,
                x: 0,
                y: isActive ? 2 : 1
            )
    }
}
