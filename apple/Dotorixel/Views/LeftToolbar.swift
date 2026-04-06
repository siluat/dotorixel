import SwiftUI

/// Left toolbar — tool selection (pencil/eraser) and undo/redo controls.
struct LeftToolbar: View {
    let editorState: EditorState

    var body: some View {
        VStack(spacing: 2) {
            // MARK: - Tool buttons

            Button {
                editorState.activeTool = .pencil
            } label: {
                Image(systemName: "pencil")
                    .font(.system(size: DesignTokens.iconSize))
            }
            .buttonStyle(ToolButtonStyle(isActive: editorState.activeTool == .pencil))

            Button {
                editorState.activeTool = .eraser
            } label: {
                Image(systemName: "eraser")
                    .font(.system(size: DesignTokens.iconSize))
            }
            .buttonStyle(ToolButtonStyle(isActive: editorState.activeTool == .eraser))

            // MARK: - Separator

            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(width: 28, height: 1)
                .padding(.vertical, 2)

            // MARK: - Action buttons (undo/redo)

            Button {
                editorState.handleUndo()
            } label: {
                Image(systemName: "arrow.uturn.backward")
                    .font(.system(size: 16))
            }
            .buttonStyle(ToolButtonStyle(tint: DesignTokens.textTertiary))
            .disabled(!editorState.canUndo)

            Button {
                editorState.handleRedo()
            } label: {
                Image(systemName: "arrow.uturn.forward")
                    .font(.system(size: 16))
            }
            .buttonStyle(ToolButtonStyle(tint: DesignTokens.textTertiary))
            .disabled(!editorState.canRedo)

            Spacer()
        }
        .padding(.vertical, 6)
        .frame(width: DesignTokens.leftToolbarWidth)
        .frame(maxHeight: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(width: 1)
        }
    }
}
