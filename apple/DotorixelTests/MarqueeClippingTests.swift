import Testing
@testable import Dotorixel

/// The Marquee's second job (CONTEXT.md): with one active, every drawing
/// tool's output is clipped to its bounds. Driven through the `TabState`
/// stroke API, the same seam the per-tool session suites use.
@Suite("Marquee clipping — drawing tools write only inside the Marquee")
struct MarqueeClippingTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)

    @Test("a pencil stroke crossing the Marquee boundary paints only the inside portion")
    func pencilStrokeIsClipped() throws {
        let state = Workspace(width: 8, height: 8)
        // A vertical band spanning columns 2…4.
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 0, width: 3, height: 8)
        )
        state.shared.activeTool = .pencil

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 7, y: 4))
        state.activeTab.endStroke()

        let fg = state.shared.foregroundColor
        #expect(try state.activeTab.document.getPixel(x: 0, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 4) == fg)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 4) == fg)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 7, y: 4) == transparent)
    }

    @Test("a flood fill seeded inside the Marquee stops at its edges")
    func floodFillStopsAtMarqueeEdges() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
        state.shared.activeTool = .floodFill

        // An all-transparent canvas: unclipped, this tap would flood every pixel.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.endStroke()

        let fg = state.shared.foregroundColor
        #expect(try state.activeTab.document.getPixel(x: 2, y: 2) == fg)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 4) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 3) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 3) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 3, y: 5) == transparent)
        #expect(paintedPixelCount(state.activeTab) == 9)
    }

    @Test("a flood fill seeded outside the Marquee changes nothing and leaves History untouched")
    func floodFillOutsideMarqueeIsNoOp() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
        state.shared.activeTool = .floodFill

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 7, y: 7))
        state.activeTab.endStroke()

        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(!state.activeTab.canUndo)
    }

    @Test("an eraser stroke clears only the pixels inside the Marquee")
    func eraserStrokeIsClipped() throws {
        let state = Workspace(width: 8, height: 8)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        for x in 0..<8 {
            try state.activeTab.document.setPixel(x: UInt32(x), y: 4, color: red)
        }
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 0, width: 3, height: 8)
        )
        state.shared.activeTool = .eraser

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 7, y: 4))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 4) == red)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 4) == red)
    }

    @Test("a rectangle commits only the outline pixels inside the Marquee")
    func shapeStrokeCommitsClipped() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 8, height: 4)
        )
        state.shared.activeTool = .rectangle

        // A 5×5 outline from (1,1) to (5,5): its top edge is inside the
        // Marquee, its bottom edge below it.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.endStroke()

        let fg = state.shared.foregroundColor
        #expect(try state.activeTab.document.getPixel(x: 3, y: 1) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 3) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 3, y: 5) == transparent)
    }

    @Test("without a Marquee the same stroke paints its whole path")
    func noMarqueePassesThrough() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .pencil

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 7, y: 4))
        state.activeTab.endStroke()

        #expect(paintedPixelCount(state.activeTab) == 8)
    }

    @Test("the pixel-perfect filter runs before the clip, so a corner survives an arm being clipped")
    func pixelPerfectFilterSeesTheUnclippedPath() throws {
        let state = Workspace(width: 8, height: 8)
        // The L runs (0,0) → (1,0) → (1,1); only its first pixel is outside.
        // Were the path clipped before filtering, the filter would see a
        // two-pixel diagonal-free path and leave the corner tip painted.
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 0, width: 7, height: 8)
        )
        state.shared.activeTool = .pencil
        let fg = state.shared.foregroundColor

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == fg)
    }

    @Test("the Marquee is snapshotted per stroke — a mid-stroke change doesn't move the clip")
    func marqueeIsSnapshottedPerStroke() throws {
        let state = Workspace(width: 8, height: 8)
        // The left half at stroke begin…
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 4, height: 8)
        )
        state.shared.activeTool = .pencil

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 4))
        // …rewritten to the right half mid-stroke.
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 4, y: 0, width: 4, height: 8)
        )
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 6, y: 4))
        state.activeTab.endStroke()

        let fg = state.shared.foregroundColor
        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == fg)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 6, y: 4) == transparent)
    }

    @Test("a stroke entirely outside the Marquee leaves undo and redo untouched")
    func fullyClippedStrokeLeavesHistoryUntouched() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 2)
        )
        state.shared.activeTool = .pencil

        // A real stroke inside the Marquee, undone: the redo future holds it.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.endStroke()
        state.activeTab.handleUndo()
        #expect(state.activeTab.canRedo)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 6, y: 6))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 7, y: 7))
        state.activeTab.endStroke()

        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(!state.activeTab.canUndo)
        #expect(state.activeTab.canRedo)
    }

    @Test("the move tool still translates the whole layer, Marquee or not")
    func moveToolIsUnclipped() throws {
        let state = Workspace(width: 8, height: 8)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.activeTab.document.setPixel(x: 0, y: 0, color: red)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 4, y: 4, width: 2, height: 2)
        )
        state.shared.activeTool = .move

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == red)
    }

    @Test("the eyedropper still samples outside the Marquee")
    func eyedropperIsUnclipped() throws {
        let state = Workspace(width: 8, height: 8)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.activeTab.document.setPixel(x: 7, y: 7, color: red)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 2)
        )
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 7, y: 7))
        state.activeTab.endStroke()

        #expect(state.shared.foregroundColor == red)
    }
}

