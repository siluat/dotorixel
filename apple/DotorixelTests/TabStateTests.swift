import Testing
@testable import Dotorixel

@Suite("TabState — Document model")
struct TabStateDocumentTests {

    @Test("a new editor holds a single-layer document of the requested dimensions")
    func newEditorHoldsSingleLayerDocument() {
        let state = Workspace(width: 16, height: 12)

        #expect(state.activeTab.document.width() == 16)
        #expect(state.activeTab.document.height() == 12)
        let layers = state.activeTab.document.layers()
        #expect(layers.count == 1)
        #expect(layers[0].visible)
        #expect(state.activeTab.document.activeLayerId() == layers[0].id)
    }

    @Test("a stroke draws into the document's active layer; undo and redo restore whole-document snapshots")
    func strokeDrawsIntoActiveLayerAndUndoRedoRestore() throws {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.activeTab.endStroke()
        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == state.shared.foregroundColor)

        state.activeTab.handleUndo()
        #expect(state.activeTab.document.composite().allSatisfy { $0 == 0 })

        state.activeTab.handleRedo()
        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == state.shared.foregroundColor)
    }
}

@Suite("TabState — blank-document detection")
struct TabStateBlankDetectionTests {

    @Test("a fresh document is blank; a painted one is not")
    func freshDocumentIsBlankPaintedIsNot() {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab

        #expect(tab.isDocumentBlank())

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()

        #expect(!tab.isDocumentBlank())
    }

    @Test("painted content on a hidden layer still counts as non-blank")
    func hiddenPaintedLayerCountsAsNonBlank() {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab
        let paintedLayerId = tab.document.activeLayerId()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        tab.setLayerVisibility(id: paintedLayerId, visible: false)

        // The composite is transparent, but the hidden layer's paint must
        // not be silently discarded by the tab-close flow.
        #expect(!tab.isDocumentBlank())
    }

    @Test("painted content on an inactive frame still counts as non-blank")
    func inactiveFramePaintCountsAsNonBlank() {
        let state = Workspace(width: 4, height: 4)
        let tab = state.activeTab

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        // The new frame is transparent and active — the paint lives on the
        // now-inactive first frame's cel, which must not be silently
        // discarded by the tab-close flow.
        tab.addFrame()

        #expect(!tab.isDocumentBlank())
    }
}

@Suite("SharedState — FG/BG colors")
struct SharedStateColorTests {

    @Test("defaults match the web editor: foreground black, background white")
    func defaultsMatchWeb() {
        let state = Workspace(width: 16, height: 16)

        #expect(state.shared.foregroundColor == Color(r: 0x00, g: 0x00, b: 0x00, a: 0xFF))
        #expect(state.shared.backgroundColor == Color(r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF))
    }

    @Test("swapColors exchanges foreground and background")
    func swapColorsExchangesForegroundAndBackground() {
        let state = Workspace(width: 16, height: 16)
        let fg = Color(r: 0xB0, g: 0x7A, b: 0x30, a: 0xFF)
        let bg = Color(r: 0x11, g: 0x22, b: 0x33, a: 0xFF)
        state.shared.foregroundColor = fg
        state.shared.backgroundColor = bg

        state.swapColors()

        #expect(state.shared.foregroundColor == bg)
        #expect(state.shared.backgroundColor == fg)
    }

    @Test("a secondary-button stroke paints the background color")
    func secondaryButtonStrokePaintsBackground() throws {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4), button: .secondary)
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 4))

        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == state.shared.backgroundColor)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 4) == state.shared.backgroundColor)
    }

    @Test("swapping colors mid-stroke doesn't change the stroke in flight")
    func midStrokeSwapIsIgnored() throws {
        let state = Workspace(width: 16, height: 16)
        let originalBackground = state.shared.backgroundColor

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0), button: .secondary)
        state.swapColors()
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))

        #expect(try state.activeTab.document.getPixel(x: 2, y: 0) == originalBackground)
    }

    @Test("a secondary-button eraser stroke still erases to transparent")
    func secondaryButtonEraserStillErases() throws {
        let state = Workspace(width: 16, height: 16)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        try state.activeTab.document.setPixel(x: 5, y: 5, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        state.shared.activeTool = .eraser

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5), button: .secondary)

        #expect(try state.activeTab.document.getPixel(x: 5, y: 5) == transparent)
    }
}

