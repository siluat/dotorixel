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
    var activeTool: ToolType = .pencil
    /// Default foreground color matches Pebble's #2D2D2D.
    var foregroundColor: Color
    var showGrid: Bool = true

    /// Manually incremented to trigger SwiftUI updates when canvas pixels change.
    var canvasVersion: Int = 0
    private(set) var isDrawing: Bool = false

    /// Incremented on pushSnapshot/undo/redo to trigger `canUndo`/`canRedo` re-evaluation.
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
        self.foregroundColor = Color(r: 0x2D, g: 0x2D, b: 0x2D, a: 0xFF)
    }

    // MARK: - History

    func handleDrawStart() {
        isDrawing = true
        historyManager.pushSnapshot(width: pixelCanvas.width(), height: pixelCanvas.height(), pixels: pixelCanvas.pixels())
        historyVersion += 1
    }

    func handleDrawEnd() {
        isDrawing = false
    }

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
        do {
            if snapshot.width == pixelCanvas.width(), snapshot.height == pixelCanvas.height() {
                try pixelCanvas.restorePixels(data: snapshot.pixels)
            } else {
                let restored = try ApplePixelCanvas(width: snapshot.width, height: snapshot.height)
                try restored.restorePixels(data: snapshot.pixels)
                pixelCanvas = restored
                viewport = viewport.fitToViewport(
                    canvasWidth: snapshot.width,
                    canvasHeight: snapshot.height,
                    viewportSize: viewportSize
                )
            }
            canvasVersion += 1
            historyVersion += 1
        } catch {
            assertionFailure("Failed to apply snapshot: \(error)")
        }
    }

    // MARK: - Color

    /// Updates the foreground drawing color.
    func handleSelectColor(_ color: Color) {
        foregroundColor = color
    }

    /// Updates the foreground drawing color from a SwiftUI ColorPicker selection.
    func handleSelectSwiftUIColor(_ swiftUIColor: SwiftUI.Color) {
        let resolved = swiftUIColor.resolve(in: .init())
        foregroundColor = Color(resolved: resolved)
    }

    // MARK: - Canvas Resize

    /// Resizes the canvas to new dimensions.
    /// Pushes a snapshot for undo, replaces the canvas, and refits the viewport.
    func handleResize(width: UInt32, height: UInt32) {
        guard canvasIsValidDimension(value: width),
              canvasIsValidDimension(value: height) else { return }
        guard width != pixelCanvas.width() || height != pixelCanvas.height() else { return }

        do {
            let previousWidth = pixelCanvas.width()
            let previousHeight = pixelCanvas.height()
            let previousPixels = pixelCanvas.pixels()
            pixelCanvas = try pixelCanvas.resize(newWidth: width, newHeight: height)
            historyManager.pushSnapshot(
                width: previousWidth,
                height: previousHeight,
                pixels: previousPixels
            )
            historyVersion += 1
            canvasVersion += 1
            viewport = viewport.fitToViewport(
                canvasWidth: width,
                canvasHeight: height,
                viewportSize: viewportSize
            )
        } catch {
            assertionFailure("Canvas resize failed: \(error)")
        }
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
