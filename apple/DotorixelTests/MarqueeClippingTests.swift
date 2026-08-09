import Testing
@testable import Dotorixel

/// Marquee clipping exercised through the public `TabState` stroke API so
/// every assertion crosses the real StrokeEngine → session → Document seam.
@Suite("Drawing strokes — Marquee clipping")
struct MarqueeClippingTests {
    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)

    @Test("a pencil stroke crossing the Marquee paints only inside it")
    func pencilCrossingMarqueePaintsOnlyInside() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
        state.shared.activeTool = .pencil
        state.shared.pixelPerfect = false

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 3))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 3))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 3) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 3) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 3) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 3) == transparent)
    }

    @Test("flood fill from inside the Marquee stops at its edges")
    func floodFillStopsAtMarqueeEdges() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
        state.shared.activeTool = .floodFill

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 3) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 2) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 4) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 3) == transparent)
    }

    @Test("Marquee clipping sees pixel-perfect filtered output")
    func clippingFollowsPixelPerfectFiltering() throws {
        let state = Workspace(width: 8, height: 8)
        // The Marquee excludes the L's first point. Filtering must still see
        // the full path before clipping, so the corner tip at (1,0) reverts.
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 2)
        )
        state.shared.activeTool = .pencil
        state.shared.pixelPerfect = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == state.shared.foregroundColor)
    }

    @Test("a stroke keeps the Marquee captured at begin")
    func strokeKeepsBeginMarqueeSnapshot() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        state.shared.activeTool = .pencil
        state.shared.pixelPerfect = false

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 3, y: 1, width: 1, height: 1)
        )
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 1) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 3, y: 1) == transparent)
    }

    @Test("a fully clipped stroke records no History entry and preserves redo")
    func fullyClippedStrokePreservesHistory() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 4, y: 4, width: 2, height: 2)
        )
        state.shared.activeTool = .pencil
        state.shared.pixelPerfect = false

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.activeTab.endStroke()
        state.activeTab.handleUndo()
        #expect(state.activeTab.canRedo)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))
        state.activeTab.endStroke()

        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(!state.activeTab.canUndo)
        #expect(state.activeTab.canRedo)

        state.activeTab.handleRedo()
        #expect(try state.activeTab.document.getPixel(x: 4, y: 4) == state.shared.foregroundColor)
    }

    @Test(
        "shape output is clipped to the Marquee",
        arguments: [EditorTool.line, .rectangle, .ellipse]
    )
    func shapeOutputIsClipped(tool: EditorTool) throws {
        let state = Workspace(width: 8, height: 8)
        let marquee = AppleMarqueeRegion(x: 2, y: 1, width: 3, height: 3)
        try state.activeTab.document.setMarquee(region: marquee)
        state.shared.activeTool = tool

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.endStroke()

        let painted = try paintedCoordinates(state)
        #expect(!painted.isEmpty)
        #expect(painted.allSatisfy {
            appleMarqueeContains(region: marquee, x: $0.x, y: $0.y)
        })
    }

    @Test("an eraser stroke crossing the Marquee clears only inside it")
    func eraserCrossingMarqueeClearsOnlyInside() throws {
        let state = Workspace(width: 8, height: 8)
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        for x in 1...5 {
            try state.activeTab.document.setPixel(x: UInt32(x), y: 3, color: red)
        }
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 3, width: 3, height: 1)
        )
        state.shared.activeTool = .eraser
        state.shared.pixelPerfect = false

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 3))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 3))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 3) == red)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 3) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 3) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 3) == red)
    }

    @Test("flood fill seeded outside the Marquee is a no-op")
    func floodFillSeededOutsideIsNoOp() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
        state.shared.activeTool = .floodFill

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 3))
        state.activeTab.endStroke()

        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(!state.activeTab.canUndo)
    }

    @Test("without a Marquee drawing passes through unchanged")
    func drawingWithoutMarqueePassesThrough() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .pencil
        state.shared.pixelPerfect = false

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 3))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 3) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 3) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 3, y: 3) == state.shared.foregroundColor)
        #expect(paintedPixelCount(state.activeTab) == 3)
    }

    @Test("a Marquee cropped away by resize does not disable drawing")
    func fullyCroppedMarqueeDoesNotDisableDrawing() throws {
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 10, y: 10, width: 2, height: 2)
        )
        state.shared.activeTool = .pencil
        state.shared.pixelPerfect = false

        state.activeTab.resizeCanvas(width: 8, height: 8)
        #expect(state.activeTab.document.marquee() == nil)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()

        #expect(
            try state.activeTab.document.getPixel(x: 1, y: 1)
                == state.shared.foregroundColor
        )
    }

    @Test("Move translates the whole layer despite an active Marquee")
    func moveIgnoresMarquee() throws {
        let state = Workspace(width: 8, height: 8)
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        try state.activeTab.document.setPixel(x: 0, y: 0, color: red)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 4, y: 4, width: 2, height: 2)
        )
        state.shared.activeTool = .move

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 1) == red)
        #expect(paintedPixelCount(state.activeTab) == 1)
    }

    @Test("Eyedropper samples outside an active Marquee")
    func eyedropperIgnoresMarquee() throws {
        let state = Workspace(width: 8, height: 8)
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        try state.activeTab.document.setPixel(x: 0, y: 0, color: red)
        try state.activeTab.document.setMarquee(
            region: AppleMarqueeRegion(x: 4, y: 4, width: 2, height: 2)
        )
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.endStroke()

        #expect(state.shared.foregroundColor == red)
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == red)
    }

    private func paintedCoordinates(_ state: Workspace) throws -> [ScreenCanvasCoords] {
        var result: [ScreenCanvasCoords] = []
        for y in 0..<state.activeTab.document.height() {
            for x in 0..<state.activeTab.document.width() {
                if try state.activeTab.document.getPixel(x: x, y: y).a > 0 {
                    result.append(ScreenCanvasCoords(x: Int32(x), y: Int32(y)))
                }
            }
        }
        return result
    }
}
