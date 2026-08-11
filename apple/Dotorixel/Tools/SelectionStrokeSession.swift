import Foundation

/// Selection tool session: a drag outside the Marquee defines it through the
/// core's clipped normalization; a drag inside lifts or continues a tab-owned
/// Floating Selection. Pointer release ends only the gesture, so the Floating
/// Selection remains available for another drag or an explicit commit.
final class SelectionStrokeSession: StrokeSession {
    // `unowned` breaks the transient host → engine → session → host cycle;
    // the engine tears the session down before the host can go away.
    private unowned let host: any SelectionSessionHost

    private var initialMarquee: AppleMarqueeRegion?
    private var anchor: ScreenCanvasCoords?
    private var hasUserDragged = false
    private var isDefiningMarquee = false
    private var isMovingFloatingSelection = false
    private var floatingDragBaseline = FloatingSelectionOffset.zero
    private var draftMarquee: AppleMarqueeRegion?
    /// The raw (unconstrained) pointer position of the last sample — kept so
    /// a mid-drag modifier change can re-resolve the rectangle from it.
    private var lastCurrent: ScreenCanvasCoords?

    init(host: any SelectionSessionHost) {
        self.host = host
    }

    func start() {
        initialMarquee = host.selectionMarqueeForInteraction
        floatingDragBaseline = host.floatingSelectionOffset ?? .zero
    }

    func draw(current: ScreenCanvasCoords, previous: ScreenCanvasCoords?) -> Bool {
        lastCurrent = current
        guard previous != nil, anchor != nil else {
            anchor = current
            if host.floatingSelectionOffset != nil,
               let initialMarquee,
               !appleMarqueeContains(
                   region: initialMarquee,
                   x: current.x,
                   y: current.y
               ) {
                host.commitFloatingSelection()
            }
            return false
        }
        // Any sample past the first is a drag: the engine drops same-cell
        // samples before they reach the session, so `current` has left the
        // anchor cell (unlike the web session, which floors sub-cell points
        // itself and must re-check).
        hasUserDragged = true
        if let initialMarquee, let anchor,
           appleMarqueeContains(region: initialMarquee, x: anchor.x, y: anchor.y) {
            if host.floatingSelectionOffset == nil {
                guard host.liftFloatingSelection(from: initialMarquee) else { return false }
            }
            isMovingFloatingSelection = true
            let gestureOffset = FloatingSelectionOffset(
                dx: Int64(current.x) - Int64(anchor.x),
                dy: Int64(current.y) - Int64(anchor.y)
            )
            return host.moveFloatingSelection(to: floatingDragBaseline + gestureOffset)
        }
        if !isDefiningMarquee {
            host.beginEdit()
            isDefiningMarquee = true
        }
        return redefinePreview()
    }

    func modifierChanged() -> Bool {
        // Nothing to re-resolve before the drag leaves the anchor cell.
        guard hasUserDragged, isDefiningMarquee else { return false }
        return redefinePreview()
    }

    func end() -> Bool {
        if isMovingFloatingSelection { return false }
        // A click without a meaningful drag: deselect only outside the
        // Marquee — an inside click belongs to the Floating Selection
        // lifecycle (issue 272) and must not clear it (web parity).
        if !hasUserDragged, let initialMarquee, let anchor,
           !appleMarqueeContains(region: initialMarquee, x: anchor.x, y: anchor.y) {
            host.beginEdit()
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
        if isMovingFloatingSelection {
            host.cancelFloatingSelection()
            return false
        }
        // An interrupted define (e.g. a pinch begun mid-drag) discards the
        // preview: the initial Marquee comes back and the Edit Baseline
        // resolves as a no-op.
        guard hasUserDragged, isDefiningMarquee else { return false }
        setMarquee(initialMarquee)
        return true
    }

    /// Rewrites the drag preview from the anchor and the last raw pointer,
    /// with the constrain state live-read (web parity): pressing or releasing
    /// Shift — or tapping the latch — re-resolves the rectangle immediately.
    private func redefinePreview() -> Bool {
        guard let anchor, let lastCurrent else { return false }
        draftMarquee = host.isConstrainHeld
            ? squareMarqueeFromDrag(anchor, lastCurrent)
            : marqueeFromDrag(anchor, lastCurrent)
        setMarquee(draftMarquee)
        return true
    }

    /// The constrained define (web parity: `squareMarqueeFromDrag` in
    /// `selection-tool.ts`), which keeps the square whole at the canvas edge.
    /// The shape tools' unbounded `constrainSquare` doesn't fit here: their
    /// preview merely paints nothing off-canvas, but a Marquee is clipped —
    /// an unbounded square would clip into a rectangle. So: `nil` when the
    /// raw drag never touches the canvas (squaring must not grow a
    /// fully-outside drag into it), the anchor clamped inside, and the side
    /// bounded to the room the canvas leaves in the drag direction.
    private func squareMarqueeFromDrag(
        _ anchor: ScreenCanvasCoords, _ current: ScreenCanvasCoords
    ) -> AppleMarqueeRegion? {
        guard marqueeFromDrag(anchor, current) != nil else { return nil }
        let squareAnchor = clampedToCanvas(anchor)
        return marqueeFromDrag(
            squareAnchor,
            boundedSquareEnd(anchor: squareAnchor, current: current)
        )
    }

    private func clampedToCanvas(_ point: ScreenCanvasCoords) -> ScreenCanvasCoords {
        ScreenCanvasCoords(
            x: min(max(point.x, 0), Int32(host.drawingSurface.width()) - 1),
            y: min(max(point.y, 0), Int32(host.drawingSurface.height()) - 1)
        )
    }

    /// Squares the drag box like `constrainSquare`, but bounds the side to
    /// the space between the (in-canvas) anchor and the canvas edge in the
    /// drag direction, so the square always fits the canvas.
    private func boundedSquareEnd(
        anchor: ScreenCanvasCoords, current: ScreenCanvasCoords
    ) -> ScreenCanvasCoords {
        let dx = current.x - anchor.x
        let dy = current.y - anchor.y
        let maxX = dx >= 0 ? Int32(host.drawingSurface.width()) - 1 - anchor.x : anchor.x
        let maxY = dy >= 0 ? Int32(host.drawingSurface.height()) - 1 - anchor.y : anchor.y
        let side = min(max(abs(dx), abs(dy)), maxX, maxY)

        return ScreenCanvasCoords(
            x: anchor.x + side * (dx >= 0 ? 1 : -1),
            y: anchor.y + side * (dy >= 0 ? 1 : -1)
        )
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
