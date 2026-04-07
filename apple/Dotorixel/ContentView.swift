import SwiftUI

/// Main editor view using a docked layout matching the web editor's structure.
///
/// VStack + HStack layout with four named regions:
/// - TopBar (top, full width)
/// - LeftToolbar (left, fixed width)
/// - Canvas area (center, fills remaining space)
/// - RightPanel (right, fixed width)
/// - StatusBar (bottom, full width)
struct ContentView: View {
    @State private var editorState = EditorState()
    @Environment(\.displayScale) private var displayScale
    #if DEBUG
    @State private var showBenchmark = false
    #endif

    var body: some View {
        // Read @Observable properties at ContentView scope so SwiftUI tracks
        // them outside GeometryReader — ensures updateNSView fires on change.
        let viewport = editorState.viewport
        let showGrid = editorState.showGrid
        let canvasVersion = editorState.canvasVersion

        VStack(spacing: 0) {
            TopBar(editorState: editorState)

            HStack(spacing: 0) {
                LeftToolbar(editorState: editorState)

                GeometryReader { geo in
                    PixelCanvasView(
                        pixelCanvas: editorState.pixelCanvas,
                        viewport: viewport,
                        showGrid: showGrid,
                        editorState: editorState,
                        canvasVersion: canvasVersion
                    )
                    .onAppear { fitCanvas(in: geo.size) }
                    .onChange(of: geo.size) { _, newSize in fitCanvas(in: newSize) }
                }

                RightPanel(editorState: editorState)
            }

            StatusBar(editorState: editorState)
        }
        .background(DesignTokens.bgBase)
        #if DEBUG
        .sheet(isPresented: $showBenchmark) {
            RenderBenchmarkView()
        }
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button("Benchmark") {
                    showBenchmark = true
                }
                .font(.caption)
            }
        }
        #endif
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
