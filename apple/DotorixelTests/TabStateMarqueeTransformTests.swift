import Testing
@testable import Dotorixel

@Suite("TabState — Marquee transforms")
struct TabStateMarqueeTransformTests {

    private let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
    private let green = Color(r: 0, g: 0xFF, b: 0, a: 0xFF)

    @Test("flipMarqueeHorizontal mirrors only the Marquee as one undoable Edit")
    func flipHorizontalMirrorsAndUndoRestores() throws {
        let workspace = Workspace(width: 4, height: 2)
        let tab = workspace.activeTab
        try tab.document.setPixel(x: 0, y: 0, color: red)
        try tab.document.setPixel(x: 1, y: 0, color: green)
        try tab.document.setPixel(x: 3, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 1)
        )

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
        let workspace = Workspace(width: 3, height: 4)
        let tab = workspace.activeTab
        try tab.document.setPixel(x: 1, y: 0, color: red)
        try tab.document.setPixel(x: 1, y: 1, color: green)
        try tab.document.setPixel(x: 2, y: 3, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 2)
        )

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
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let originalMarquee = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 1)
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setPixel(x: 2, y: 1, color: green)
        try tab.document.setPixel(x: 3, y: 3, color: red)
        try tab.document.setMarquee(region: originalMarquee)

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
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let originalMarquee = AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 1)
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setPixel(x: 2, y: 1, color: green)
        try tab.document.setPixel(x: 3, y: 3, color: red)
        try tab.document.setMarquee(region: originalMarquee)

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
}
