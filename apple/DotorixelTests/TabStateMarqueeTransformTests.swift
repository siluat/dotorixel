import Testing
@testable import Dotorixel

@Suite("TabState — Marquee transforms")
struct TabStateMarqueeTransformTests {

    private let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
    private let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)

    private func applyEveryTransform(to tab: TabState) {
        tab.flipMarqueeHorizontal()
        tab.flipMarqueeVertical()
        tab.rotateMarqueeCw()
        tab.rotateMarqueeCcw()
    }

    @Test("flipMarqueeHorizontal mirrors only the Marquee as one undoable Edit")
    func flipHorizontalMirrorsAndUndoRestores() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 2)
        let preparedShared = SharedState()
        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setPixel(x: 1, y: 0, color: green)
        try preparedDocument.setPixel(x: 3, y: 1, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        tab.flipMarqueeHorizontal()

        #expect(try tab.document.getPixel(x: 0, y: 0) == green)
        #expect(try tab.document.getPixel(x: 1, y: 0) == red)
        #expect(try tab.document.getPixel(x: 3, y: 1) == red)
        #expect(tab.canUndo)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 0, y: 0) == red)
        #expect(try tab.document.getPixel(x: 1, y: 0) == green)
        #expect(!tab.canUndo)
    }

    @Test("flipMarqueeVertical mirrors only the Marquee as one undoable Edit")
    func flipVerticalMirrorsAndUndoRestores() throws {
        let preparedDocument = makeSingleLayerDocument(width: 3, height: 4)
        let preparedShared = SharedState()
        try preparedDocument.setPixel(x: 1, y: 0, color: red)
        try preparedDocument.setPixel(x: 1, y: 1, color: green)
        try preparedDocument.setPixel(x: 2, y: 3, color: red)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 2)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        tab.flipMarqueeVertical()

        #expect(try tab.document.getPixel(x: 1, y: 0) == green)
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 3) == red)
        #expect(tab.canUndo)

        tab.handleUndo()

        #expect(try tab.document.getPixel(x: 1, y: 0) == red)
        #expect(try tab.document.getPixel(x: 1, y: 1) == green)
        #expect(!tab.canUndo)
    }

    @Test("rotateMarqueeCw turns only the Marquee and its bounds as one undoable Edit")
    func rotateCwTurnsAndUndoRestores() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let originalMarquee = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 1)
        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setPixel(x: 2, y: 1, color: green)
        try preparedDocument.setPixel(x: 3, y: 3, color: red)
        try preparedDocument.setMarquee(region: originalMarquee)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        tab.rotateMarqueeCw()

        #expect(tab.marquee == AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 2))
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 1, y: 2) == green)
        #expect(try tab.document.getPixel(x: 3, y: 3) == red)
        #expect(tab.canUndo)

        tab.handleUndo()

        #expect(tab.marquee == originalMarquee)
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == green)
        #expect(!tab.canUndo)
    }

    @Test("rotateMarqueeCcw turns only the Marquee and its bounds as one undoable Edit")
    func rotateCcwTurnsAndUndoRestores() throws {
        let preparedDocument = makeSingleLayerDocument(width: 4, height: 4)
        let preparedShared = SharedState()
        let originalMarquee = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 1)
        try preparedDocument.setPixel(x: 1, y: 1, color: red)
        try preparedDocument.setPixel(x: 2, y: 1, color: green)
        try preparedDocument.setPixel(x: 3, y: 3, color: red)
        try preparedDocument.setMarquee(region: originalMarquee)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab

        tab.rotateMarqueeCcw()

        #expect(tab.marquee == AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 2))
        #expect(try tab.document.getPixel(x: 1, y: 1) == green)
        #expect(try tab.document.getPixel(x: 1, y: 2) == red)
        #expect(try tab.document.getPixel(x: 3, y: 3) == red)
        #expect(tab.canUndo)

        tab.handleUndo()

        #expect(tab.marquee == originalMarquee)
        #expect(try tab.document.getPixel(x: 1, y: 1) == red)
        #expect(try tab.document.getPixel(x: 2, y: 1) == green)
        #expect(!tab.canUndo)
    }

    @Test("all transforms are History-neutral without a Marquee")
    func transformsNoOpWithoutMarquee() throws {
        let preparedDocument = makeSingleLayerDocument(width: 2, height: 2)
        let preparedShared = SharedState()
        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
        let pixelsBefore = tab.document.composite()
        let versionBefore = tab.canvasVersion

        applyEveryTransform(to: tab)

        #expect(tab.document.composite() == pixelsBefore)
        #expect(tab.canvasVersion == versionBefore)
        #expect(!tab.canUndo)
    }

    @Test("all transforms ignore an active stroke")
    func transformsNoOpDuringStroke() throws {
        let preparedDocument = makeSingleLayerDocument(width: 2, height: 1)
        let preparedShared = SharedState()
        try preparedDocument.setPixel(x: 0, y: 0, color: red)
        try preparedDocument.setPixel(x: 1, y: 0, color: green)
        try preparedDocument.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 1)
        )
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared)
        let tab = workspace.activeTab
        tab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        let pixelsDuringStroke = tab.document.composite()
        let marqueeDuringStroke = tab.marquee
        let versionDuringStroke = tab.canvasVersion

        applyEveryTransform(to: tab)

        #expect(tab.document.composite() == pixelsDuringStroke)
        #expect(tab.marquee == marqueeDuringStroke)
        #expect(tab.canvasVersion == versionDuringStroke)
        #expect(tab.isDrawing)
        #expect(!tab.canUndo)

        tab.endStroke()
    }
}
