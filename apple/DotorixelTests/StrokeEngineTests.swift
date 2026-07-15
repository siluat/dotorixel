import Testing
@testable import Dotorixel

/// Records lifecycle calls so tests can assert the engine's driving order.
private final class SpyStrokeSession: StrokeSession {
    private(set) var calls: [String] = []
    var drawReturnsRerender = true
    var cancelReturnsRerender = false

    func start() {
        calls.append("start")
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        let prev = previous.map { "(\($0.x),\($0.y))" } ?? "nil"
        calls.append("draw (\(current.x),\(current.y)) prev \(prev)")
        return drawReturnsRerender
    }

    func end() -> Bool {
        calls.append("end")
        return false
    }

    func cancel() -> Bool {
        calls.append("cancel")
        return cancelReturnsRerender
    }
}

/// Emulates a deferred-commit tool (e.g. eyedropper): samples during the
/// drag, commits the effect only at `end`. `cancel` must discard it.
private final class DeferredCommitStrokeSession: StrokeSession {
    private(set) var isCommitted = false
    private var sampled: ScreenCanvasCoords?

    func start() {}

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        sampled = current
        return false
    }

    func end() -> Bool {
        if sampled != nil {
            isCommitted = true
        }
        return false
    }

    func cancel() -> Bool {
        false
    }
}

private final class FakeStrokeSessionHost: StrokeSessionHost {
    let pixelCanvas: ApplePixelCanvas
    var foregroundColor: Color
    private(set) var undoSnapshotCount = 0

    init() {
        self.pixelCanvas = try! ApplePixelCanvas(width: 4, height: 4)
        self.foregroundColor = Color(r: 0x2D, g: 0x2D, b: 0x2D, a: 0xFF)
    }

    func captureUndoSnapshot() {
        undoSnapshotCount += 1
    }
}

@Suite("StrokeEngine — lifecycle")
struct StrokeEngineLifecycleTests {

    @Test("begin starts the session, then draws the first sample with no previous")
    func beginStartsThenDrawsFirstSample() {
        let spy = SpyStrokeSession()
        let engine = StrokeEngine(makeSession: { _, _ in spy })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 2, y: 3))

        #expect(spy.calls == ["start", "draw (2,3) prev nil"])
    }

    @Test("each sample reaches the session with the prior sample as previous")
    func samplesCarryPrevious() {
        let spy = SpyStrokeSession()
        let engine = StrokeEngine(makeSession: { _, _ in spy })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 2, y: 3))
        engine.sample(at: ScreenCanvasCoords(x: 3, y: 4))
        engine.sample(at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(spy.calls == [
            "start",
            "draw (2,3) prev nil",
            "draw (3,4) prev (2,3)",
            "draw (5,5) prev (3,4)",
        ])
    }

    @Test("a repeated sample on the same pixel never reaches the session")
    func samePixelSampleIsDropped() {
        let spy = SpyStrokeSession()
        let engine = StrokeEngine(makeSession: { _, _ in spy })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 2, y: 3))
        let didChange = engine.sample(at: ScreenCanvasCoords(x: 2, y: 3))

        #expect(didChange == false)
        #expect(spy.calls == ["start", "draw (2,3) prev nil"])
    }

    @Test("end routes to the session and stops further samples")
    func endTearsDownSession() {
        let spy = SpyStrokeSession()
        let engine = StrokeEngine(makeSession: { _, _ in spy })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 2, y: 3))
        engine.end()
        let didChange = engine.sample(at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(didChange == false)
        #expect(spy.calls == ["start", "draw (2,3) prev nil", "end"])
    }

    @Test("cancel routes to the session — never end — and stops further samples")
    func cancelTearsDownSessionWithoutEnd() {
        let spy = SpyStrokeSession()
        let engine = StrokeEngine(makeSession: { _, _ in spy })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 2, y: 3))
        engine.cancel()
        let didChange = engine.sample(at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(didChange == false)
        #expect(spy.calls == ["start", "draw (2,3) prev nil", "cancel"])
    }

    @Test("a begin while a session is active routes the old session through cancel")
    func beginWhileActiveCancelsOldSession() {
        let first = SpyStrokeSession()
        let second = SpyStrokeSession()
        var pending = [first, second]
        let engine = StrokeEngine(makeSession: { _, _ in pending.removeFirst() })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 1, y: 1))
        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(first.calls == ["start", "draw (1,1) prev nil", "cancel"])
        #expect(second.calls == ["start", "draw (5,5) prev nil"])
    }

    @Test("begin reports a re-render when the replaced session's cancel needs one")
    func beginPropagatesReplacedCancelRerender() {
        let first = SpyStrokeSession()
        first.cancelReturnsRerender = true
        let second = SpyStrokeSession()
        second.drawReturnsRerender = false
        var pending = [first, second]
        let engine = StrokeEngine(makeSession: { _, _ in pending.removeFirst() })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 1, y: 1))
        let didChange = engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(didChange == true)
    }
}

// Proves the seam is ready for non-continuous lifecycles (shape, eyedropper,
// move) without shipping them: a deferred effect must commit on the end path
// and be discarded on the cancel path.
@Suite("StrokeEngine — deferred-commit seam")
struct StrokeEngineDeferredCommitTests {

    @Test("a deferred effect commits on end")
    func deferredEffectCommitsOnEnd() {
        let session = DeferredCommitStrokeSession()
        let engine = StrokeEngine(makeSession: { _, _ in session })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 1, y: 1))
        engine.sample(at: ScreenCanvasCoords(x: 2, y: 2))
        engine.end()

        #expect(session.isCommitted)
    }

    @Test("a deferred effect is discarded on cancel")
    func deferredEffectDiscardedOnCancel() {
        let session = DeferredCommitStrokeSession()
        let engine = StrokeEngine(makeSession: { _, _ in session })

        engine.begin(tool: .pencil, host: FakeStrokeSessionHost(), at: ScreenCanvasCoords(x: 1, y: 1))
        engine.sample(at: ScreenCanvasCoords(x: 2, y: 2))
        engine.cancel()

        #expect(!session.isCommitted)
    }
}
