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
