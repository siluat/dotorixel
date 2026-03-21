import SwiftUI

/// Top-left floating panel: Undo, Redo, Grid toggle.
/// Matches the web's `TopControlsLeft` component.
struct TopControlsLeft: View {
    @Bindable var editorState: EditorState

    var body: some View {
        FloatingPanel {
            HStack(spacing: 8) {
                // Undo (disabled — future task)
                Button {} label: {
                    Image(systemName: "arrow.uturn.backward")
                }
                .buttonStyle(PebbleButtonStyle())
                .disabled(true)
                .opacity(0.4)

                // Redo (disabled — future task)
                Button {} label: {
                    Image(systemName: "arrow.uturn.forward")
                }
                .buttonStyle(PebbleButtonStyle())
                .disabled(true)
                .opacity(0.4)

                // Grid toggle
                Button {
                    editorState.showGrid.toggle()
                } label: {
                    Image(systemName: "grid")
                }
                .buttonStyle(PebbleButtonStyle(isActive: editorState.showGrid))
            }
        }
    }
}
