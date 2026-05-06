import SwiftUI

/// Status bar — canvas dimensions on the left, active tool name on the right.
/// Pure display view; mirrors web `StatusBar.svelte`.
struct StatusBar: View {
    let editorState: EditorState

    var body: some View {
        HStack {
            Text("\(editorState.pixelCanvas.width()) × \(editorState.pixelCanvas.height())")
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textSecondary)
            Spacer()
            Text(editorState.activeTool.displayName)
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textTertiary)
        }
        .padding(.horizontal, 16)
        .frame(height: 28)
        .frame(maxWidth: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(height: 1)
        }
    }
}