@Suite("TabState — stroke lifecycle")
struct TabStateStrokeTests {

    @Test("the first sample paints the foreground color; the undo entry commits at stroke end")
    func beginStrokePaintsAndCommitsUndoAtEnd() throws {
        let state = Workspace(width: 16, height: 16)
        let versionBefore = state.activeTab.canvasVersion

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))

        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == state.shared.foregroundColor)
        #expect(state.activeTab.canvasVersion == versionBefore + 1)
        #expect(state.activeTab.isDrawing)
        // The Edit Baseline is pending, not committed — undo is sealed
        // while drawing, so nothing is on the stack yet.
        #expect(!state.activeTab.canUndo)

        state.activeTab.endStroke()
        #expect(state.activeTab.canUndo)
    }

    @Test("a begin during an active stroke resolves the previous Edit Baseline first")
    func beginWhileDrawingResolvesPreviousBaseline() throws {
        let state = Workspace(width: 16, height: 16)

        // A second finger can begin a stroke while one is active (iPadOS).
        // The first stroke painted, so its baseline must commit — not leak
        // into or get overwritten by the second stroke's begin.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 5) == state.shared.foregroundColor)

        // Two committed strokes → two undo steps, each reverting one.
        state.activeTab.handleUndo()
        #expect(try state.activeTab.document.getPixel(x: 5, y: 5).a == 0)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == state.shared.foregroundColor)
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.composite().allSatisfy { $0 == 0 })
    }

    @Test("retracing pixels with their own color is a no-op stroke — no undo entry")
    func sameColorRetraceLeavesNoUndoEntry() throws {
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setPixel(x: 3, y: 4, color: state.shared.foregroundColor)
        try state.activeTab.document.setPixel(x: 4, y: 4, color: state.shared.foregroundColor)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 4))
        state.activeTab.endStroke()

        #expect(!state.activeTab.canUndo)
    }

    @Test("a fast drag paints the interpolated segment between samples")
    func continueStrokeInterpolatesGaps() throws {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))

        // Bresenham diagonal: the skipped pixels between the two samples are filled.
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 2) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 3, y: 3) == state.shared.foregroundColor)
    }

    @Test("one undo reverts the whole stroke")
    func oneUndoRevertsWholeStroke() {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 7, y: 2))
        state.activeTab.endStroke()
        state.activeTab.handleUndo()

        #expect(state.activeTab.document.composite().allSatisfy { $0 == 0 })
        #expect(!state.activeTab.isDrawing)
    }

    @Test("cancel tears the stroke down; freehand keeps its painted pixels")
    func cancelStrokeTearsDown() throws {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.activeTab.cancelStroke()

        #expect(!state.activeTab.isDrawing)
        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == state.shared.foregroundColor)
        // The interrupted stroke still stands as one undoable step.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.composite().allSatisfy { $0 == 0 })
    }

    @Test("a repeated sample on the same pixel does not trigger a re-render")
    func redundantSampleDoesNotRerender() {
        let state = Workspace(width: 16, height: 16)
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        let versionAfterBegin = state.activeTab.canvasVersion

        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 4))

        #expect(state.activeTab.canvasVersion == versionAfterBegin)
    }

    @Test("eraser strokes erase to transparent")
    func eraserErasesToTransparent() throws {
        let state = Workspace(width: 16, height: 16)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        try state.activeTab.document.setPixel(x: 5, y: 5, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        state.shared.activeTool = .eraser

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(try state.activeTab.document.getPixel(x: 5, y: 5) == transparent)
    }

    @Test("mid-stroke foreground color changes don't affect the stroke in flight")
    func midStrokeColorChangeIsIgnored() throws {
        let state = Workspace(width: 16, height: 16)
        let originalColor = state.shared.foregroundColor

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.shared.foregroundColor = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))

        #expect(try state.activeTab.document.getPixel(x: 2, y: 0) == originalColor)
    }

    @Test("mid-stroke tool changes don't affect the stroke in flight")
    func midStrokeToolChangeIsIgnored() throws {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.shared.activeTool = .eraser
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))

        // Still painting with the pencil resolved at begin, not erasing.
        #expect(try state.activeTab.document.getPixel(x: 2, y: 0) == state.shared.foregroundColor)
    }
}

