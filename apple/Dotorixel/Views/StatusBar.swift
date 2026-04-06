import SwiftUI

/// Status bar placeholder — canvas dimensions, active tool name.
/// Contents will be implemented in issue 019.
struct StatusBar: View {
    let editorState: EditorState

    var body: some View {
        HStack {
            Spacer()
        }
        .frame(height: 28)
        .frame(maxWidth: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(DesignTokens.border)
                .frame(height: 1)
        }
    }
}
