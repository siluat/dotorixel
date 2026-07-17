/// Deferred-commit session for the eyedropper: the drag refines the sampled
/// target pixel and `end` commits its color to the slot the pointer button
/// picked at stroke begin. Only a valid opaque sample commits — releasing out
/// of bounds or over a transparent pixel leaves the active color unchanged.
///
/// Never captures an undo snapshot: `start` deliberately skips `beginEdit`,
/// so color picks are not undoable (web parity).
final class EyedropperStrokeSession: StrokeSession {
    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: StrokeSessionHost
    private let commitTarget: ColorPickTarget
    private var targetPixel: ScreenCanvasCoords?

    init(host: StrokeSessionHost, commitTarget: ColorPickTarget) {
        self.host = host
        self.commitTarget = commitTarget
    }

    func start() {}

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        targetPixel = current
        return false
    }

    func end() -> Bool {
        guard let target = targetPixel,
              let x = UInt32(exactly: target.x),
              let y = UInt32(exactly: target.y),
              let sampled = try? host.pixelCanvas.getPixel(x: x, y: y),
              sampled.a > 0
        else { return false }
        host.commitColorPick(sampled, to: commitTarget)
        return false
    }

    func cancel() -> Bool {
        targetPixel = nil
        return false
    }
}
