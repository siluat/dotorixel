import Foundation

/// Selection tool session: a drag defines the Marquee live through the
/// core's drag normalization, clipped to the canvas (web parity:
/// `selection-tool.ts`). The first sample marks the anchor; every subsequent
/// sample rewrites the document Marquee as the drag preview — the final
/// rewrite is already the committed state, judged by the Edit Baseline.
final class SelectionStrokeSession: StrokeSession {
    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: StrokeSessionHost

    private var initialMarquee: AppleMarqueeRegion?
    private var anchor: ScreenCanvasCoords?
    private var hasUserDragged = false
    private var draftMarquee: AppleMarqueeRegion?
    /// The raw (unconstrained) pointer position of the last sample — kept so
    /// a mid-drag modifier change can re-resolve the rectangle from it.
    private var lastCurrent: ScreenCanvasCoords?

    init(host: StrokeSessionHost) {
        self.host = host
    }

    func start() {
        initialMarquee = host.drawingSurface.marquee()
        host.beginEdit()
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        lastCurrent = current
        guard previous != nil, anchor != nil else {
            anchor = current
            return false
        }
        // Any sample past the first is a drag: the engine drops same-cell
        // samples before they reach the session, so `current` has left the
        // anchor cell (unlike the web session, which floors sub-cell points
        // itself and must re-check).
        hasUserDragged = true
        return redefinePreview()
    }

    func modifierChanged() -> Bool {
        // Nothing to re-resolve before the drag leaves the anchor cell.
        guard hasUserDragged else { return false }
        return redefinePreview()
    }

    func end() -> Bool {
        // A click without a meaningful drag: deselect only outside the
        // Marquee — an inside click belongs to the Floating Selection
        // lifecycle (issue 272) and must not clear it (web parity).
        if !hasUserDragged, let initialMarquee, let anchor,
           !appleMarqueeContains(region: initialMarquee, x: anchor.x, y: anchor.y) {
            setMarquee(nil)
            return true
        }
        // A drag whose rectangle lies entirely outside the canvas defines
        // nothing: the initial Marquee comes back instead of committing the
        // nil preview (web parity: a null draft never deselects).
        if hasUserDragged && draftMarquee == nil {
            setMarquee(initialMarquee)
            return true
        }
        return false
    }

    func cancel() -> Bool {
        // An interrupted define (e.g. a pinch begun mid-drag) discards the
        // preview: the initial Marquee comes back and the Edit Baseline
        // resolves as a no-op.
        guard hasUserDragged else { return false }
        setMarquee(initialMarquee)
        return true
    }

    /// Rewrites the drag preview from the anchor and the last raw pointer,
    /// with the constrain state live-read (web parity): pressing or releasing
    /// Shift — or tapping the latch — re-resolves the rectangle immediately.
    private func redefinePreview() -> Bool {
        guard let anchor, let lastCurrent else { return false }
        let end = host.isConstrainHeld
            ? constrainSquare(anchor: anchor, current: lastCurrent)
            : lastCurrent
        draftMarquee = marqueeFromDrag(anchor, end)
        setMarquee(draftMarquee)
        return true
    }

    /// Normalizes the drag corners and clips to the canvas — `nil` when the
    /// dragged rectangle lies entirely outside it. `appleMarqueeFromDrag`
    /// errors only past the core's span cap, unreachable from canvas-sized
    /// coordinates.
    private func marqueeFromDrag(
        _ anchor: ScreenCanvasCoords, _ current: ScreenCanvasCoords
    ) -> AppleMarqueeRegion? {
        guard let region = try? appleMarqueeFromDrag(
            x0: anchor.x, y0: anchor.y, x1: current.x, y1: current.y
        ) else {
            assertionFailure("Marquee drag span exceeded the core cap")
            return nil
        }
        return appleMarqueeClipTo(
            region: region,
            canvasW: host.drawingSurface.width(),
            canvasH: host.drawingSurface.height()
        )
    }

    /// A canvas-clipped region is always valid, so a throw is an invariant
    /// break: surfaced in debug, ignored in release.
    private func setMarquee(_ region: AppleMarqueeRegion?) {
        do {
            try host.drawingSurface.setMarquee(region: region)
        } catch {
            assertionFailure("Failed to set Marquee: \(error)")
        }
    }
}