@Suite("TabState — Hover Point")
struct TabStateHoverPointTests {

    @Test("a pencil hover over an in-bounds cell publishes that Hover Point")
    func hoverOverCanvasPublishesHoverPoint() {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.updateHoverPoint(to: ScreenCanvasCoords(x: 5, y: 7))

        #expect(state.activeTab.hoverPoint == ScreenCanvasCoords(x: 5, y: 7))
    }

    @Test("a hover outside the canvas bounds publishes no Hover Point")
    func hoverOffCanvasClearsHoverPoint() {
        let state = Workspace(width: 16, height: 16)

        // The last in-bounds cell (indices 0...15) still shows.
        state.activeTab.updateHoverPoint(to: ScreenCanvasCoords(x: 15, y: 15))
        #expect(state.activeTab.hoverPoint == ScreenCanvasCoords(x: 15, y: 15))

        // One step past each edge clears the (previously-set) Hover Point.
        for offCanvas in [
            ScreenCanvasCoords(x: 16, y: 8),
            ScreenCanvasCoords(x: -1, y: 8),
            ScreenCanvasCoords(x: 8, y: 16),
            ScreenCanvasCoords(x: 8, y: -1),
        ] {
            state.activeTab.updateHoverPoint(to: offCanvas)
            #expect(state.activeTab.hoverPoint == nil)
        }
    }

    @Test("hover exit clears the Hover Point")
    func hoverExitClearsHoverPoint() {
        let state = Workspace(width: 16, height: 16)
        state.activeTab.updateHoverPoint(to: ScreenCanvasCoords(x: 4, y: 4))

        state.activeTab.clearHoverPoint()

        #expect(state.activeTab.hoverPoint == nil)
    }

    @Test("the moment a stroke begins, the Hover Point clears")
    func strokeBeginClearsHoverPoint() {
        let state = Workspace(width: 16, height: 16)
        state.activeTab.updateHoverPoint(to: ScreenCanvasCoords(x: 6, y: 6))

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 6, y: 6))

        #expect(state.activeTab.hoverPoint == nil)
    }

    @Test("moving the hovering pencil re-targets the Hover Point live")
    func hoverMoveRetargetsHoverPoint() {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.updateHoverPoint(to: ScreenCanvasCoords(x: 2, y: 3))
        #expect(state.activeTab.hoverPoint == ScreenCanvasCoords(x: 2, y: 3))

        state.activeTab.updateHoverPoint(to: ScreenCanvasCoords(x: 9, y: 1))
        #expect(state.activeTab.hoverPoint == ScreenCanvasCoords(x: 9, y: 1))
    }

    @Test("resizing the canvas clears a now-out-of-bounds Hover Point")
    func resizeClearsOutOfBoundsHoverPoint() {
        let state = Workspace(width: 16, height: 16)
        // The last cell of the 16-wide canvas — off-canvas once it shrinks to 8.
        state.activeTab.updateHoverPoint(to: ScreenCanvasCoords(x: 15, y: 15))

        state.activeTab.resizeCanvas(width: 8, height: 16)

        #expect(state.activeTab.hoverPoint == nil)
    }
}

@Suite("TabState — resizeCanvas")
struct TabStateResizeCanvasTests {

    @Test("resize updates canvas dimensions")
    func resizeUpdatesDimensions() {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.resizeCanvas(width: 32, height: 24)

        #expect(state.activeTab.document.width() == 32)
        #expect(state.activeTab.document.height() == 24)
    }

    @Test("resize bumps canvasVersion to trigger re-render")
    func resizeBumpsCanvasVersion() {
        let state = Workspace(width: 16, height: 16)
        let before = state.activeTab.canvasVersion

        state.activeTab.resizeCanvas(width: 32, height: 32)

        #expect(state.activeTab.canvasVersion == before + 1)
    }

    @Test("resize to same dimensions is a no-op")
    func resizeSameDimensionsIsNoop() {
        let state = Workspace(width: 16, height: 16)
        let versionBefore = state.activeTab.canvasVersion

        state.activeTab.resizeCanvas(width: 16, height: 16)

        #expect(state.activeTab.canvasVersion == versionBefore)
    }

