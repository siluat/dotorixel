/// One-shot session for tap-effect tools (flood fill, …): captures the undo
/// snapshot at start, fires its effect on the first sample only, and ignores
/// the rest of the drag.
final class OneShotStrokeSession: StrokeSession {
    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: StrokeSessionHost
    /// The tool's tap effect. Returns `true` when the canvas changed.
    /// Receives the host as a parameter so `makeSession` closures don't
    /// capture it strongly — the `unowned` reference above stays the
    /// session's only link to the host.
    private let fire: (StrokeSessionHost, ScreenCanvasCoords) -> Bool
    private var hasFired = false

    init(host: StrokeSessionHost, fire: @escaping (StrokeSessionHost, ScreenCanvasCoords) -> Bool) {
        self.host = host
        self.fire = fire
    }

    func start() {
        host.beginEdit()
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        guard !hasFired else { return false }
        hasFired = true
        return fire(host, current)
    }

    func end() -> Bool {
        false
    }

    /// The effect is applied immediately on the first sample, so an
    /// interrupted stroke keeps it — there is no deferred effect to discard.
    func cancel() -> Bool {
        false
    }
}
