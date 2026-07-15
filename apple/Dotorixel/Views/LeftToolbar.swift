import SwiftUI

/// Left toolbar — tool selection (pencil/eraser) and undo/redo controls.
struct LeftToolbar: View {
    let editorState: EditorState
    let tier: LayoutTier

    /// Strip edge padding — web LeftToolbar padding: 6px 0 (raw CSS, not a token).
    private let stripEdgePadding: CGFloat = 6

    var body: some View {
        // Strip width tracks the tool-button hit box (44pt wide / 48pt x-wide), so
        // both derive from one tier-dependent value — mirroring the web toolbar.
        let boxSize = DesignTokens.leftToolbarWidth(tier)

        VStack(spacing: DesignTokens.space1) {
            // MARK: - Tool buttons

            ForEach(EditorTool.allCases, id: \.self) { tool in
                Button {
                    editorState.activeTool = tool
                } label: {
                    Image(systemName: tool.symbolName)
                        .font(.system(size: DesignTokens.iconSize))
                }
                .buttonStyle(ToolButtonStyle(isActive: editorState.activeTool == tool, boxSize: boxSize))
            }

            // MARK: - Separator

            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(width: 28, height: 1)
                .padding(.vertical, DesignTokens.space1)

            // MARK: - Action buttons (undo/redo)

            Button {
                editorState.handleUndo()
            } label: {
                Image(systemName: "arrow.uturn.backward")
                    .font(.system(size: 16))
            }
            .buttonStyle(ToolButtonStyle(tint: DesignTokens.textTertiary, boxSize: boxSize))
            .disabled(!editorState.canUndo)

            Button {
                editorState.handleRedo()
            } label: {
                Image(systemName: "arrow.uturn.forward")
                    .font(.system(size: 16))
            }
            .buttonStyle(ToolButtonStyle(tint: DesignTokens.textTertiary, boxSize: boxSize))
            .disabled(!editorState.canRedo)

            Spacer()
        }
        .padding(.vertical, stripEdgePadding)
        .frame(width: boxSize)
        .frame(maxHeight: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(width: 1)
        }
    }
}
