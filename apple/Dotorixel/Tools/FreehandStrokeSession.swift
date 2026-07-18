/// Continuous per-pixel painting session shared by pencil and eraser: stamps
/// every sample and fills the gap from the previous sample by Bresenham
/// interpolation, so fast drags leave no holes.
///
/// With pixel-perfect enabled, samples run through the Aseprite-style
/// L-corner filter (`applePixelPerfectFilter`): corner middle pixels are
/// reverted to their pre-stroke color as soon as the corner is detected.
/// Filter state (tail + pre-stroke color cache) is stroke-scoped — it lives
/// on the session, which is created at stroke begin and dropped at end.
final class FreehandStrokeSession: StrokeSession {
    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: StrokeSessionHost
    private let coreToolType: ToolType
    /// Fixed at session creation — mid-stroke color changes don't affect a
    /// stroke already in flight.
    private let drawColor: Color
    /// Snapshotted at session creation — toggling mid-stroke doesn't affect
    /// a stroke already in flight (web parity: the stroke engine snapshots
    /// the shared flag at stroke begin).
    private let pixelPerfect: Bool

    /// Filter carry state threaded between sample batches so L-corner
    /// judgments spanning batch boundaries stay consistent.
    private var tail: TailState = .empty
    /// Pre-stroke pixel colors, first-touch-wins: a coordinate is captured
    /// the first time the stroke touches it, so reverts and same-stroke
    /// repaints always restore the color from before the stroke began.
    private var preStrokeColors: [ScreenCanvasCoords: Color] = [:]

    init(host: StrokeSessionHost, coreToolType: ToolType, drawColor: Color, pixelPerfect: Bool) {
        self.host = host
        self.coreToolType = coreToolType
        self.drawColor = drawColor
        self.pixelPerfect = pixelPerfect
    }

    func start() {
        host.beginEdit()
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        let segment = previous.map {
            appleInterpolatePixels(x0: $0.x, y0: $0.y, x1: current.x, y1: current.y)
        } ?? [current]
        guard pixelPerfect else {
            return applyRaw(segment)
        }
        return applyFiltered(segment)
    }

    func end() -> Bool {
        false
    }

    /// Freehand pixels are painted immediately, so an interrupted stroke
    /// keeps what it painted — there is no deferred effect to discard.
    func cancel() -> Bool {
        false
    }

    private func applyRaw(_ segment: [ScreenCanvasCoords]) -> Bool {
        var didChange = false
        for pixel in segment {
            if applyAt(pixel) {
                didChange = true
            }
        }
        return didChange
    }

    // MARK: - Pixel-perfect filtering

    private func applyFiltered(_ segment: [ScreenCanvasCoords]) -> Bool {
        let deduped = dedupedAgainstTail(segment)
        guard !deduped.isEmpty else { return false }
        let result = applePixelPerfectFilter(points: deduped, prevTail: tail)
        tail = result.newTail

        var didChange = false
        for action in result.actions {
            switch action {
            case .paint(let x, let y):
                cachePreStrokeColor(x: x, y: y)
                if applyAt(ScreenCanvasCoords(x: x, y: y)) {
                    didChange = true
                }
            case .revert(let x, let y):
                if revertAt(x: x, y: y) {
                    didChange = true
                }
            }
        }
        return didChange
    }

    /// Drops any pixel equal to the immediately preceding one (carrying
    /// across the tail seam). Interpolated segments include both endpoints,
    /// so successive batches share a junction pixel — left in, the duplicate
    /// would put `cur == next` in the filter's 3-window and silently suppress
    /// L-corner detection at the seam.
    private func dedupedAgainstTail(_ pixels: [ScreenCanvasCoords]) -> [ScreenCanvasCoords] {
        var previous = tailEnd
        var out: [ScreenCanvasCoords] = []
        for pixel in pixels {
            if pixel == previous { continue }
            out.append(pixel)
            previous = pixel
        }
        return out
    }

    /// The most recent point of the effective path, or `nil` before the
    /// first sample.
    private var tailEnd: ScreenCanvasCoords? {
        switch tail {
        case .empty: return nil
        case .one(let x, let y): return ScreenCanvasCoords(x: x, y: y)
        case .two(_, _, let x, let y): return ScreenCanvasCoords(x: x, y: y)
        }
    }

    /// Captures the coordinate's current color before the stroke paints it.
    /// First touch wins; out-of-canvas coordinates are skipped (nothing to
    /// revert there).
    private func cachePreStrokeColor(x: Int32, y: Int32) {
        let coords = ScreenCanvasCoords(x: x, y: y)
        guard preStrokeColors[coords] == nil, x >= 0, y >= 0,
              let color = try? host.pixelCanvas.getPixel(x: UInt32(x), y: UInt32(y))
        else { return }
        preStrokeColors[coords] = color
    }

    /// Restores the coordinate to its cached pre-stroke color. Cached
    /// coordinates are always in-canvas (caching requires a successful read).
    private func revertAt(x: Int32, y: Int32) -> Bool {
        guard let original = preStrokeColors[ScreenCanvasCoords(x: x, y: y)] else { return false }
        let current = try? host.pixelCanvas.getPixel(x: UInt32(x), y: UInt32(y))
        guard current != original else { return false }
        try? host.pixelCanvas.setPixel(x: UInt32(x), y: UInt32(y), color: original)
        return true
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
