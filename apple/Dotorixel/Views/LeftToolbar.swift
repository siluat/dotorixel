import SwiftUI

/// Left toolbar placeholder — tool buttons, undo/redo.
/// Contents will be implemented in issue 016.
struct LeftToolbar: View {
    let editorState: EditorState

    var body: some View {
        VStack {
            Spacer()
        }
        .frame(width: DesignTokens.leftToolbarWidth)
        .frame(maxHeight: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(DesignTokens.border)
                .frame(width: 1)
        }
    }
}
