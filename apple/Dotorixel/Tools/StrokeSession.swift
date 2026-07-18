/// Which pointer button opened a stroke. Touch input is always `.primary`;
/// `.secondary` is a macOS right-click or a pointer device's secondary button.
/// Resolved once at stroke begin into the session's per-stroke inputs — a
/// draw color, or a `ColorPickTarget` for sampling tools (primary →
/// foreground, secondary → background) — so sessions never see the distinction.
enum PointerButton {
    case primary
    case secondary
}

/// Which active-color slot a sampled color commits to. Resolved from the
/// pointer button once at stroke begin (primary → foreground, secondary →
/// background) — the same resolution point as the draw color.
enum ColorPickTarget {
    case foreground
    case background
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

    /// A stroke modifier (Shift, the Constrain latch) changed while the
    /// pointer is stationary. Sessions whose preview depends on a modifier
    /// re-render it here; the default ignores the change. Returns `true`
    /// when the canvas needs a re-render.
    @discardableResult
    func modifierChanged() -> Bool
}

extension StrokeSession {
    /// Most sessions read no modifiers — the change is a no-op for them.
    @discardableResult
    func modifierChanged() -> Bool {
        false
    }
}

/// Editor services a stroke session may touch — deliberately narrow so
/// sessions depend on this seam, not on the whole editor state.
protocol StrokeSessionHost: AnyObject {
    var pixelCanvas: ApplePixelCanvas { get }
    var foregroundColor: Color { get }
    var backgroundColor: Color { get }

    /// Whether freehand strokes should run through the pixel-perfect
    /// L-corner filter. Sessions snapshot this at creation — a mid-stroke
    /// toggle never affects the stroke in flight.
    var isPixelPerfectEnabled: Bool { get }

    /// Whether the Shift-constrain state is held — physical Shift and the
    /// toolbar Constrain latch, OR-combined by the host so sessions cannot
    /// tell the sources apart. Shape sessions live-read this on every draw
    /// sample; a mid-stroke change re-renders via `modifierChanged`.
    var isConstrainHeld: Bool { get }

    /// State behind the loupe overlay shown while a sampling stroke is
    /// active. Sampling sessions own its lifecycle (show on each sample,
    /// dismiss on end/cancel); drawing sessions never touch it.
    var samplingLoupe: SamplingLoupeState { get }

    /// Holds the current canvas pixels as the pending Edit Baseline. The
    /// host resolves it when the stroke ends or cancels: the undo entry
    /// commits only if the stroke actually changed the canvas, so a no-op
    /// stroke leaves History (including the redo future) untouched.
    func beginEdit()

    /// Commits a sampled color to the given active-color slot. Color picks
    /// are not undoable (web parity) — this never touches the Edit Baseline
    /// or History.
    func commitColorPick(_ color: Color, to target: ColorPickTarget)

    /// Records a color into the recent-colors list. The list tracks colors
    /// *used* (web parity): the engine records the draw color when a drawing
    /// stroke begins, and the host records eyedropper commits — sessions
    /// never call this directly.
    func recordRecentColor(_ color: Color)
}
