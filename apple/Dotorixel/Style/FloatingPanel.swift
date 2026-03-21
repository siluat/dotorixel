import SwiftUI

/// Pill-shaped translucent panel matching the web's `FloatingPanel` component.
struct FloatingPanel<Content: View>: View {
    var cornerRadius: CGFloat = PebbleTokens.panelRadius
    var horizontalPadding: CGFloat = 16
    var verticalPadding: CGFloat = 10
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(.horizontal, horizontalPadding)
            .padding(.vertical, verticalPadding)
            .background(PebbleTokens.panelBg)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(PebbleTokens.panelBorder, lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.07), radius: 8, x: 0, y: 2)
    }
}
