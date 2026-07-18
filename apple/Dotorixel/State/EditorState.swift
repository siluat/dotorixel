import SwiftUI

/// Central editor state shared across all views via `@Observable`.
///
/// Wraps UniFFI objects (`ApplePixelCanvas`, `AppleViewport`) and provides
/// SwiftUI-compatible properties. Since `ApplePixelCanvas` is a reference type
/// whose internal mutations are invisible to `@Observable`, the `canvasVersion`
/// counter must be incremented manually to trigger Metal re-renders.
@Observable
final class EditorState {
    var pixelCanvas: ApplePixelCanvas
    var viewport: AppleViewport
    let historyManager = AppleHistoryManager.defaultManager()
    var activeTool: EditorTool = .pencil
    var foregroundColor: Color
    var backgroundColor: Color
    var showGrid: Bool = true
    /// Pixel-perfect freehand mode (web default: on). Strokes snapshot the
    /// flag at begin, so toggling mid-stroke only affects the next stroke.
    var pixelPerfect: Bool = true

    /// Colors recently *used* to draw or sampled by the eyedropper —
    /// most-recent first. In-memory only for now; persistence arrives with
    /// Phase 4 (the web keeps this in the workspace snapshot).
    private(set) var recentColors: [Color] = []

    /// State behind the loupe overlay shown while an eyedropper stroke is
    /// active — see `StrokeSessionHost.samplingLoupe`.
    let samplingLoupe = SamplingLoupeState()

    /// Manually incremented to trigger SwiftUI updates when canvas pixels change.
    var canvasVersion: Int = 0
    private(set) var isDrawing: Bool = false

    /// Incremented when an edit resolves, and on undo/redo, to trigger
    /// `canUndo`/`canRedo` re-evaluation.
    /// Needed because `@Observable` cannot detect internal state changes in UniFFI objects.
    private(set) var historyVersion: Int = 0

    /// Current viewport dimensions in device pixels. Updated by ContentView on
    /// appear and resize; used by zoom/pan handlers for clamp_pan calculations.
    var viewportSize = ViewportSize(width: 0, height: 0)

    var canUndo: Bool {
        // Read to register @Observable dependency — actual state lives in UniFFI object
        _ = historyVersion
        return historyManager.canUndo()
    }

    var canRedo: Bool {
        // Read to register @Observable dependency — actual state lives in UniFFI object
        _ = historyVersion
        return historyManager.canRedo()
    }

    var zoomPercent: Int {
        Int(viewport.zoom() * 100)
    }

    init(
        width: UInt32 = 16,
        height: UInt32 = 16
    ) {
        self.pixelCanvas = try! ApplePixelCanvas(width: width, height: height)
        self.viewport = AppleViewport.forCanvas(canvasWidth: width, canvasHeight: height)
        // Web-matching defaults (shared-state.svelte.ts): foreground black, background white.
        self.foregroundColor = Color(r: 0x00, g: 0x00, b: 0x00, a: 0xFF)
        self.backgroundColor = Color(r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF)
    }

    // MARK: - Colors

    /// Exchanges the foreground and background colors.
    func swapColors() {
        let previousForeground = foregroundColor
        foregroundColor = backgroundColor
        backgroundColor = previousForeground
    }

    // MARK: - Stroke lifecycle

    /// Resolves the active tool into a per-stroke session and drives it.
    private let strokeEngine = StrokeEngine()

    /// Opens a stroke session from the active tool and feeds the first sample.
    /// The pointer button picks the stroke's draw color (primary → foreground,
    /// secondary → background); touch input is always primary.
    func beginStroke(at coords: ScreenCanvasCoords, button: PointerButton = .primary) {
        // A begin can arrive while a stroke is active (e.g. a second finger on
        // iPadOS). Close the previous stroke through the full cancel path so
        // its Edit Baseline resolves before the next session begins one.
        if isDrawing {
            cancelStroke()
        }
        isDrawing = true
        if strokeEngine.begin(tool: activeTool, host: self, button: button, at: coords) {
            canvasVersion += 1
        }
    }

    /// Feeds one pointer sample to the active stroke.
    func continueStroke(to coords: ScreenCanvasCoords) {
        if strokeEngine.sample(at: coords) {
            canvasVersion += 1
        }
    }