/// The one clipped-surface path no stroke session reaches: a caller that
/// brings its own fill bounds. Kept honest here so a future selection
/// operation can't fill outside the Marquee by passing them.
@Suite("Marquee-clipped surface — a caller's own fill bounds")
struct MarqueeClippedSurfaceBoundedFillTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)
    private let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)

    private func clippedSurface(
        _ document: AppleDocument, marquee: AppleMarqueeRegion
    ) -> MarqueeClippedSurface {
        MarqueeClippedSurface(base: document, region: marquee)
    }

    @Test("bounds overlapping the Marquee narrow the fill to the overlap")
    func overlappingBoundsNarrowTheFill() throws {
        let document = makeSingleLayerDocument(width: 8, height: 8)
        let surface = clippedSurface(
            document, marquee: AppleMarqueeRegion(x: 0, y: 0, width: 4, height: 8)
        )

        let didFill = try surface.floodFillBounded(
            x: 2, y: 2, fillColor: blue,
            bounds: AppleMarqueeRegion(x: 2, y: 0, width: 6, height: 8)
        )

        #expect(didFill)
        #expect(try document.getPixel(x: 3, y: 2) == blue)
        // Inside the caller's bounds but outside the Marquee.
        #expect(try document.getPixel(x: 4, y: 2) == transparent)
        // Inside the Marquee but outside the caller's bounds.
        #expect(try document.getPixel(x: 1, y: 2) == transparent)
    }

    @Test("an invalid bounds record fills nothing rather than erroring")
    func invalidBoundsFillNothing() throws {
        let document = makeSingleLayerDocument(width: 8, height: 8)
        let surface = clippedSurface(
            document, marquee: AppleMarqueeRegion(x: 0, y: 0, width: 4, height: 8)
        )

        // A zero-width record is a rectangle the clip narrows away, so it
        // reads as "covers nothing" — the convention appleMarqueeContains
        // follows — instead of the document's boundary error.
        let didFill = try surface.floodFillBounded(
            x: 2, y: 2, fillColor: blue,
            bounds: AppleMarqueeRegion(x: 2, y: 0, width: 0, height: 8)
        )

        #expect(!didFill)
        #expect(try document.getPixel(x: 2, y: 2) == transparent)
    }

    @Test("bounds that miss the Marquee fill nothing")
    func disjointBoundsFillNothing() throws {
        let document = makeSingleLayerDocument(width: 8, height: 8)
        let surface = clippedSurface(
            document, marquee: AppleMarqueeRegion(x: 0, y: 0, width: 4, height: 8)
        )

        let didFill = try surface.floodFillBounded(
            x: 6, y: 2, fillColor: blue,
            bounds: AppleMarqueeRegion(x: 5, y: 0, width: 3, height: 8)
        )

        #expect(!didFill)
        #expect(try document.getPixel(x: 6, y: 2) == transparent)
    }
}
