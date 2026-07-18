import Foundation

/// Returns `source` (RGBA, `width`×`height`) with every pixel shifted by
/// (`dx`, `dy`) within the same canvas dimensions. Pixels shifted off-canvas
/// are clipped; vacated areas become transparent.
///
/// Row-by-row bulk copy — the Swift equivalent of the web shell's
/// `shiftPixels`, kept native per the Core Placement criteria (simple, stable
/// logic; promote to the core if a third implementation is ever needed).
/// Move tool session: shifts the whole canvas by the drag delta. The first
/// sample marks the anchor; every subsequent sample restores the pre-stroke
/// snapshot and re-shifts by (current − anchor), so the transform is always
/// relative to the drag origin — never cumulative. The last shift is already
/// the final state, so `end` has nothing left to commit; `cancel` restores
/// the pre-stroke snapshot.
final class MoveStrokeSession: StrokeSession {
    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: StrokeSessionHost

    private var preStrokePixels = Data()
    private var anchor: ScreenCanvasCoords?
    private var hasShiftedPixels = false

    init(host: StrokeSessionHost) {
        self.host = host
    }

    func start() {
        preStrokePixels = host.pixelCanvas.pixels()
        host.beginEdit()
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        guard previous != nil, let anchor else {
            self.anchor = current
            return false
        }
        let shifted = shiftedPixels(
            preStrokePixels,
            width: Int(host.pixelCanvas.width()),
            height: Int(host.pixelCanvas.height()),
            dx: Int(current.x - anchor.x),
            dy: Int(current.y - anchor.y)
        )
        restorePixels(shifted)
        hasShiftedPixels = true
        return true
    }

    func end() -> Bool {
        // The last shift already produced the final state.
        false
    }

    func cancel() -> Bool {
        guard hasShiftedPixels else { return false }
        restorePixels(preStrokePixels)
        return true
    }

    /// The canvas is not replaced mid-stroke (sessions are torn down first),
    /// so the buffer always matches the canvas dimensions.
    private func restorePixels(_ pixels: Data) {
        do {
            try host.pixelCanvas.restorePixels(data: pixels)
        } catch {
            assertionFailure("Failed to restore pixels: \(error)")
        }
    }
}

func shiftedPixels(_ source: Data, width: Int, height: Int, dx: Int, dy: Int) -> Data {
    var result = Data(count: width * height * 4)

    for srcY in 0..<height {
        let destY = srcY + dy
        if destY < 0 || destY >= height { continue }

        let srcXStart = max(0, -dx)
        let srcXEnd = min(width, width - dx)
        if srcXStart >= srcXEnd { continue }

        let destXStart = srcXStart + dx
        let copyLen = (srcXEnd - srcXStart) * 4
        let srcOffset = (srcY * width + srcXStart) * 4
        let destOffset = (destY * width + destXStart) * 4
        result.replaceSubrange(
            destOffset..<(destOffset + copyLen),
            with: source.subdata(in: srcOffset..<(srcOffset + copyLen))
        )
    }

    return result
}
