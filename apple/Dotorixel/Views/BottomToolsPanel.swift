import SwiftUI

/// Bottom-center tools panel: Pen/Eraser toggle + Zoom controls.
/// Matches the web's `BottomToolsPanel` component.
struct BottomToolsPanel: View {
    @Bindable var editorState: EditorState

    var body: some View {
        FloatingPanel(cornerRadius: PebbleTokens.panelRadiusLg, horizontalPadding: 20) {
            HStack(spacing: 8) {
                // Pencil
                Button {
                    editorState.activeTool = .pencil
                } label: {
                    Image(systemName: "pencil")
                }
                .buttonStyle(PebbleButtonStyle(isActive: editorState.activeTool == .pencil))

                // Eraser
                Button {
                    editorState.activeTool = .eraser
                } label: {
                    Image(systemName: "eraser")
                }
                .buttonStyle(PebbleButtonStyle(isActive: editorState.activeTool == .eraser))

                separator

                // Zoom Out
                Button {
                    editorState.handleZoomOut()
                } label: {
                    Image(systemName: "minus.magnifyingglass")
                }
                .buttonStyle(PebbleButtonStyle())

                // Zoom label — tap to fit canvas
                Text("\(editorState.zoomPercent)%")
                    .font(.system(size: PebbleTokens.fontSize))
                    .foregroundStyle(PebbleTokens.textSecondary)
                    .frame(minWidth: 44)
                    .monospacedDigit()
                    .onTapGesture {
                        editorState.handleFit()
                    }

                // Zoom In
                Button {
                    editorState.handleZoomIn()
                } label: {
                    Image(systemName: "plus.magnifyingglass")
                }
                .buttonStyle(PebbleButtonStyle())
            }
            .frame(height: 40)
        }
    }

    private var separator: some View {
        Rectangle()
            .fill(PebbleTokens.panelBorder)
            .frame(width: 1, height: 28)
            .padding(.horizontal, 4)
    }
}
