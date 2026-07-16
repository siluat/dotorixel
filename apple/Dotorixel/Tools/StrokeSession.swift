/// Which pointer button opened a stroke. Touch input is always `.primary`;
/// `.secondary` is a macOS right-click or a pointer device's secondary button.
/// Resolved into a draw color (primary → foreground, secondary → background)
/// once at stroke begin, so sessions never see the distinction.
enum PointerButton {
    case primary
    case secondary
}

/// Per-stroke drawing lifecycle. One session is created per stroke from the
/// active tool and driven start → draw* → end, or start → draw* → cancel.
///
/// The lifecycle is what lets non-continuous tools plug into the same seam:
/// shape tools redraw a preview on every `draw`, one-shot tools fire on the
/// first `draw` only, deferred-commit tools act in `end` — and `cancel` must
/// discard whatever `end` would have committed.
protocol StrokeSession {
    /// Called exactly once when the stroke begins, before any sample.
    func start()

    /// One pointer sample. `previous` is `nil` on the first sample of the
    /// stroke. Returns `true` when the canvas needs a re-render.
    @discardableResult
    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool

    /// Tears the session down, committing any deferred effect.
    /// Returns `true` when the canvas needs a re-render.
    @discardableResult
    func end() -> Bool

    /// Tears the session down after an interrupted pointer sequence,
    /// discarding any deferred effect. Returns `true` when the canvas needs
    /// a re-render (e.g. a restored preview).
    @discardableResult
    func cancel() -> Bool
}

/// Editor services a stroke session may touch — deliberately narrow so
/// sessions depend on this seam, not on the whole editor state.
protocol StrokeSessionHost: AnyObject {
    var pixelCanvas: ApplePixelCanvas { get }
    var foregroundColor: Color { get }
    var backgroundColor: Color { get }

    /// Pushes the current canvas pixels onto the undo stack.
    func captureUndoSnapshot()
}
