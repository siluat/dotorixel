/// Deferred-commit session for the eyedropper: the drag refines the sampled
/// target pixel and `end` commits its color to the slot the pointer button
/// picked at stroke begin. Only a valid opaque sample commits — releasing out
/// of bounds or over a transparent pixel leaves the active color unchanged.
///
/// Each sample also drives the sampling loupe overlay through the host seam:
/// shown with a fresh 9×9 grid on every `draw`, dismissed on `end`/`cancel`.
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
        host.samplingLoupe.show(grid: sampleGrid(
            surface: host.drawingSurface,
            center: current,
            size: LoupeGeometry.gridSize
        ))
        return false
    }

    func end() -> Bool {
        host.samplingLoupe.dismiss()
        guard let target = targetPixel,
              // Sample what the user sees — the composite, not the active
              // layer's buffer (the web's sampling rule).
              let sampled = compositeSample(surface: host.drawingSurface, x: target.x, y: target.y),
              sampled.a > 0
        else { return false }
        host.commitColorPick(sampled, to: commitTarget)
        return false
    }

    func cancel() -> Bool {
        host.samplingLoupe.dismiss()
        targetPixel = nil
        return false
    }
}
