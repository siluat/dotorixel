import Testing
@testable import Dotorixel

/// Shift-constrain behavior for shape strokes, exercised through the
/// `TabState` public stroke API: the physical Shift key and the Constrain
/// latch are OR-combined at the single seam sessions read, so either source
/// snaps lines to 45° and forces rectangles/ellipses square.
@Suite("Shape strokes — Shift constrain + latch")
struct ConstrainStrokeTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)

    @Test("with the Constrain latch on, a shallow line drag commits snapped to the horizontal")
    func latchSnapsLineToHorizontal() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .line
        state.isConstrainLatchOn = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 10, y: 3))
        state.activeTab.endStroke()

        let snapped = Set(appleInterpolatePixels(x0: 0, y0: 0, x1: 10, y1: 0))
        for pixel in snapped {
            #expect(try state.activeTab.document.getPixel(x: UInt32(pixel.x), y: UInt32(pixel.y)) == state.shared.foregroundColor)
        }
        #expect(paintedPixelCount(state.activeTab) == snapped.count)
    }

    @Test("with the physical Shift held, a rectangular drag commits forced square")
    func shiftForcesRectangleSquare() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .rectangle
        state.isShiftKeyHeld = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 8, y: 5))
        state.activeTab.endStroke()

        // The longer axis (dx = 6) wins: the box is 2,2 → 8,8.
        let square = Set(appleRectangleOutline(x0: 2, y0: 2, x1: 8, y1: 8))
        for pixel in square {
            #expect(try state.activeTab.document.getPixel(x: UInt32(pixel.x), y: UInt32(pixel.y)) == state.shared.foregroundColor)
        }
        #expect(paintedPixelCount(state.activeTab) == square.count)
    }

    @Test("toggling the latch mid-stroke re-renders the stationary preview immediately, both ways")
    func midStrokeLatchToggleRefreshesPreview() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .line

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 10, y: 3))
        let versionBefore = state.activeTab.canvasVersion

        // Latch on with the pointer stationary: the preview must snap now,
        // not on the next pointer move.
        state.isConstrainLatchOn = true

        #expect(state.activeTab.canvasVersion > versionBefore)
        #expect(try state.activeTab.document.getPixel(x: 10, y: 0) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 10, y: 3) == transparent)

        // Latch off again: the preview relaxes back to the raw pointer.
        state.isConstrainLatchOn = false

        #expect(try state.activeTab.document.getPixel(x: 10, y: 3) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 10, y: 0) == transparent)
    }

    @Test("releasing Shift mid-drag relaxes the preview immediately, re-pressing re-constrains")
    func midStrokeShiftReleaseRelaxesPreview() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .line
        state.isShiftKeyHeld = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 10, y: 3))
        #expect(try state.activeTab.document.getPixel(x: 10, y: 0) == state.shared.foregroundColor)

        state.isShiftKeyHeld = false
        #expect(try state.activeTab.document.getPixel(x: 10, y: 3) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 10, y: 0) == transparent)

        state.isShiftKeyHeld = true
        #expect(try state.activeTab.document.getPixel(x: 10, y: 0) == state.shared.foregroundColor)
        #expect(try state.activeTab.document.getPixel(x: 10, y: 3) == transparent)
    }

    @Test("a freehand pencil stroke ignores the constrain state entirely")
    func pencilIgnoresConstrainState() throws {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .pencil
        state.shared.pixelPerfect = false
        state.isConstrainLatchOn = true
        state.isShiftKeyHeld = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 3))
        state.activeTab.endStroke()

        // The raw diagonal-ish path is painted — no 45° snap ever applies.
        #expect(try state.activeTab.document.getPixel(x: 5, y: 3) == state.shared.foregroundColor)
        let raw = Set(appleInterpolatePixels(x0: 0, y0: 0, x1: 5, y1: 3))
        #expect(paintedPixelCount(state.activeTab) == raw.count)
    }

}

/// Shift-constrain behavior for the Selection tool's define drag (issue 270,
/// web parity: Selection joins the constrainable set): the same OR-combined
/// Shift/latch seam the shape tools read forces the defined Marquee square.
@Suite("Selection define — Shift constrain + latch")
struct ConstrainSelectionDefineTests {

