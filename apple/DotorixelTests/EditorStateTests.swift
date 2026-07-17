import Testing
@testable import Dotorixel

@Suite("EditorState — FG/BG colors")
struct EditorStateColorTests {

    @Test("defaults match the web editor: foreground black, background white")
    func defaultsMatchWeb() {
        let state = EditorState(width: 16, height: 16)

        #expect(state.foregroundColor == Color(r: 0x00, g: 0x00, b: 0x00, a: 0xFF))
        #expect(state.backgroundColor == Color(r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF))
    }

    @Test("swapColors exchanges foreground and background")
    func swapColorsExchangesForegroundAndBackground() {
        let state = EditorState(width: 16, height: 16)
        let fg = Color(r: 0xB0, g: 0x7A, b: 0x30, a: 0xFF)
        let bg = Color(r: 0x11, g: 0x22, b: 0x33, a: 0xFF)
        state.foregroundColor = fg
        state.backgroundColor = bg

        state.swapColors()

        #expect(state.foregroundColor == bg)
        #expect(state.backgroundColor == fg)
    }

    @Test("a secondary-button stroke paints the background color")
    func secondaryButtonStrokePaintsBackground() throws {
        let state = EditorState(width: 16, height: 16)

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4), button: .secondary)
        state.continueStroke(to: ScreenCanvasCoords(x: 5, y: 4))

        #expect(try state.pixelCanvas.getPixel(x: 3, y: 4) == state.backgroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 5, y: 4) == state.backgroundColor)
    }

    @Test("swapping colors mid-stroke doesn't change the stroke in flight")
    func midStrokeSwapIsIgnored() throws {
        let state = EditorState(width: 16, height: 16)
        let originalBackground = state.backgroundColor

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0), button: .secondary)
        state.swapColors()
        state.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))

        #expect(try state.pixelCanvas.getPixel(x: 2, y: 0) == originalBackground)
    }

    @Test("a secondary-button eraser stroke still erases to transparent")
    func secondaryButtonEraserStillErases() throws {
        let state = EditorState(width: 16, height: 16)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        try state.pixelCanvas.setPixel(x: 5, y: 5, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        state.activeTool = .eraser

        state.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5), button: .secondary)

        #expect(try state.pixelCanvas.getPixel(x: 5, y: 5) == transparent)
    }
}

@Suite("EditorState — stroke lifecycle")
struct EditorStateStrokeTests {

