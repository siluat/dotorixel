import Testing
@testable import Dotorixel

@Suite("TabState — canvas transforms")
struct TabStateCanvasTransformTests {

    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("flipCanvasHorizontal mirrors the pixels as one undoable edit")
    func flipHorizontalMirrorsAndUndoRestores() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        try tab.document.setPixel(x: 0, y: 1, color: red)

        tab.flipCanvasHorizontal()

        #expect(try tab.document.getPixel(x: 3, y: 1) == red)
        #expect(try tab.document.getPixel(x: 0, y: 1).a == 0)

        tab.handleUndo()
        #expect(try tab.document.getPixel(x: 0, y: 1) == red)
        #expect(!tab.canUndo)
    }

    @Test("flipCanvasVertical mirrors the pixels top↔bottom as one undoable edit")
    func flipVerticalMirrorsAndUndoRestores() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        try tab.document.setPixel(x: 1, y: 0, color: red)

        tab.flipCanvasVertical()

        #expect(try tab.document.getPixel(x: 1, y: 3) == red)
        #expect(try tab.document.getPixel(x: 1, y: 0).a == 0)

        tab.handleUndo()
        #expect(try tab.document.getPixel(x: 1, y: 0) == red)
        #expect(!tab.canUndo)
    }

    @Test("rotateCanvasCw turns the pixels and swaps W↔H; undo restores both")
    func rotateCwTurnsAndSwapsDimensions() throws {
        let state = Workspace(width: 4, height: 2)
        let tab = state.activeTab
        // Top-left corner lands at the top-right corner after a CW turn.
        try tab.document.setPixel(x: 0, y: 0, color: red)

        tab.rotateCanvasCw()

        #expect(tab.document.width() == 2)
        #expect(tab.document.height() == 4)
        #expect(try tab.document.getPixel(x: 1, y: 0) == red)

        tab.handleUndo()
        #expect(tab.document.width() == 4)
        #expect(tab.document.height() == 2)
        #expect(try tab.document.getPixel(x: 0, y: 0) == red)
        #expect(!tab.canUndo)

        tab.handleRedo()
        #expect(tab.document.width() == 2)
        #expect(tab.document.height() == 4)
        #expect(try tab.document.getPixel(x: 1, y: 0) == red)
    }

    @Test("rotateCanvasCcw turns the pixels the other way and swaps W↔H")
    func rotateCcwTurnsAndSwapsDimensions() throws {
        let state = Workspace(width: 4, height: 2)
        let tab = state.activeTab
        // Top-left corner lands at the bottom-left corner after a CCW turn.
        try tab.document.setPixel(x: 0, y: 0, color: red)

        tab.rotateCanvasCcw()

        #expect(tab.document.width() == 2)
        #expect(tab.document.height() == 4)
        #expect(try tab.document.getPixel(x: 0, y: 3) == red)

        tab.handleUndo()
        #expect(tab.document.width() == 4)
        #expect(try tab.document.getPixel(x: 0, y: 0) == red)
    }

    @Test("rotate reclamps the viewport pan and clears an out-of-bounds Hover Point")
    func rotateReclampsViewportAndClearsHoverPoint() {
        let state = Workspace(width: 16, height: 8)
        let tab = state.activeTab
        tab.viewportSize = ViewportSize(width: 400, height: 400)
        tab.viewport = AppleViewport(
            pixelSize: tab.viewport.pixelSize(),
            zoom: 1.0,
            panX: 100_000,
            panY: 100_000
        )
        // The right-edge cell — off-canvas once the W↔H swap shrinks width to 8.
        tab.updateHoverPoint(to: ScreenCanvasCoords(x: 15, y: 0))

        tab.rotateCanvasCw()

        #expect(tab.viewport.panX() < 100_000)
        #expect(tab.viewport.panY() < 100_000)
        #expect(tab.hoverPoint == nil)
    }

    @Test("flip mirrors every layer together so multi-layer artwork stays aligned")
    func flipMirrorsEveryLayer() throws {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)
        let bottomLayerId = tab.document.activeLayerId()
        try tab.document.setPixel(x: 0, y: 0, color: red)
        tab.addLayer()
        try tab.document.setPixel(x: 1, y: 0, color: blue)

        tab.flipCanvasHorizontal()

        // Both layers mirrored around the same axis — adjacent cells stay adjacent.
        try tab.document.setActiveLayer(id: bottomLayerId)
        #expect(try tab.document.getPixel(x: 3, y: 0) == red)
        let layers = tab.document.layers()
        try tab.document.setActiveLayer(id: layers[1].id)
        #expect(try tab.document.getPixel(x: 2, y: 0) == blue)
    }

    @Test("rotate turns every layer together so multi-layer artwork stays aligned")
    func rotateTurnsEveryLayer() throws {
        let state = Workspace(width: 4, height: 2)
        let tab = state.activeTab
        let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)
        let bottomLayerId = tab.document.activeLayerId()
        try tab.document.setPixel(x: 0, y: 0, color: red)
        tab.addLayer()
        try tab.document.setPixel(x: 1, y: 0, color: blue)

        tab.rotateCanvasCw()

        // Both layers turned around the same pivot — adjacent cells stay adjacent.
        try tab.document.setActiveLayer(id: bottomLayerId)
        #expect(try tab.document.getPixel(x: 1, y: 0) == red)
        let layers = tab.document.layers()
        try tab.document.setActiveLayer(id: layers[1].id)
        #expect(try tab.document.getPixel(x: 1, y: 1) == blue)
    }

    @Test("an active Marquee is co-transformed and restored by undo")
    func marqueeIsCoTransformedAndRestoredByUndo() throws {
        let state = Workspace(width: 8, height: 4)
        let tab = state.activeTab
        try tab.document.setPixel(x: 0, y: 0, color: red)
        let marquee = AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 1)
        try tab.document.setMarquee(region: marquee)

        tab.flipCanvasHorizontal()

        // The core mirrors the region to the opposite edge.
        #expect(tab.document.marquee() == AppleMarqueeRegion(x: 6, y: 0, width: 2, height: 1))

        // The whole-document snapshot carries the Marquee back with the pixels.
        tab.handleUndo()
        #expect(tab.document.marquee() == marquee)
    }

    @Test("transforms are no-ops while a drawing stroke is in progress")
    func transformsAreNoopsWhileDrawing() throws {
        let state = Workspace(width: 4, height: 2)
        let tab = state.activeTab
        try tab.document.setPixel(x: 0, y: 0, color: red)
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 1))

        tab.flipCanvasHorizontal()
        tab.flipCanvasVertical()
        tab.rotateCanvasCw()
        tab.rotateCanvasCcw()

        #expect(tab.document.width() == 4)
        #expect(try tab.document.getPixel(x: 0, y: 0) == red)
        // The live stroke is undisturbed — its baseline still commits at end.
        tab.endStroke()
        #expect(tab.canUndo)
    }

    @Test("a transform that leaves a symmetric document unchanged records no history entry")
    func symmetricDocumentTransformRecordsNoEntry() {
        // A fully transparent square document is symmetric under every
        // transform — rotates included, since W↔H swap to the same values.
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        let versionBefore = tab.canvasVersion

        tab.flipCanvasHorizontal()
        tab.flipCanvasVertical()
        tab.rotateCanvasCw()
        tab.rotateCanvasCcw()

        #expect(!tab.canUndo)
        #expect(tab.canvasVersion == versionBefore)
    }
}
