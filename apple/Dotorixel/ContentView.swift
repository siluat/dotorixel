import SwiftUI

/// Main editor view matching the web's Pebble UI layout.
///
/// Full-screen canvas with floating overlay panels:
/// - Top-left: Undo, Redo, Grid toggle
/// - Top-right: Canvas size presets, W×H inputs, Export, Clear
/// - Bottom-center: Tools (Pen/Eraser, Zoom) + Color palette
struct ContentView: View {
    @State private var editorState = EditorState()
    @Environment(\.displayScale) private var displayScale

    var body: some View {
        ZStack {
            // Full-screen Metal canvas
            GeometryReader { geo in
                PixelCanvasView(
                    pixelCanvas: editorState.pixelCanvas,
                    viewport: editorState.viewport,
                    showGrid: editorState.showGrid,
                    editorState: editorState,
                    canvasVersion: editorState.canvasVersion
                )
                .onAppear { fitCanvas(in: geo.size) }
                .onChange(of: geo.size) { _, newSize in fitCanvas(in: newSize) }
            }

            // Top-left controls
            TopControlsLeft(editorState: editorState)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .padding(PebbleTokens.edgeGap)

            // Top-right controls
            TopControlsRight(editorState: editorState)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                .padding(PebbleTokens.edgeGap)

            // Bottom-center: Tools + Color palette
            HStack(spacing: 10) {
                BottomToolsPanel(editorState: editorState)
                BottomColorPalette(editorState: editorState)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .padding(PebbleTokens.edgeGap)
        }
        .background(PebbleTokens.bg)
    }

    /// Fits and centers the canvas within the available view area.
    /// Multiplies by `displayScale` because the Metal renderer uses `drawableSize`
    /// (device pixels), not SwiftUI points.
    private func fitCanvas(in pointSize: CGSize) {
        let deviceSize = ViewportSize(
            width: pointSize.width * displayScale,
            height: pointSize.height * displayScale
        )
        editorState.viewportSize = deviceSize
        editorState.viewport = editorState.viewport.fitToViewport(
            canvasWidth: editorState.pixelCanvas.width(),
            canvasHeight: editorState.pixelCanvas.height(),
            viewportSize: deviceSize
        )
    }
}
