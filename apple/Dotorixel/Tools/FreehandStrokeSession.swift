/// Continuous per-pixel painting session shared by pencil and eraser: stamps
/// every sample and fills the gap from the previous sample by Bresenham
/// interpolation, so fast drags leave no holes.
final class FreehandStrokeSession: StrokeSession {
    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: StrokeSessionHost
    private let coreToolType: ToolType
    /// Fixed at session creation — mid-stroke color changes don't affect a
    /// stroke already in flight.
    private let drawColor: Color

    init(host: StrokeSessionHost, coreToolType: ToolType, drawColor: Color) {
        self.host = host
        self.coreToolType = coreToolType
        self.drawColor = drawColor
    }

    func start() {
        host.captureUndoSnapshot()
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        guard let previous else {
            return applyAt(current)
        }
        var didChange = false
        let segment = appleInterpolatePixels(
            x0: previous.x, y0: previous.y,
            x1: current.x, y1: current.y
        )
        for pixel in segment {
            if applyAt(pixel) {
                didChange = true
            }
        }
        return didChange
    }

    func end() -> Bool {
        false
    }

    /// Freehand pixels are painted immediately, so an interrupted stroke
    /// keeps what it painted — there is no deferred effect to discard.
    func cancel() -> Bool {
        false
    }

    private func applyAt(_ coords: ScreenCanvasCoords) -> Bool {
        host.pixelCanvas.applyTool(
            x: coords.x,
            y: coords.y,
            tool: coreToolType,
            foregroundColor: drawColor
        )
    }
}
