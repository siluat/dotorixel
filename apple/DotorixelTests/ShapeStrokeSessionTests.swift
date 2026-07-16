import Testing
@testable import Dotorixel

/// Shape tool session behavior (line/rectangle/ellipse), exercised through the
/// `EditorState` public stroke API: live drag preview via snapshot-restore,
/// commit on release, cancel restoring the pre-stroke canvas.
@Suite("Shape strokes — preview, commit, cancel")
struct ShapeStrokeSessionTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)

    @Test("a rectangle drag commits the outline, leaving the interior untouched")
    func rectangleCommitsOutline() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .rectangle

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.endStroke()

        let fg = state.foregroundColor
        #expect(try state.pixelCanvas.getPixel(x: 1, y: 1) == fg)
        #expect(try state.pixelCanvas.getPixel(x: 4, y: 1) == fg)
        #expect(try state.pixelCanvas.getPixel(x: 1, y: 3) == fg)
        #expect(try state.pixelCanvas.getPixel(x: 4, y: 3) == fg)
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 1) == fg)
        #expect(try state.pixelCanvas.getPixel(x: 1, y: 2) == fg)
        // Outline only — the interior stays untouched.
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 2) == transparent)
        #expect(try state.pixelCanvas.getPixel(x: 3, y: 2) == transparent)
    }

    @Test("shrinking the drag restores pixels the larger preview painted")
    func dragShrinkRestoresPreviousPreview() throws {
        let state = EditorState(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        // Pre-existing art on the larger preview's path but not the smaller's.
        try state.pixelCanvas.setPixel(x: 5, y: 1, color: red)
        state.activeTool = .rectangle

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.continueStroke(to: ScreenCanvasCoords(x: 6, y: 6))
        state.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))

        // The 1,1→6,6 preview's far edges are back to their pre-stroke state…
        #expect(try state.pixelCanvas.getPixel(x: 6, y: 6) == transparent)
        #expect(try state.pixelCanvas.getPixel(x: 6, y: 1) == transparent)
        #expect(try state.pixelCanvas.getPixel(x: 1, y: 6) == transparent)
        #expect(try state.pixelCanvas.getPixel(x: 5, y: 1) == red)
        // …while the current 1,1→3,3 preview is painted.
        #expect(try state.pixelCanvas.getPixel(x: 1, y: 1) == state.foregroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 3, y: 3) == state.foregroundColor)
    }

    @Test("a single click (press + release without moving) stamps one pixel")
    func singleClickStampsOnePixel() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .rectangle

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.endStroke()

        #expect(try state.pixelCanvas.getPixel(x: 3, y: 4) == state.foregroundColor)
        #expect(paintedPixelCount(state) == 1)
    }

    @Test("one undo removes the whole committed shape, restoring pixels under it")
    func oneUndoRemovesCommittedShape() throws {
        let state = EditorState(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        // Pre-existing art on the outline path, painted over by the shape.
        try state.pixelCanvas.setPixel(x: 2, y: 1, color: red)
        state.activeTool = .rectangle

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.endStroke()
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 1) == state.foregroundColor)

        state.handleUndo()

        #expect(try state.pixelCanvas.getPixel(x: 2, y: 1) == red)
        #expect(try state.pixelCanvas.getPixel(x: 1, y: 1) == transparent)
        #expect(try state.pixelCanvas.getPixel(x: 4, y: 3) == transparent)
    }

    @Test("a line drag commits only the anchor→release segment, not the drag path")
    func lineCommitsAnchorToReleaseSegment() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .line

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        // Wander before settling: only the final anchor→current line may remain.
        state.continueStroke(to: ScreenCanvasCoords(x: 8, y: 2))
        state.continueStroke(to: ScreenCanvasCoords(x: 4, y: 4))
        state.endStroke()

        let committed = Set(appleInterpolatePixels(x0: 0, y0: 0, x1: 4, y1: 4))
        for pixel in committed {
            #expect(try state.pixelCanvas.getPixel(x: UInt32(pixel.x), y: UInt32(pixel.y)) == state.foregroundColor)
        }
        #expect(paintedPixelCount(state) == committed.count)
    }

    @Test("an ellipse drag commits the outline matching the core geometry")
    func ellipseCommitsOutline() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .ellipse

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: 6, y: 4))
        state.endStroke()

        let outline = Set(appleEllipseOutline(x0: 0, y0: 0, x1: 6, y1: 4))
        for pixel in outline {
            #expect(try state.pixelCanvas.getPixel(x: UInt32(pixel.x), y: UInt32(pixel.y)) == state.foregroundColor)
        }
        #expect(paintedPixelCount(state) == outline.count)
    }

    @Test("cancel restores the canvas to its pre-stroke state and keeps history consistent")
    func cancelRestoresPreStrokeCanvas() throws {
        let state = EditorState(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.pixelCanvas.setPixel(x: 2, y: 1, color: red)
        state.activeTool = .rectangle

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.cancelStroke()

        // The preview is fully discarded — no shape committed.
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 1) == red)
        #expect(paintedPixelCount(state) == 1)
        #expect(!state.isDrawing)
        // Undo after cancel restores the identical pre-stroke state (web parity).
        state.handleUndo()
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 1) == red)
        #expect(paintedPixelCount(state) == 1)
    }

    @Test("a drag that leaves the canvas still erases the previous preview from the screen")
    func outOfCanvasDragErasesPreviousPreview() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .rectangle

        // Anchor out of canvas; the drag dips inside, painting a partial preview…
        state.beginStroke(at: ScreenCanvasCoords(x: -3, y: -3))
        state.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))
        #expect(paintedPixelCount(state) > 0)
        let versionAfterInside = state.canvasVersion

        // …then leaves entirely: the restore must reach the screen as a re-render.
        state.continueStroke(to: ScreenCanvasCoords(x: -1, y: -1))

        #expect(paintedPixelCount(state) == 0)
        #expect(state.canvasVersion > versionAfterInside)
    }

    @Test("an out-of-canvas stroke begin does not trigger a re-render")
    func outOfCanvasBeginDoesNotRerender() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .rectangle
        let versionBefore = state.canvasVersion

        state.beginStroke(at: ScreenCanvasCoords(x: -3, y: -3))

        #expect(state.canvasVersion == versionBefore)
    }

    @Test("a secondary-button shape stroke previews and commits in the background color")
    func secondaryButtonShapeCommitsBackground() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .rectangle

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1), button: .secondary)
        state.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.endStroke()

        #expect(try state.pixelCanvas.getPixel(x: 1, y: 1) == state.backgroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 4, y: 3) == state.backgroundColor)
    }

    @Test("mid-stroke foreground color changes don't affect the shape in flight")
    func midStrokeColorChangeIsIgnored() throws {
        let state = EditorState(width: 16, height: 16)
        let originalColor = state.foregroundColor
        state.activeTool = .rectangle

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.foregroundColor = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        state.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.endStroke()

        // The redrawn preview still uses the color captured at stroke begin.
        #expect(try state.pixelCanvas.getPixel(x: 4, y: 3) == originalColor)
    }

    /// Number of canvas pixels with a non-zero alpha channel.
    private func paintedPixelCount(_ state: EditorState) -> Int {
        let pixels = state.pixelCanvas.pixels()
        return stride(from: 3, to: pixels.count, by: 4).count { pixels[$0] != 0 }
    }
}