    @Test("with the physical Shift held, a rectangular drag defines a square Marquee")
    func shiftForcesSquareMarquee() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .selection
        state.isShiftKeyHeld = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 8, y: 5))
        state.activeTab.endStroke()

        // The longer axis (dx = 6) wins: the box is 2,2 → 8,8.
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 7, height: 7)
        )
    }

    @Test("toggling Shift mid-drag re-resolves the in-flight rectangle immediately, both ways")
    func midDragShiftToggleReresolvesPreview() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .selection

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 8, y: 5))
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 7, height: 4)
        )

        // Shift pressed with the pointer stationary: the preview must square
        // now, not on the next pointer move.
        state.isShiftKeyHeld = true
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 7, height: 7)
        )

        // Shift released again: the preview relaxes back to the raw pointer.
        state.isShiftKeyHeld = false
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 7, height: 4)
        )
    }

    @Test("a constrained drag over the canvas edge bounds the side — the clip never cuts the square")
    func edgeBoundedDefineStaysSquare() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .selection
        state.isShiftKeyHeld = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 10, y: 2))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 15, y: 9))
        state.activeTab.endStroke()

        // Raw side would be 7 (dy), but only 5 columns remain rightward of
        // the anchor: the side bounds to 5 (web parity), not clipped to 6×8.
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 10, y: 2, width: 6, height: 6)
        )
    }

    @Test("an up-left constrained drag bounds against the top/left edges — the negative-direction paths")
    func negativeDirectionDefineBoundsAgainstNearEdges() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .selection
        state.isShiftKeyHeld = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 14, y: 10))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()

        // Raw side would be 12 (|dx|), but only 10 rows remain above the
        // anchor: the side bounds to 10 and the square grows up-left.
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 4, y: 0, width: 11, height: 11)
        )
    }

    @Test("a constrained drag entirely outside the canvas defines nothing — the square never grows into it")
    func fullyOffCanvasConstrainedDragDefinesNothing() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .selection
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 4))
        state.activeTab.endStroke()

        // The raw drag never touches the canvas; squaring the long dy side
        // must not extend it leftward into the canvas (web parity: the raw
        // intersection is checked before constraining).
        state.isShiftKeyHeld = true
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 20, y: 2))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 19, y: 15))
        state.activeTab.endStroke()

        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 3, height: 3)
        )
    }

    @Test("a constrained drag anchored outside the canvas clamps the anchor before squaring")
    func offCanvasAnchorClampsBeforeSquaring() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .selection
        state.isShiftKeyHeld = true

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: -3, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 9))
        state.activeTab.endStroke()

        // The anchor clamps to (0, 4) first, so the square resolves from
        // in-canvas geometry (web parity), not from the raw dx = 8.
        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 0, y: 4, width: 6, height: 6)
        )
    }

    @Test("re-tapping the active Selection tool latches, and the latch alone forces the define square")
    func latchAloneForcesSquareKeyboardFree() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .selection

        // Selection joins the constrainable set: the re-tap gesture latches
        // the square constraint keyboard-free (web parity).
        state.activateTool(.selection)
        #expect(state.isConstrainLatchOn)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 8, y: 5))
        state.activeTab.endStroke()

        #expect(
            state.activeTab.document.marquee()
                == AppleMarqueeRegion(x: 2, y: 2, width: 7, height: 7)
        )

        state.activateTool(.selection)
        #expect(!state.isConstrainLatchOn)
    }
}

/// The toolbar's tool-activation gesture (web parity: `activateTool` in
/// `tool-ui.ts`): re-activating the already-active constrainable tool toggles
/// the Constrain latch; anything else selects the tool.
@Suite("Tool activation — Constrain latch gesture")
struct ToolActivationTests {

    @Test("re-activating the active constrainable tool toggles the latch instead of re-selecting")
    func reactivatingConstrainableToolTogglesLatch() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .line

        state.activateTool(.line)
        #expect(state.isConstrainLatchOn)
        #expect(state.shared.activeTool == .line)

        state.activateTool(.line)
        #expect(!state.isConstrainLatchOn)
    }

    @Test("activating an inactive tool switches tools without touching the latch")
    func activatingInactiveToolSwitchesWithoutTogglingLatch() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .line
        state.isConstrainLatchOn = true

        state.activateTool(.rectangle)

        #expect(state.shared.activeTool == .rectangle)
        #expect(state.isConstrainLatchOn)
    }

    @Test("re-activating the active non-constrainable tool never toggles the latch")
    func reactivatingNonConstrainableToolLeavesLatchAlone() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .pencil

        state.activateTool(.pencil)

        #expect(!state.isConstrainLatchOn)
        #expect(state.shared.activeTool == .pencil)
    }
}
