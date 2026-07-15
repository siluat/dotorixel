/// Drives one stroke at a time through the `StrokeSession` lifecycle.
///
/// Owns everything between raw pointer samples and the session contract:
/// resolving the active tool into a session at stroke begin, firing `start`
/// eagerly so callers never see an opened-but-not-started session, and
/// feeding samples as `(current, previous)` pairs.
final class StrokeEngine {
    private let makeSession: (EditorTool, StrokeSessionHost) -> StrokeSession
    private var session: StrokeSession?
    private var lastPixel: ScreenCanvasCoords?

    /// The `makeSession` override exists for tests to inject session doubles;
    /// production callers use the default tool-to-session resolution.
    init(makeSession: @escaping (EditorTool, StrokeSessionHost) -> StrokeSession = { tool, host in
        tool.makeSession(host: host)
    }) {
        self.makeSession = makeSession
    }

    /// Opens a session from `tool` and feeds the first sample.
    /// Returns `true` when the canvas needs a re-render.
    @discardableResult
    func begin(tool: EditorTool, host: StrokeSessionHost, at coords: ScreenCanvasCoords) -> Bool {
        let session = makeSession(tool, host)
        self.session = session
        lastPixel = coords
        session.start()
        return session.draw(current: coords, previous: nil)
    }

    /// Feeds one pointer sample to the active session. Samples landing on
    /// the same canvas pixel as the previous one are dropped before they
    /// reach the session. Returns `true` when the canvas needs a re-render.
    @discardableResult
    func sample(at coords: ScreenCanvasCoords) -> Bool {
        guard let session else { return false }
        if coords == lastPixel { return false }
        let previous = lastPixel
        lastPixel = coords
        return session.draw(current: coords, previous: previous)
    }

    /// Ends the active session, committing any deferred effect.
    /// Returns `true` when the canvas needs a re-render.
    @discardableResult
    func end() -> Bool {
        guard let session else { return false }
        let didChange = session.end()
        tearDown()
        return didChange
    }

    /// Cancels the active session after an interrupted pointer sequence,
    /// discarding any deferred effect. Returns `true` when the canvas needs
    /// a re-render.
    @discardableResult
    func cancel() -> Bool {
        guard let session else { return false }
        let didChange = session.cancel()
        tearDown()
        return didChange
    }

    private func tearDown() {
        session = nil
        lastPixel = nil
    }
}
