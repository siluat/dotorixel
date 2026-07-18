import Testing
@testable import Dotorixel

/// Eyedropper tool behavior, exercised through the `EditorState` public
/// stroke API: drag to sample, commit on release (web parity, 234).
@Suite("Eyedropper strokes — drag to sample, commit on release")
struct EyedropperStrokeSessionTests {

    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("releasing over an opaque pixel commits its color to the foreground")
    func releaseOverOpaquePixelCommitsForeground() throws {
        let state = EditorState(width: 8, height: 8)
        try state.pixelCanvas.setPixel(x: 5, y: 5, color: red)
        state.activeTool = .eyedropper

        // Press over an empty pixel, drag onto the red one, release there:
        // the committed color is the pixel under the pointer at release.
        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))
        state.endStroke()

        #expect(state.foregroundColor == red)
    }

    @Test("releasing over a transparent pixel commits nothing")
    func releaseOverTransparentPixelCommitsNothing() {
        let state = EditorState(width: 8, height: 8)
        let initialForeground = state.foregroundColor
        state.activeTool = .eyedropper

        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.endStroke()

        #expect(state.foregroundColor == initialForeground)
    }

    @Test("a secondary-button release commits to the background color")
    func secondaryButtonCommitsBackground() throws {
        let state = EditorState(width: 8, height: 8)
        try state.pixelCanvas.setPixel(x: 3, y: 3, color: red)
        state.activeTool = .eyedropper
        let initialForeground = state.foregroundColor

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3), button: .secondary)
        state.endStroke()

        #expect(state.backgroundColor == red)
        #expect(state.foregroundColor == initialForeground)
    }

    @Test("releasing outside the canvas commits nothing")
    func releaseOutOfBoundsCommitsNothing() throws {
        let state = EditorState(width: 8, height: 8)
        // Pressed over an opaque pixel — only the release position matters.
        try state.pixelCanvas.setPixel(x: 0, y: 0, color: red)
        state.activeTool = .eyedropper
        let initialForeground = state.foregroundColor

        // Both sides of the bounds: negative and beyond-dimension coordinates.
        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: -3, y: -3))
        state.endStroke()
        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: 100, y: 100))
        state.endStroke()

        #expect(state.foregroundColor == initialForeground)
    }

    @Test("committing a sample records no undo entry")
    func commitRecordsNoUndoEntry() throws {
        let state = EditorState(width: 8, height: 8)
        // One undoable pencil dot, then an eyedropper pick over it.
        state.activeTool = .pencil
        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.endStroke()
        state.activeTool = .eyedropper
        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.endStroke()

        // The color pick added no entry: one undo reverts the pencil dot…
        state.handleUndo()
        #expect(try state.pixelCanvas.getPixel(x: 0, y: 0).a == 0)
        // …and nothing is left to undo.
        #expect(!state.canUndo)
    }

    @Test("a canceled stroke discards the pending sample without committing")
    func cancelDiscardsPendingSample() throws {
        let state = EditorState(width: 8, height: 8)
        try state.pixelCanvas.setPixel(x: 4, y: 4, color: red)
        state.activeTool = .eyedropper
        let initialForeground = state.foregroundColor

        state.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.cancelStroke()

        #expect(state.foregroundColor == initialForeground)
    }
}