    /// Ends the active stroke, committing any deferred effect and resolving
    /// the stroke's undo entry.
    func endStroke() {
        if strokeEngine.end() {
            canvasVersion += 1
        }
        resolveEditBaseline()
        isDrawing = false
    }

    /// Cancels the active stroke after an interrupted pointer sequence
    /// (e.g. `touchesCancelled`), discarding any deferred effect. A cancel
    /// that restored the pre-stroke pixels resolves as a no-op and leaves
    /// History untouched.
    func cancelStroke() {
        if strokeEngine.cancel() {
            canvasVersion += 1
        }
        resolveEditBaseline()
        isDrawing = false
    }

    /// Resolves the pending Edit Baseline against the current canvas — the
    /// undo entry commits only when the edit actually changed pixels; a no-op
    /// edit leaves both stacks (including the redo future) untouched.
    ///
    /// Returns whether an undo entry was committed. Stroke paths discard it:
    /// they bump the re-render off the stroke engine's own signal, which also
    /// covers the preview a cancelled stroke must erase.
    @discardableResult
    private func resolveEditBaseline() -> Bool {
        let committed = historyManager.endEdit(
            currentWidth: pixelCanvas.width(),
            currentHeight: pixelCanvas.height(),
            currentPixels: pixelCanvas.pixels()
        )
        historyVersion += 1
        return committed
    }

    // MARK: - History

    /// Restores the previous canvas state from the history stack.
    /// No-ops silently while a drawing stroke is in progress.
    func handleUndo() {
        guard !isDrawing else { return }
        if let snapshot = historyManager.undo(currentWidth: pixelCanvas.width(), currentHeight: pixelCanvas.height(), currentPixels: pixelCanvas.pixels()) {
            applySnapshot(snapshot)
        }
    }

    /// Restores the next canvas state from the history stack.
    /// No-ops silently while a drawing stroke is in progress.
    func handleRedo() {
        guard !isDrawing else { return }
        if let snapshot = historyManager.redo(currentWidth: pixelCanvas.width(), currentHeight: pixelCanvas.height(), currentPixels: pixelCanvas.pixels()) {
            applySnapshot(snapshot)
        }
    }

    private func applySnapshot(_ snapshot: Snapshot) {
        guard snapshot.width == pixelCanvas.width(), snapshot.height == pixelCanvas.height() else {
            assertionFailure("Cross-dimension undo/redo not yet implemented on Apple")
            return
        }
        do {
            try pixelCanvas.restorePixels(data: snapshot.pixels)
            canvasVersion += 1
            historyVersion += 1
        } catch {
            assertionFailure("Failed to apply snapshot: \(error)")
        }
    }

    // MARK: - Canvas clear

    /// Erases every pixel to transparent, holding the pre-clear pixels as the
    /// Edit Baseline so undo restores the drawing. Clearing a canvas that is
    /// already blank changes nothing, so it records no entry, leaves the redo
    /// future intact, and skips the re-render.
    /// No-ops silently while a drawing stroke is in progress.
    func handleClearCanvas() {
        guard !isDrawing else { return }
        beginEdit()
        pixelCanvas.clear()
        if resolveEditBaseline() {
            canvasVersion += 1
        }
    }

    // MARK: - Canvas size

    /// Resizes the canvas to the given dimensions and reclamps the viewport pan
    /// against the new bounds. Silent no-op when dimensions are unchanged or
    /// outside `canvasMinDimension...canvasMaxDimension`.
    /// No-ops silently while a drawing stroke is in progress — a live session's
    /// pre-stroke snapshot belongs to the current canvas and must stay restorable.
    ///
    /// Clears history on a successful resize: `applySnapshot` rejects
    /// cross-dimension restores, so leaving pre-resize snapshots on the stack
    /// would surface as `canUndo == true` while the actual restore silently
    /// fails. Dropping the stack keeps `canUndo`/`canRedo` honest until
    /// cross-dimension undo lands.
    func resizeCanvas(width: UInt32, height: UInt32) {
        guard !isDrawing else { return }
        guard width != pixelCanvas.width() || height != pixelCanvas.height() else { return }
        guard let resized = try? pixelCanvas.resize(newWidth: width, newHeight: height) else { return }
        pixelCanvas = resized
        viewport = viewport.clampPan(
            canvasWidth: width,
            canvasHeight: height,
            viewportSize: viewportSize
        )
        historyManager.clear()
        historyVersion += 1
        canvasVersion += 1
    }