    @Test("resize silently rejects invalid dimensions (zero, above max)")
    func resizeRejectsInvalidDimensions() {
        let state = Workspace(width: 16, height: 16)
        let versionBefore = state.activeTab.canvasVersion

        state.activeTab.resizeCanvas(width: 0, height: 16)
        state.activeTab.resizeCanvas(width: 16, height: 0)
        state.activeTab.resizeCanvas(width: canvasMaxDimension() + 1, height: 16)
        state.activeTab.resizeCanvas(width: 16, height: canvasMaxDimension() + 1)

        #expect(state.activeTab.document.width() == 16)
        #expect(state.activeTab.document.height() == 16)
        #expect(state.activeTab.canvasVersion == versionBefore)
    }

    @Test("resize is a no-op while a drawing stroke is in progress")
    func resizeIsNoopWhileDrawing() {
        let state = Workspace(width: 16, height: 16)
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))

        state.activeTab.resizeCanvas(width: 32, height: 32)

        #expect(state.activeTab.document.width() == 16)
        #expect(state.activeTab.document.height() == 16)
        // The live stroke is undisturbed — its baseline still commits at end.
        state.activeTab.endStroke()
        #expect(state.activeTab.canUndo)
    }

    @Test("resize commits an undoable edit; undo and redo restore both pixels and dimensions")
    func resizeIsUndoableAndRedoable() throws {
        let state = Workspace(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        // A pixel the 8×8 shrink crops away — only a whole-document restore
        // can bring it back.
        try state.activeTab.document.setPixel(x: 10, y: 10, color: red)

        state.activeTab.resizeCanvas(width: 8, height: 8)
        #expect(state.activeTab.canUndo)

        state.activeTab.handleUndo()
        #expect(state.activeTab.document.width() == 16)
        #expect(state.activeTab.document.height() == 16)
        #expect(try state.activeTab.document.getPixel(x: 10, y: 10) == red)

        state.activeTab.handleRedo()
        #expect(state.activeTab.document.width() == 8)
        #expect(state.activeTab.document.height() == 8)
    }

    @Test("resize clips a partially cropped Marquee and undo restores it")
    func resizeClipsMarqueeAndUndoRestoresIt() throws {
        let state = Workspace(width: 16, height: 16)
        let marquee = AppleMarqueeRegion(x: 6, y: 6, width: 4, height: 4)
        try state.activeTab.document.setMarquee(region: marquee)

        state.activeTab.resizeCanvas(width: 8, height: 8)

        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 6, y: 6, width: 2, height: 2)
        )

        state.activeTab.handleUndo()
        #expect(state.activeTab.document.width() == 16)
        #expect(state.activeTab.document.height() == 16)
        #expect(state.activeTab.document.marquee() == marquee)

        state.activeTab.handleRedo()
        #expect(state.activeTab.document.width() == 8)
        #expect(state.activeTab.document.height() == 8)
        #expect(state.activeTab.document.marquee() == AppleMarqueeRegion(
            x: 6,
            y: 6,
            width: 2,
            height: 2
        ))
    }

    @Test("resize clears a Marquee fully outside the new canvas")
    func resizeClearsFullyCroppedMarquee() throws {
        let state = Workspace(width: 16, height: 16)
        let marquee = AppleMarqueeRegion(x: 10, y: 10, width: 2, height: 2)
        try state.activeTab.document.setMarquee(region: marquee)

        state.activeTab.resizeCanvas(width: 8, height: 8)

        #expect(state.activeTab.document.marquee() == nil)

        state.activeTab.handleUndo()
        #expect(state.activeTab.document.marquee() == marquee)

        state.activeTab.handleRedo()
        #expect(state.activeTab.document.marquee() == nil)
    }

    @Test("pre-resize edits stay undoable after a resize")
    func preResizeEditsSurviveResize() throws {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()
        state.activeTab.resizeCanvas(width: 8, height: 8)

        // Undo the resize, then the stroke — two separate edits.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.width() == 16)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 2) == state.shared.foregroundColor)
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.composite().allSatisfy { $0 == 0 })
    }

    @Test("a rejected resize (invalid dimensions) leaves no history entry")
    func rejectedResizeLeavesNoHistoryEntry() {
        let state = Workspace(width: 16, height: 16)

        state.activeTab.resizeCanvas(width: 0, height: 16)
        state.activeTab.resizeCanvas(width: canvasMaxDimension() + 1, height: 16)

        #expect(!state.activeTab.canUndo)
    }
}

