import Testing
@testable import Dotorixel

@Suite("EditorState — resizeCanvas")
struct EditorStateResizeCanvasTests {

    @Test("resize updates canvas dimensions")
    func resizeUpdatesDimensions() {
        let state = EditorState(width: 16, height: 16)

        state.resizeCanvas(width: 32, height: 24)

        #expect(state.pixelCanvas.width() == 32)
        #expect(state.pixelCanvas.height() == 24)
    }

    @Test("resize bumps canvasVersion to trigger re-render")
    func resizeBumpsCanvasVersion() {
        let state = EditorState(width: 16, height: 16)
        let before = state.canvasVersion

        state.resizeCanvas(width: 32, height: 32)

        #expect(state.canvasVersion == before + 1)
    }

    @Test("resize to same dimensions is a no-op")
    func resizeSameDimensionsIsNoop() {
        let state = EditorState(width: 16, height: 16)
        let versionBefore = state.canvasVersion

        state.resizeCanvas(width: 16, height: 16)

        #expect(state.canvasVersion == versionBefore)
    }

    @Test("resize silently rejects invalid dimensions (zero, above max)")
    func resizeRejectsInvalidDimensions() {
        let state = EditorState(width: 16, height: 16)
        let versionBefore = state.canvasVersion

        state.resizeCanvas(width: 0, height: 16)
        state.resizeCanvas(width: 16, height: 0)
        state.resizeCanvas(width: canvasMaxDimension() + 1, height: 16)
        state.resizeCanvas(width: 16, height: canvasMaxDimension() + 1)

        #expect(state.pixelCanvas.width() == 16)
        #expect(state.pixelCanvas.height() == 16)
        #expect(state.canvasVersion == versionBefore)
    }

    @Test("resize clears history so canUndo doesn't lie about pre-resize snapshots")
    func resizeClearsHistory() {
        let state = EditorState(width: 16, height: 16)
        state.handleDrawStart()
        #expect(state.canUndo == true)

        state.resizeCanvas(width: 32, height: 32)

        #expect(state.canUndo == false)
        #expect(state.canRedo == false)
    }
}

@Suite("EditorState — handleClearCanvas")
struct EditorStateClearCanvasTests {

    @Test("clear erases all pixels to transparent")
    func clearErasesAllPixels() throws {
        let state = EditorState(width: 16, height: 16)
        try state.pixelCanvas.setPixel(x: 3, y: 4, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))

        state.handleClearCanvas()

        #expect(state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
    }

    @Test("clear bumps canvasVersion to trigger re-render")
    func clearBumpsCanvasVersion() {
        let state = EditorState(width: 16, height: 16)
        let before = state.canvasVersion

        state.handleClearCanvas()

        #expect(state.canvasVersion == before + 1)
    }

    @Test("undo after clear restores the pre-clear pixels")
    func undoAfterClearRestoresPixels() throws {
        let state = EditorState(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.pixelCanvas.setPixel(x: 3, y: 4, color: red)

        state.handleClearCanvas()
        state.handleUndo()

        #expect(try state.pixelCanvas.getPixel(x: 3, y: 4) == red)
    }

    @Test("redo after undo re-applies the clear")
    func redoReappliesClear() throws {
        let state = EditorState(width: 16, height: 16)
        try state.pixelCanvas.setPixel(x: 3, y: 4, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        state.handleClearCanvas()
        state.handleUndo()

        state.handleRedo()

        #expect(state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
    }

    @Test("clear is a no-op while a drawing stroke is in progress")
    func clearIsNoopWhileDrawing() throws {
        let state = EditorState(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.pixelCanvas.setPixel(x: 3, y: 4, color: red)
        state.handleDrawStart()
        let canvasVersionBefore = state.canvasVersion
        let historyVersionBefore = state.historyVersion

        state.handleClearCanvas()

        #expect(try state.pixelCanvas.getPixel(x: 3, y: 4) == red)
        #expect(state.canvasVersion == canvasVersionBefore)
        #expect(state.historyVersion == historyVersionBefore)
    }
}
