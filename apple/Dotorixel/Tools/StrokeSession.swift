import Foundation

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

/// The Document viewed as a drawing surface — the active-layer drawing ops
/// and composite reads a stroke session may touch, and nothing structural.
/// `AppleDocument` provides the base surface; per-stroke decorators may
/// enforce drawing policies without exposing the whole editor. The seam is
/// enforced by type: layer structure, history, resize, and export are
/// unreachable through it.
protocol DrawingSurface: AnyObject {
    func width() -> UInt32
    func height() -> UInt32
    /// RGBA row-major blend of every visible layer — what the user sees.
    func composite() -> Data
    func getPixel(x: UInt32, y: UInt32) throws -> Color
    func setPixel(x: UInt32, y: UInt32, color: Color) throws
    func applyTool(x: Int32, y: Int32, tool: ToolType, foregroundColor: Color) -> Bool
    func floodFill(x: Int32, y: Int32, fillColor: Color) -> Bool
    /// Fills inside `bounds`, further narrowed by any clipping policy the
    /// surface enforces. A Marquee-clipped surface intersects caller bounds
    /// with its captured Marquee, so callers can narrow the clip but never
    /// escape it; an empty intersection fills nothing. The document conformer
    /// remains the FFI boundary that validates bounds and may throw.
    func floodFillBounded(
        x: Int32, y: Int32, fillColor: Color, bounds: AppleMarqueeRegion
    ) throws -> Bool
    func activeLayerPixels() throws -> Data
    func restoreActiveLayerPixels(data: Data) throws
    /// The current Marquee, or `nil` when no selection exists. On the
    /// surface because the Selection tool's session defines and clears it
    /// through the same seam it draws through.
    func marquee() -> AppleMarqueeRegion?
    func setMarquee(region: AppleMarqueeRegion?) throws
}

extension AppleDocument: DrawingSurface {}

extension DrawingSurface {
    /// Whether `(x, y)` falls inside the surface's `width × height`.
    func containsPixel(x: Int32, y: Int32) -> Bool {
        x >= 0 && y >= 0 && x < Int32(width()) && y < Int32(height())
    }

    /// The active layer's pixels as a session-local pre-stroke snapshot
    /// (shape preview restore, move re-shift) — distinct from the Edit
    /// Baseline, which History owns. The active layer is always a Pixel
    /// Layer today, so a failed read is an invariant break: surfaced in
    /// debug, degraded to an empty buffer in release.
    func preStrokePixelSnapshot() -> Data {
        do {
            return try activeLayerPixels()
        } catch {
            assertionFailure("Failed to snapshot pre-stroke pixels: \(error)")
            return Data()
        }
    }
}

/// Editor services a stroke session may touch — deliberately narrow so
/// sessions depend on this seam, not on the whole editor state.
protocol StrokeSessionHost: AnyObject {
    /// The drawing surface strokes draw into — the active document viewed
    /// through the `DrawingSurface` seam, so sessions can paint the active
    /// layer and read the composite but cannot reach layer structure or
    /// history.
    var drawingSurface: any DrawingSurface { get }
    var samplingSurface: any SamplingSurface { get }
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

    /// Holds the current document as the pending Edit Baseline. The host
    /// resolves it when the stroke ends or cancels: the undo entry commits
    /// only if the stroke actually changed the document, so a no-op stroke
    /// leaves History (including the redo future) untouched.
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

extension StrokeSessionHost {
    var samplingSurface: any SamplingSurface {
        CompositeSamplingSurface(surface: drawingSurface)
    }
}

/// The selection-specific editor surface: Marquee definition still uses the
/// generic drawing surface, while Floating Selection ownership stays at the
/// tab boundary instead of leaking buffer state into a stroke session.
protocol SelectionSessionHost: StrokeSessionHost {
    var selectionMarqueeForInteraction: AppleMarqueeRegion? { get }
    var floatingSelectionOffset: FloatingSelectionOffset? { get }

    /// Captures the source pixels and pre-lift state, clears the source, and
    /// activates the Floating Selection lifecycle. Returns `true` only after
    /// all three steps complete; returns `false` when a selection is already
    /// active or source capture or boundary validation fails.
    @discardableResult
    func liftFloatingSelection(from sourceRegion: AppleMarqueeRegion) -> Bool

    /// Accepts a different offset when its projected Marquee is representable
    /// across the FFI boundary. Returns `false` when no Floating Selection is
    /// active, the offset is unchanged, or the projection is invalid; an
    /// invalid candidate leaves the last valid offset active.
    @discardableResult
    func moveFloatingSelection(to offset: FloatingSelectionOffset) -> Bool

    /// Resolves the live Floating Selection into one document History edit.
    /// Returns `true` only when the commit completed successfully. A failed
    /// apply still resolves its Edit Baseline and lifecycle before returning
    /// `false`, so callers can safely stop the triggering mutation.
    @discardableResult
    func commitFloatingSelection() -> Bool

    /// Discards the live translation and attempts to restore the exact
    /// pre-lift state. Returns `true` after an exact restore; a boundary
    /// failure still resolves the transient lifecycle but returns `false`.
    @discardableResult
    func cancelFloatingSelection() -> Bool
}
