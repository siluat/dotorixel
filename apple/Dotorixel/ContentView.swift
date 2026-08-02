import SwiftUI

/// Main editor view using a docked layout matching the web editor's structure.
///
/// A canvas area that fills the remaining space, ringed by five chrome regions:
/// - TopBar (top, full width)
/// - LeftToolbar (left, fixed width)
/// - TimelinePanel (below the canvas, spanning the canvas column only)
/// - RightPanel (right, fixed width)
/// - StatusBar (bottom, full width)
struct ContentView: View {
    // Owned by DotorixelApp so the Edit-menu commands share it.
    let workspace: Workspace
    @Environment(\.displayScale) private var displayScale
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    #if DEBUG
    @State private var showBenchmark = false
    #endif

    /// Tabs whose canvas has been fitted once (web parity: `fittedTabs` in
    /// `+page.svelte`) — a revisited tab keeps its own zoom/pan instead of
    /// refitting. Keyed by `documentId`; ids of closed tabs linger harmlessly
    /// (they are never reused).
    @State private var fittedTabIds: Set<String> = []

    var body: some View {
        // Read @Observable properties at ContentView scope so SwiftUI tracks
        // them outside GeometryReader — ensures updateNSView fires on change.
        let tab = workspace.activeTab
        let viewport = tab.viewport
        let showGrid = tab.showGrid
        let canvasVersion = tab.canvasVersion
        let isTextInputFocused = workspace.isTextInputFocused

        GeometryReader { rootGeo in
            let tier = LayoutTier.resolve(
                availableWidth: rootGeo.size.width,
                horizontalSizeClass: horizontalSizeClass
            )
            VStack(spacing: 0) {
                TopBar(workspace: workspace, tier: tier)

                TabStrip(workspace: workspace)

                HStack(spacing: 0) {
                    LeftToolbar(workspace: workspace, tier: tier)

                    VStack(spacing: 0) {
                        GeometryReader { geo in
                            PixelCanvasView(
                                document: tab.document,
                                viewport: viewport,
                                showGrid: showGrid,
                                workspace: workspace,
                                canvasVersion: canvasVersion,
                                isTextInputFocused: isTextInputFocused
                            )
                            .onAppear { fitCanvas(in: geo.size) }
                            .onChange(of: geo.size) { _, newSize in fitCanvas(in: newSize) }
                            .onChange(of: tab.documentId) { _, _ in showActiveTab(in: geo.size) }
                            // Pencil hover preview: highlights the target cell
                            // while the Apple Pencil hovers (issue 253). Below the
                            // loupe so an active sampling stroke's magnifier wins.
                            .overlay(alignment: .topLeading) {
                                HoverHighlightOverlay(tab: tab, displayScale: displayScale)
                            }
                            // Sampling loupe: floats over the canvas area while an
                            // eyedropper stroke is active.
                            .overlay(alignment: .topLeading) {
                                SamplingLoupeOverlay(loupe: tab.samplingLoupe)
                            }
                        }

                        // Docked to the canvas column only — the toolbar and
                        // right panel run full height beside it, matching the
                        // web grid's `toolbar timeline panel` row. The canvas
                        // `GeometryReader` above shrinks by the panel's height,
                        // and its `onChange(of: geo.size)` refits the viewport
                        // whenever the panel collapses or expands.
                        TimelinePanel(tab: tab)
                    }

                    RightPanel(workspace: workspace, tier: tier)
                }

                StatusBar(workspace: workspace, tier: tier)
            }
            .background(DesignTokens.bgBase)
            #if os(macOS)
            // App-level key capture (letters, ⌘Y, Alt) — see the modifier
            // for the ownership split with the Edit-menu commands.
            .modifier(ShortcutKeyMonitorModifier(workspace: workspace))
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
        let tab: TabState
        let displayScale: CGFloat

        // The target cell is outlined twice so it reads on any pixel color: a
        // white halo behind a thinner accent line. The halo must stay wider
        // than the outline for the two-tone edge to show.
        private let haloWidth: CGFloat = 2
        private let outlineWidth: CGFloat = 1
        private let haloOpacity: Double = 0.85

        var body: some View {
            // Non-nil only while the pencil hovers over an in-bounds cell —
            // the tab owns that visibility contract; this view just draws.
            if let cell = tab.hoverPoint {
                let rect = cellRect(cell, viewport: tab.viewport)
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

    /// Presents the newly activated tab in the canvas area: adopts the
    /// area's device size, fitting only the first time a tab is shown — a
    /// revisited tab keeps its own zoom/pan, reclamped against the current
    /// area (web parity: `initTabViewport` in `+page.svelte`).
    private func showActiveTab(in pointSize: CGSize) {
        let tab = workspace.activeTab
        if fittedTabIds.contains(tab.documentId) {
            tab.viewportSize = deviceSize(of: pointSize)
            tab.handleViewportChange(tab.viewport)
        } else {
            fitCanvas(in: pointSize)
        }
    }

    /// Fits and centers the canvas within the available view area.
    private func fitCanvas(in pointSize: CGSize) {
        let tab = workspace.activeTab
        fittedTabIds.insert(tab.documentId)
        tab.viewportSize = deviceSize(of: pointSize)
        tab.viewport = tab.viewport.fitToViewport(
            canvasWidth: tab.document.width(),
            canvasHeight: tab.document.height(),
            viewportSize: tab.viewportSize
        )
    }

    /// Converts the canvas area's point size to device pixels — the Metal
    /// renderer and the viewport math use `drawableSize` (points × scale),
    /// not SwiftUI points.
    private func deviceSize(of pointSize: CGSize) -> ViewportSize {
        ViewportSize(
            width: pointSize.width * displayScale,
            height: pointSize.height * displayScale
        )
    }
}
