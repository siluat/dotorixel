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
    /// The keep/discard flow whose dialog and browser sheets present here,
    /// over the whole docked layout (web parity: the page-level modals).
    let saveFlow: SaveFlow
    @Environment(\.displayScale) private var displayScale
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    #if DEBUG
    @State private var showBenchmark = false
    #endif

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
                TopBar(workspace: workspace, saveFlow: saveFlow, tier: tier)

                TabStrip(workspace: workspace, saveFlow: saveFlow)

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
                            .onAppear { presentActiveTab(in: geo.size) }
                            .onChange(of: geo.size) { _, newSize in presentActiveTab(in: newSize) }
                            .onChange(of: tab.documentId) { _, _ in presentActiveTab(in: geo.size) }
                            // Marching-ants Marquee overlay: tracks zoom/pan
                            // above the Metal canvas, below the hover highlight
                            // and loupe (the transient aids win).
                            .overlay(alignment: .topLeading) {
                                MarqueeOverlay(tab: tab, displayScale: displayScale)
                            }
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
                        // and its `onChange(of: geo.size)` re-presents the
                        // viewport whenever the panel collapses or expands —
                        // a fitted tab keeps its zoom, the pan reclamps.
                        TimelinePanel(tab: tab)
                    }

                    RightPanel(workspace: workspace, tier: tier)
                }

                StatusBar(workspace: workspace, tier: tier)
            }
            .background(DesignTokens.bgBase)
            .sheet(isPresented: isSaveDialogPresented) {
                if let pending = saveFlow.pendingSave {
                    SaveDialog(
                        documentName: pending.documentName,
                        onSave: { name in Task { await saveFlow.confirmSave(name: name) } },
                        onDelete: { Task { await saveFlow.confirmDelete() } },
                        onCancel: { saveFlow.cancelSave() }
                    )
                    // The name field must not feed the app-level shortcut
                    // monitor (the canvas-size fields' contract).
                    .onAppear { workspace.isTextInputFocused = true }
                    .onDisappear { workspace.isTextInputFocused = false }
                }
            }
            .sheet(isPresented: isSavedWorkBrowserPresented) {
                if let documents = saveFlow.browserDocuments {
                    SavedWorkBrowser(
                        documents: documents,
                        onSelect: { id in Task { await saveFlow.selectSavedDocument(id: id) } },
                        onDelete: { id in Task { await saveFlow.deleteSavedDocument(id: id) } },
                        onClose: { saveFlow.closeBrowser() }
                    )
                }
            }
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

    /// Presentation bindings over the flow's modal state: dismissing a sheet
    /// (swipe, Escape) resolves as that surface's cancel/close.
    private var isSaveDialogPresented: Binding<Bool> {
        Binding(
            get: { saveFlow.pendingSave != nil },
            set: { if !$0 { saveFlow.cancelSave() } }
        )
    }

    private var isSavedWorkBrowserPresented: Binding<Bool> {
        Binding(
            get: { saveFlow.browserDocuments != nil },
            set: { if !$0 { saveFlow.closeBrowser() } }
        )
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

    /// Presents the active tab in the canvas area — the workspace fits a
    /// tab the first time it is shown and preserves its zoom/pan (pan
    /// reclamped) ever after. This wrapper only converts the area's point
    /// size to the device pixels the viewport math runs in (the Metal
    /// renderer uses `drawableSize`: points × scale).
    private func presentActiveTab(in pointSize: CGSize) {
        workspace.presentActiveTab(in: ViewportSize(
            width: pointSize.width * displayScale,
            height: pointSize.height * displayScale
        ))
    }
}
