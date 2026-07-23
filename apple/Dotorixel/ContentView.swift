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
                        // Pencil hover preview: highlights the target cell
                        // while the Apple Pencil hovers (issue 253). Below the
                        // loupe so an active sampling stroke's magnifier wins.
                        .overlay(alignment: .topLeading) {
                            HoverHighlightOverlay(editorState: editorState, displayScale: displayScale)
                        }
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

    /// Isolates the hover highlight's observable reads (Hover Point + viewport)
    /// from `ContentView`'s body, the same way `SamplingLoupeOverlay` does — so
    /// per-move hover updates re-render only this overlay, not the Metal-backed
    /// canvas view underneath.
    private struct HoverHighlightOverlay: View {
        let editorState: EditorState
        let displayScale: CGFloat

        // The target cell is outlined twice so it reads on any pixel color: a
        // white halo behind a thinner accent line. The halo must stay wider
        // than the outline for the two-tone edge to show.
        private let haloWidth: CGFloat = 2
        private let outlineWidth: CGFloat = 1
        private let haloOpacity: Double = 0.85

        var body: some View {
            // Non-nil only while the pencil hovers over an in-bounds cell —
            // EditorState owns that visibility contract; this view just draws.
            if let cell = editorState.hoverPoint {
                let rect = cellRect(cell, viewport: editorState.viewport)
                Rectangle()
                    .strokeBorder(SwiftUI.Color.white.opacity(haloOpacity), lineWidth: haloWidth)
                    .overlay {
                        Rectangle().strokeBorder(DesignTokens.accent, lineWidth: outlineWidth)
                    }
                    .frame(width: rect.width, height: rect.height)
                    .offset(x: rect.minX, y: rect.minY)
                    .allowsHitTesting(false)
            }
        }

        /// Maps a canvas cell to its display rect in canvas-area points. The
        /// viewport transform places a cell at `round(pan) + cell × eps` device
        /// pixels (the inverse of `screenToCanvas`); dividing by the display
        /// scale converts to the points the overlay is laid out in, so pan and
        /// zoom reposition the highlight for free.
        private func cellRect(_ cell: ScreenCanvasCoords, viewport: AppleViewport) -> CGRect {
            let eps = viewport.effectivePixelSize()
            let deviceX = viewport.panX().rounded() + Double(cell.x) * eps
            let deviceY = viewport.panY().rounded() + Double(cell.y) * eps
            return CGRect(
                x: deviceX / displayScale,
                y: deviceY / displayScale,
                width: eps / displayScale,
                height: eps / displayScale
            )
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
