import SwiftUI

/// Right panel placeholder — canvas settings, color palette.
/// Contents will be implemented in issue 018.
struct RightPanel: View {
    let editorState: EditorState

    var body: some View {
        VStack {
            Spacer()
        }
        .frame(width: DesignTokens.rightPanelWidth)
        .frame(maxHeight: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(DesignTokens.border)
                .frame(width: 1)
        }
    }
}
