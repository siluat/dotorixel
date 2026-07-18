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

    /// Shift-constrain for one shape species — snaps the current point
    /// relative to the anchor (line → 45° multiples, rect/ellipse → square).
    typealias Constrain = (ScreenCanvasCoords, ScreenCanvasCoords) -> ScreenCanvasCoords

    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: StrokeSessionHost
    private let coreToolType: ToolType
    private let outlinePixels: OutlinePixels
    private let constrain: Constrain
    /// Fixed at session creation — mid-stroke color changes don't affect a
    /// stroke already in flight.
    private let drawColor: Color

    private var preStrokePixels = Data()
    private var anchor: ScreenCanvasCoords?
    /// The raw (unconstrained) pointer position of the last sample — kept so
    /// a mid-stroke modifier change can re-derive the preview from it.
    private var lastCurrent: ScreenCanvasCoords?
    /// Whether the last drawn preview painted any in-bounds pixel — restoring
    /// the snapshot needs a re-render exactly when it erases such a preview.
    private var lastPreviewPainted = false

    init(
        host: StrokeSessionHost,
        coreToolType: ToolType,
        drawColor: Color,
        constrain: @escaping Constrain,
        outlinePixels: @escaping OutlinePixels
    ) {
        self.host = host
        self.coreToolType = coreToolType
        self.drawColor = drawColor
        self.constrain = constrain
        self.outlinePixels = outlinePixels
    }

    func start() {
        preStrokePixels = host.pixelCanvas.pixels()
        host.beginEdit()
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        lastCurrent = current
        guard anchor != nil else {
            anchor = current
            lastPreviewPainted = paintShape(from: current, to: current)
            return lastPreviewPainted
        }
        return repaintPreview()
    }

    func modifierChanged() -> Bool {
        // Nothing to reshape before the first sample lands.
        guard anchor != nil else { return false }
        return repaintPreview()
    }

    func end() -> Bool {
        // The last preview already drew the final shape.
        false
    }

    func cancel() -> Bool {
        restorePreStrokePixels()
        return lastPreviewPainted
    }

    /// Restores the pre-stroke snapshot and redraws anchor → current, with
    /// the constrain state live-read (web parity): pressing or releasing
    /// Shift — or tapping the latch — reshapes the preview immediately.
    private func repaintPreview() -> Bool {
        guard let anchor, let lastCurrent else { return false }
        let restoreErasedPreview = lastPreviewPainted
        restorePreStrokePixels()
        let end = host.isConstrainHeld ? constrain(anchor, lastCurrent) : lastCurrent
        lastPreviewPainted = paintShape(from: anchor, to: end)
        return restoreErasedPreview || lastPreviewPainted
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