@Suite("TabState — handleClearCanvas")
struct TabStateClearCanvasTests {

    @Test("clear erases all pixels to transparent")
    func clearErasesAllPixels() throws {
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setPixel(x: 3, y: 4, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))

        state.activeTab.handleClearCanvas()

        #expect(state.activeTab.document.composite().allSatisfy { $0 == 0 })
    }

    @Test("clear bumps canvasVersion to trigger re-render")
    func clearBumpsCanvasVersion() throws {
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setPixel(x: 3, y: 4, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        let before = state.activeTab.canvasVersion

        state.activeTab.handleClearCanvas()

        #expect(state.activeTab.canvasVersion == before + 1)
    }

    @Test("clear on an already-blank canvas records no history entry and skips the re-render")
    func clearOnBlankCanvasRecordsNothing() {
        let state = Workspace(width: 16, height: 16)
        let before = state.activeTab.canvasVersion

        state.activeTab.handleClearCanvas()

        #expect(!state.activeTab.canUndo)
        #expect(state.activeTab.canvasVersion == before)
    }

    @Test("clear on an already-blank canvas preserves the redo future")
    func clearOnBlankCanvasPreservesRedo() {
        let state = Workspace(width: 16, height: 16)
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        state.activeTab.endStroke()
        state.activeTab.handleUndo()
        #expect(state.activeTab.canRedo)

        state.activeTab.handleClearCanvas()

        #expect(state.activeTab.canRedo)
    }

    @Test("undo after clear restores the pre-clear pixels")
    func undoAfterClearRestoresPixels() throws {
        let state = Workspace(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.activeTab.document.setPixel(x: 3, y: 4, color: red)

        state.activeTab.handleClearCanvas()
        state.activeTab.handleUndo()

        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == red)
    }

    @Test("redo after undo re-applies the clear")
    func redoReappliesClear() throws {
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setPixel(x: 3, y: 4, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        state.activeTab.handleClearCanvas()
        state.activeTab.handleUndo()

        state.activeTab.handleRedo()

        #expect(state.activeTab.document.composite().allSatisfy { $0 == 0 })
    }

    @Test("clear is a no-op while a drawing stroke is in progress")
    func clearIsNoopWhileDrawing() throws {
        let state = Workspace(width: 16, height: 16)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.activeTab.document.setPixel(x: 3, y: 4, color: red)
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        let canvasVersionBefore = state.activeTab.canvasVersion
        let historyVersionBefore = state.activeTab.historyVersion

        state.activeTab.handleClearCanvas()

        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == red)
        #expect(state.activeTab.canvasVersion == canvasVersionBefore)
        #expect(state.activeTab.historyVersion == historyVersionBefore)
    }
}

/// The Timeline panel's collapse state (issue 261) — the chevron's command.
@Suite("TabState — Timeline panel collapse")
struct TabStateTimelinePanelTests {

    @Test("the panel starts expanded and the chevron toggles it back and forth")
    func panelStartsExpandedAndTogglesBothWays() {
        let state = Workspace(width: 16, height: 16)
        #expect(!state.activeTab.isTimelinePanelCollapsed)

        state.activeTab.toggleTimelinePanel()
        #expect(state.activeTab.isTimelinePanelCollapsed)

        state.activeTab.toggleTimelinePanel()
        #expect(!state.activeTab.isTimelinePanelCollapsed)
    }

    @Test("collapsing is a view-only mutation: no history entry, no re-render signal")
    func collapsingRecordsNoHistoryEntry() {
        let state = Workspace(width: 16, height: 16)
        let canvasVersionBefore = state.activeTab.canvasVersion

        state.activeTab.toggleTimelinePanel()

        // Web parity: the chevron is persisted UI, never a History entry —
        // and it touches no pixels, so the Metal re-render stays untriggered.
        #expect(!state.activeTab.canUndo)
        #expect(state.activeTab.canvasVersion == canvasVersionBefore)
    }
}