    @Test("the first sample paints the foreground color; the undo entry commits at stroke end")
    func beginStrokePaintsAndCommitsUndoAtEnd() throws {
        let state = EditorState(width: 16, height: 16)
        let versionBefore = state.canvasVersion

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))

        #expect(try state.pixelCanvas.getPixel(x: 3, y: 4) == state.foregroundColor)
        #expect(state.canvasVersion == versionBefore + 1)
        #expect(state.isDrawing)
        // The Edit Baseline is pending, not committed — undo is sealed
        // while drawing, so nothing is on the stack yet.
        #expect(!state.canUndo)

        state.endStroke()
        #expect(state.canUndo)
    }

    @Test("a begin during an active stroke resolves the previous Edit Baseline first")
    func beginWhileDrawingResolvesPreviousBaseline() throws {
        let state = EditorState(width: 16, height: 16)

        // A second finger can begin a stroke while one is active (iPadOS).
        // The first stroke painted, so its baseline must commit — not leak
        // into or get overwritten by the second stroke's begin.
        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.endStroke()

        #expect(try state.pixelCanvas.getPixel(x: 1, y: 1) == state.foregroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 5, y: 5) == state.foregroundColor)

        // Two committed strokes → two undo steps, each reverting one.
        state.handleUndo()
        #expect(try state.pixelCanvas.getPixel(x: 5, y: 5).a == 0)
        #expect(try state.pixelCanvas.getPixel(x: 1, y: 1) == state.foregroundColor)
        state.handleUndo()
        #expect(state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
    }

    @Test("retracing pixels with their own color is a no-op stroke — no undo entry")
    func sameColorRetraceLeavesNoUndoEntry() throws {
        let state = EditorState(width: 16, height: 16)
        try state.pixelCanvas.setPixel(x: 3, y: 4, color: state.foregroundColor)
        try state.pixelCanvas.setPixel(x: 4, y: 4, color: state.foregroundColor)

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.continueStroke(to: ScreenCanvasCoords(x: 4, y: 4))
        state.endStroke()

        #expect(!state.canUndo)
    }

    @Test("a fast drag paints the interpolated segment between samples")
    func continueStrokeInterpolatesGaps() throws {
        let state = EditorState(width: 16, height: 16)

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))

        // Bresenham diagonal: the skipped pixels between the two samples are filled.
        #expect(try state.pixelCanvas.getPixel(x: 1, y: 1) == state.foregroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 2) == state.foregroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 3, y: 3) == state.foregroundColor)
    }

    @Test("one undo reverts the whole stroke")
    func oneUndoRevertsWholeStroke() {
        let state = EditorState(width: 16, height: 16)

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))
        state.continueStroke(to: ScreenCanvasCoords(x: 7, y: 2))
        state.endStroke()
        state.handleUndo()

        #expect(state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
        #expect(!state.isDrawing)
    }

    @Test("cancel tears the stroke down; freehand keeps its painted pixels")
    func cancelStrokeTearsDown() throws {
        let state = EditorState(width: 16, height: 16)

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.cancelStroke()

        #expect(!state.isDrawing)
        #expect(try state.pixelCanvas.getPixel(x: 3, y: 4) == state.foregroundColor)
        // The interrupted stroke still stands as one undoable step.
        state.handleUndo()
        #expect(state.pixelCanvas.pixels().allSatisfy { $0 == 0 })
    }

    @Test("a repeated sample on the same pixel does not trigger a re-render")
    func redundantSampleDoesNotRerender() {
        let state = EditorState(width: 16, height: 16)
        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        let versionAfterBegin = state.canvasVersion

        state.continueStroke(to: ScreenCanvasCoords(x: 3, y: 4))

        #expect(state.canvasVersion == versionAfterBegin)
    }

    @Test("eraser strokes erase to transparent")
    func eraserErasesToTransparent() throws {
        let state = EditorState(width: 16, height: 16)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        try state.pixelCanvas.setPixel(x: 5, y: 5, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        state.activeTool = .eraser

        state.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(try state.pixelCanvas.getPixel(x: 5, y: 5) == transparent)
    }

    @Test("mid-stroke foreground color changes don't affect the stroke in flight")
    func midStrokeColorChangeIsIgnored() throws {
        let state = EditorState(width: 16, height: 16)
        let originalColor = state.foregroundColor

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.foregroundColor = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        state.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))

        #expect(try state.pixelCanvas.getPixel(x: 2, y: 0) == originalColor)
    }

    @Test("mid-stroke tool changes don't affect the stroke in flight")
    func midStrokeToolChangeIsIgnored() throws {
        let state = EditorState(width: 16, height: 16)

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTool = .eraser
        state.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))

        // Still painting with the pencil resolved at begin, not erasing.
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 0) == state.foregroundColor)
    }
}

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

    @Test("resize is a no-op while a drawing stroke is in progress")
    func resizeIsNoopWhileDrawing() {
        let state = EditorState(width: 16, height: 16)
        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))

        state.resizeCanvas(width: 32, height: 32)

        #expect(state.pixelCanvas.width() == 16)
        #expect(state.pixelCanvas.height() == 16)
        // The live stroke is undisturbed — its baseline still commits at end.
        state.endStroke()
        #expect(state.canUndo)
    }

    @Test("resize clears history so canUndo doesn't lie about pre-resize snapshots")
    func resizeClearsHistory() {
        let state = EditorState(width: 16, height: 16)
        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.endStroke()
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
        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        let canvasVersionBefore = state.canvasVersion
        let historyVersionBefore = state.historyVersion

        state.handleClearCanvas()

        #expect(try state.pixelCanvas.getPixel(x: 3, y: 4) == red)
        #expect(state.canvasVersion == canvasVersionBefore)
        #expect(state.historyVersion == historyVersionBefore)
    }
}
