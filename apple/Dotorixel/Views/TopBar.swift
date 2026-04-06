import SwiftUI

/// Top bar placeholder — app identity, zoom controls, grid toggle, export.
/// Contents will be implemented in issue 017.
struct TopBar: View {
    let editorState: EditorState

    var body: some View {
        HStack {
            Spacer()
        }
        .frame(height: 44)
        .frame(maxWidth: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(DesignTokens.border)
                .frame(height: 1)
        }
    }
}