    // MARK: - Export

    /// Encodes the current canvas as a PNG export document at 1× scale
    /// (one canvas pixel per image pixel), matching the web's export convention.
    ///
    /// - Throws: `AppleError` when PNG encoding fails.
    func makePngExportDocument() throws -> PngExportDocument {
        PngExportDocument(data: try pixelCanvas.encodePng())
    }

    /// Default export filename following the web convention
    /// (`generateExportFilename` in `src/lib/canvas/export.ts`).
    /// The save flow offers it as the suggested name; the user may override it.
    var defaultExportFilename: String {
        "dotorixel-\(pixelCanvas.width())x\(pixelCanvas.height()).png"
    }

    // MARK: - Viewport

    /// Applies clamp_pan and updates the viewport. No canvasVersion bump needed —
    /// replacing the viewport reference triggers @Observable change detection.
    func handleViewportChange(_ newViewport: AppleViewport) {
        viewport = newViewport.clampPan(
            canvasWidth: pixelCanvas.width(),
            canvasHeight: pixelCanvas.height(),
            viewportSize: viewportSize
        )
    }

    func handleZoomIn() {
        let centerX = viewportSize.width / 2
        let centerY = viewportSize.height / 2
        let newZoom = viewportNextZoomLevel(currentZoom: viewport.zoom())
        let zoomed = viewport.zoomAtPoint(screenX: centerX, screenY: centerY, newZoom: newZoom)
        handleViewportChange(zoomed)
    }

    func handleZoomOut() {
        let centerX = viewportSize.width / 2
        let centerY = viewportSize.height / 2
        let newZoom = viewportPrevZoomLevel(currentZoom: viewport.zoom())
        let zoomed = viewport.zoomAtPoint(screenX: centerX, screenY: centerY, newZoom: newZoom)
        handleViewportChange(zoomed)
    }

    func handleZoomReset() {
        let centerX = viewportSize.width / 2
        let centerY = viewportSize.height / 2
        let zoomed = viewport.zoomAtPoint(screenX: centerX, screenY: centerY, newZoom: 1.0)
        handleViewportChange(zoomed)
    }

    func handleFit() {
        viewport = viewport.fitToViewport(
            canvasWidth: pixelCanvas.width(),
            canvasHeight: pixelCanvas.height(),
            viewportSize: viewportSize
        )
    }
}

// MARK: - StrokeSessionHost

extension EditorState: StrokeSessionHost {
    var isPixelPerfectEnabled: Bool { pixelPerfect }

    /// Holds the current canvas pixels as the pending Edit Baseline. The
    /// entry commits at stroke end only if the stroke changed the canvas —
    /// see `resolveEditBaseline()`.
    func beginEdit() {
        historyManager.beginEdit(
            width: pixelCanvas.width(),
            height: pixelCanvas.height(),
            pixels: pixelCanvas.pixels()
        )
    }

    /// Commits a sampled color to the given active-color slot. Not undoable —
    /// History stays untouched; the swatch updates via `@Observable`.
    /// A commit is a color *use*, so it also lands in the recent list
    /// (web parity: the sampling session folds both into its commit).
    func commitColorPick(_ color: Color, to target: ColorPickTarget) {
        switch target {
        case .foreground: foregroundColor = color
        case .background: backgroundColor = color
        }
        recordRecentColor(color)
    }

    /// Maximum entries in `recentColors` — web parity (`addRecentColor` in
    /// `src/lib/canvas/color.ts`).
    private static let maxRecentColors = 12

    /// Folds a used color into `recentColors`, most-recent first. Re-using a
    /// listed color moves it to the front instead of duplicating it; the
    /// list caps at `maxRecentColors`, dropping the oldest.
    func recordRecentColor(_ color: Color) {
        recentColors.removeAll { $0 == color }
        recentColors.insert(color, at: 0)
        if recentColors.count > Self.maxRecentColors {
            recentColors.removeLast(recentColors.count - Self.maxRecentColors)
        }
    }
}
