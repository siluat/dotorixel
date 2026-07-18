import Testing
@testable import Dotorixel

/// Shift-constrain behavior for shape strokes, exercised through the
/// `EditorState` public stroke API: the physical Shift key and the Constrain
/// latch are OR-combined at the single seam sessions read, so either source
/// snaps lines to 45° and forces rectangles/ellipses square.
@Suite("Shape strokes — Shift constrain + latch")
struct ConstrainStrokeTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)

    @Test("with the Constrain latch on, a shallow line drag commits snapped to the horizontal")
    func latchSnapsLineToHorizontal() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .line
        state.isConstrainLatchOn = true

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: 10, y: 3))
        state.endStroke()

        let snapped = Set(appleInterpolatePixels(x0: 0, y0: 0, x1: 10, y1: 0))
        for pixel in snapped {
            #expect(try state.pixelCanvas.getPixel(x: UInt32(pixel.x), y: UInt32(pixel.y)) == state.foregroundColor)
        }
        #expect(paintedPixelCount(state) == snapped.count)
    }

    @Test("with the physical Shift held, a rectangular drag commits forced square")
    func shiftForcesRectangleSquare() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .rectangle
        state.isShiftKeyHeld = true

        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.continueStroke(to: ScreenCanvasCoords(x: 8, y: 5))
        state.endStroke()

        // The longer axis (dx = 6) wins: the box is 2,2 → 8,8.
        let square = Set(appleRectangleOutline(x0: 2, y0: 2, x1: 8, y1: 8))
        for pixel in square {
            #expect(try state.pixelCanvas.getPixel(x: UInt32(pixel.x), y: UInt32(pixel.y)) == state.foregroundColor)
        }
        #expect(paintedPixelCount(state) == square.count)
    }

    @Test("toggling the latch mid-stroke re-renders the stationary preview immediately, both ways")
    func midStrokeLatchToggleRefreshesPreview() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .line

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: 10, y: 3))
        let versionBefore = state.canvasVersion

        // Latch on with the pointer stationary: the preview must snap now,
        // not on the next pointer move.
        state.isConstrainLatchOn = true

        #expect(state.canvasVersion > versionBefore)
        #expect(try state.pixelCanvas.getPixel(x: 10, y: 0) == state.foregroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 10, y: 3) == transparent)

        // Latch off again: the preview relaxes back to the raw pointer.
        state.isConstrainLatchOn = false

        #expect(try state.pixelCanvas.getPixel(x: 10, y: 3) == state.foregroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 10, y: 0) == transparent)
    }

    @Test("releasing Shift mid-drag relaxes the preview immediately, re-pressing re-constrains")
    func midStrokeShiftReleaseRelaxesPreview() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .line
        state.isShiftKeyHeld = true

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: 10, y: 3))
        #expect(try state.pixelCanvas.getPixel(x: 10, y: 0) == state.foregroundColor)

        state.isShiftKeyHeld = false
        #expect(try state.pixelCanvas.getPixel(x: 10, y: 3) == state.foregroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 10, y: 0) == transparent)

        state.isShiftKeyHeld = true
        #expect(try state.pixelCanvas.getPixel(x: 10, y: 0) == state.foregroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 10, y: 3) == transparent)
    }

    @Test("a freehand pencil stroke ignores the constrain state entirely")
    func pencilIgnoresConstrainState() throws {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .pencil
        state.pixelPerfect = false
        state.isConstrainLatchOn = true
        state.isShiftKeyHeld = true

        state.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.continueStroke(to: ScreenCanvasCoords(x: 5, y: 3))
        state.endStroke()

        // The raw diagonal-ish path is painted — no 45° snap ever applies.
        #expect(try state.pixelCanvas.getPixel(x: 5, y: 3) == state.foregroundColor)
        let raw = Set(appleInterpolatePixels(x0: 0, y0: 0, x1: 5, y1: 3))
        #expect(paintedPixelCount(state) == raw.count)
    }

    /// Number of canvas pixels with a non-zero alpha channel.
    private func paintedPixelCount(_ state: EditorState) -> Int {
        let pixels = state.pixelCanvas.pixels()
        return stride(from: 3, to: pixels.count, by: 4).count { pixels[$0] != 0 }
    }
}

/// The toolbar's tool-activation gesture (web parity: `activateTool` in
/// `tool-ui.ts`): re-activating the already-active constrainable tool toggles
/// the Constrain latch; anything else selects the tool.
@Suite("Tool activation — Constrain latch gesture")
struct ToolActivationTests {

    @Test("re-activating the active constrainable tool toggles the latch instead of re-selecting")
    func reactivatingConstrainableToolTogglesLatch() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .line

        state.activateTool(.line)
        #expect(state.isConstrainLatchOn)
        #expect(state.activeTool == .line)

        state.activateTool(.line)
        #expect(!state.isConstrainLatchOn)
    }

    @Test("activating an inactive tool switches tools without touching the latch")
    func activatingInactiveToolSwitchesWithoutTogglingLatch() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .line
        state.isConstrainLatchOn = true

        state.activateTool(.rectangle)

        #expect(state.activeTool == .rectangle)
        #expect(state.isConstrainLatchOn)
    }

    @Test("re-activating the active non-constrainable tool never toggles the latch")
    func reactivatingNonConstrainableToolLeavesLatchAlone() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .pencil

        state.activateTool(.pencil)

        #expect(!state.isConstrainLatchOn)
        #expect(state.activeTool == .pencil)
    }
}
