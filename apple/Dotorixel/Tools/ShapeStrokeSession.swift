import Foundation

/// Shape preview session shared by line, rectangle, and ellipse: snapshots the
/// canvas pixels at stroke start, then on every drag sample restores the
/// snapshot and redraws the shape from the stroke's anchor to the current
/// pointer position. The last preview is already the final shape, so `end` has
/// nothing left to commit; `cancel` restores the pre-stroke snapshot.
final class ShapeStrokeSession: StrokeSession {
    /// Geometry for one shape species — the pixels spanning anchor → current.
    /// The core geometry functions treat anchor == current as a single pixel.
    typealias OutlinePixels = (ScreenCanvasCoords, ScreenCanvasCoords) -> [ScreenCanvasCoords]

    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: StrokeSessionHost
    private let coreToolType: ToolType
    private let outlinePixels: OutlinePixels
    /// Fixed at session creation — mid-stroke color changes don't affect a
    /// stroke already in flight.
    private let drawColor: Color

    private var preStrokePixels = Data()
    private var anchor: ScreenCanvasCoords?
    /// Whether the last drawn preview painted any in-bounds pixel — restoring
    /// the snapshot needs a re-render exactly when it erases such a preview.
    private var lastPreviewPainted = false

    init(
        host: StrokeSessionHost,
        coreToolType: ToolType,
        drawColor: Color,
        outlinePixels: @escaping OutlinePixels
    ) {
        self.host = host
        self.coreToolType = coreToolType
        self.drawColor = drawColor
        self.outlinePixels = outlinePixels
    }

    func start() {
        preStrokePixels = host.pixelCanvas.pixels()
        host.captureUndoSnapshot()
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        guard let anchor else {
            self.anchor = current
            lastPreviewPainted = paintShape(from: current, to: current)
            return lastPreviewPainted
        }
        let restoreErasedPreview = lastPreviewPainted
        restorePreStrokePixels()
        lastPreviewPainted = paintShape(from: anchor, to: current)
        return restoreErasedPreview || lastPreviewPainted
    }

    func end() -> Bool {
        // The last preview already drew the final shape.
        false
    }

    func cancel() -> Bool {
        restorePreStrokePixels()
        return lastPreviewPainted
    }

    private func paintShape(from: ScreenCanvasCoords, to: ScreenCanvasCoords) -> Bool {
        var didPaint = false
        for pixel in outlinePixels(from, to) {
            if host.pixelCanvas.applyTool(
                x: pixel.x, y: pixel.y,
                tool: coreToolType,
                foregroundColor: drawColor
            ) {
                didPaint = true
            }
        }
        return didPaint
    }

    /// The canvas is not replaced mid-stroke (sessions are torn down first),
    /// so the snapshot always matches the canvas dimensions.
    private func restorePreStrokePixels() {
        do {
            try host.pixelCanvas.restorePixels(data: preStrokePixels)
        } catch {
            assertionFailure("Failed to restore pre-stroke pixels: \(error)")
        }
    }
}
