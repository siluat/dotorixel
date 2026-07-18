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
    // Owned by DotorixelApp so the Edit-menu commands share it.
    let editorState: EditorState
    @Environment(\.displayScale) private var displayScale
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    #if DEBUG
    @State private var showBenchmark = false
    #endif

    var body: some View {
        // Read @Observable properties at ContentView scope so SwiftUI tracks
        // them outside GeometryReader — ensures updateNSView fires on change.
        let viewport = editorState.viewport
        let showGrid = editorState.showGrid
        let canvasVersion = editorState.canvasVersion
        let isTextInputFocused = editorState.isTextInputFocused

        GeometryReader { rootGeo in
            let tier = LayoutTier.resolve(
                availableWidth: rootGeo.size.width,
                horizontalSizeClass: horizontalSizeClass
            )
            VStack(spacing: 0) {
                TopBar(editorState: editorState, tier: tier)

                HStack(spacing: 0) {
                    LeftToolbar(editorState: editorState, tier: tier)

                    GeometryReader { geo in
                        PixelCanvasView(
                            pixelCanvas: editorState.pixelCanvas,
                            viewport: viewport,
                            showGrid: showGrid,
                            editorState: editorState,
                            canvasVersion: canvasVersion,
                            isTextInputFocused: isTextInputFocused
                        )
                        .onAppear { fitCanvas(in: geo.size) }
                        .onChange(of: geo.size) { _, newSize in fitCanvas(in: newSize) }
                        // Sampling loupe: floats over the canvas area while an
                        // eyedropper stroke is active.
                        .overlay(alignment: .topLeading) {
                            SamplingLoupeOverlay(loupe: editorState.samplingLoupe)
                        }
                    }

                    RightPanel(editorState: editorState, tier: tier)
                }

                StatusBar(editorState: editorState, tier: tier)
            }
            .background(DesignTokens.bgBase)
            #if os(macOS)
            // App-level key capture (letters, ⌘Y, Alt) — see the modifier
            // for the ownership split with the Edit-menu commands.
            .modifier(ShortcutKeyMonitorModifier(editorState: editorState))
            #endif
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
    }

    /// Isolates the loupe's observable reads from `ContentView`'s body:
    /// pointer-rate grid/position updates re-render only this overlay, not
    /// the Metal-backed canvas view underneath (whose update path re-uploads
    /// the canvas texture).
    private struct SamplingLoupeOverlay: View {
        let loupe: SamplingLoupeState

        var body: some View {
            // `position` is already flipped/clamped to the canvas-area
            // bounds; nil while no sampling stroke is active.
            if let position = loupe.position {
                LoupeView(grid: loupe.grid)
                    .offset(x: position.x, y: position.y)
                    .allowsHitTesting(false)
            }
        }
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
