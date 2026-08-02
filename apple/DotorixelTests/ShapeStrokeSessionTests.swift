import Testing
@testable import Dotorixel

/// Shape tool session behavior (line/rectangle/ellipse), exercised through the
/// `TabState` public stroke API: live drag preview via snapshot-restore,
/// commit on release, cancel restoring the pre-stroke canvas.
@Suite("Shape strokes — preview, commit, cancel")
struct ShapeStrokeSessionTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)

    @Test("a rectangle drag commits the outline, leaving the interior untouched")
    func rectangleCommitsOutline() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .rectangle

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.activeTab.endStroke()

        let fg = state.shared.foregroundColor
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == fg)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 1) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 3) == fg)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 3) == fg)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 1) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 2) == fg)
        // Outline only — the interior stays untouched.
        #expect(try state.activeTab.document.getPixel(x: 2, y: 2) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 3, y: 2) == transparent)
    }

    @Test("shrinking the drag restores pixels the larger preview painted")
    func dragShrinkRestoresPreviousPreview() throws {
        let state = Workspace(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        // Pre-existing art on the larger preview's path but not the smaller's.
        try state.activeTab.document.setPixel(x: 5, y: 1, color: red)
        state.shared.activeTool = .rectangle

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 6, y: 6))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))

        // The 1,1→6,6 preview's far edges are back to their pre-stroke state…
        #expect(try state.activeTab.document.getPixel(x: 6, y: 6) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 6, y: 1) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 6) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 1) == red)
        // …while the current 1,1→3,3 preview is painted.
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 3, y: 3) == state.shared.foregroundColor)
    }

    @Test("a single click (press + release without moving) stamps one pixel")
    func singleClickStampsOnePixel() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .rectangle

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == state.shared.foregroundColor)
        #expect(paintedPixelCount(state.activeTab) == 1)
    }

    @Test("one undo removes the whole committed shape, restoring pixels under it")
    func oneUndoRemovesCommittedShape() throws {
        let state = Workspace(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        // Pre-existing art on the outline path, painted over by the shape.
        try state.activeTab.document.setPixel(x: 2, y: 1, color: red)
        state.shared.activeTool = .rectangle

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.activeTab.endStroke()
        #expect(try state.activeTab.document.getPixel(x: 2, y: 1) == state.shared.foregroundColor)

        state.activeTab.handleUndo()

        #expect(try state.activeTab.document.getPixel(x: 2, y: 1) == red)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 3) == transparent)
    }

    @Test("a line drag commits only the anchor→release segment, not the drag path")
    func lineCommitsAnchorToReleaseSegment() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .line

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        // Wander before settling: only the final anchor→current line may remain.
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 8, y: 2))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 4))
        state.activeTab.endStroke()

        let committed = Set(appleInterpolatePixels(x0: 0, y0: 0, x1: 4, y1: 4))
        for pixel in committed {
            #expect(try state.activeTab.document.getPixel(x: UInt32(pixel.x), y: UInt32(pixel.y)) == state.shared.foregroundColor)
        }
        #expect(paintedPixelCount(state.activeTab) == committed.count)
    }

    @Test("an ellipse drag commits the outline matching the core geometry")
    func ellipseCommitsOutline() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .ellipse

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 6, y: 4))
        state.activeTab.endStroke()

        let outline = Set(appleEllipseOutline(x0: 0, y0: 0, x1: 6, y1: 4))
        for pixel in outline {
            #expect(try state.activeTab.document.getPixel(x: UInt32(pixel.x), y: UInt32(pixel.y)) == state.shared.foregroundColor)
        }
        #expect(paintedPixelCount(state.activeTab) == outline.count)
    }

    @Test("cancel restores the canvas to its pre-stroke state and leaves no undo entry")
    func cancelRestoresPreStrokeCanvas() throws {
        let state = Workspace(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.activeTab.document.setPixel(x: 2, y: 1, color: red)
        state.shared.activeTool = .rectangle

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.activeTab.cancelStroke()

        // The preview is fully discarded — no shape committed.
        #expect(try state.activeTab.document.getPixel(x: 2, y: 1) == red)
        #expect(paintedPixelCount(state.activeTab) == 1)
        #expect(!state.activeTab.isDrawing)
        // The cancel restored the baseline, so the stroke resolved as a no-op
        // — no History entry to undo (243).
        #expect(!state.activeTab.canUndo)
    }

    @Test("a drag that leaves the canvas still erases the previous preview from the screen")
    func outOfCanvasDragErasesPreviousPreview() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .rectangle

        // Anchor out of canvas; the drag dips inside, painting a partial preview…
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: -3, y: -3))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))
        #expect(paintedPixelCount(state.activeTab) > 0)
        let versionAfterInside = state.activeTab.canvasVersion

        // …then leaves entirely: the restore must reach the screen as a re-render.
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: -1, y: -1))

        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(state.activeTab.canvasVersion > versionAfterInside)
    }

    @Test("an out-of-canvas stroke begin does not trigger a re-render")
    func outOfCanvasBeginDoesNotRerender() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .rectangle
        let versionBefore = state.activeTab.canvasVersion

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: -3, y: -3))

        #expect(state.activeTab.canvasVersion == versionBefore)
    }

    @Test("a secondary-button shape stroke previews and commits in the background color")
    func secondaryButtonShapeCommitsBackground() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .rectangle

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1), button: .secondary)
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == state.shared.backgroundColor)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 3) == state.shared.backgroundColor)
    }

    @Test("mid-stroke foreground color changes don't affect the shape in flight")
    func midStrokeColorChangeIsIgnored() throws {
        let state = Workspace(width: 16, height: 16)
        let originalColor = state.shared.foregroundColor
        state.shared.activeTool = .rectangle

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.shared.foregroundColor = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 3))
        state.activeTab.endStroke()

        // The redrawn preview still uses the color captured at stroke begin.
        #expect(try state.activeTab.document.getPixel(x: 4, y: 3) == originalColor)
    }

    /// Number of canvas pixels with a non-zero alpha channel.
}
