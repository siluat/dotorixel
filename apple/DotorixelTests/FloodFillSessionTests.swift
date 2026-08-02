import Testing
@testable import Dotorixel

/// Flood fill tool behavior, exercised through the `TabState` public
/// stroke API: one-shot region fill on tap, undo/redo, FG/BG resolution.
@Suite("Flood fill strokes — one-shot region fill")
struct FloodFillSessionTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)
    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("a tap fills the 4-connected same-color region under it, stopping at other colors")
    func tapFillsEnclosedRegion() throws {
        let state = Workspace(width: 8, height: 8)
        // A red vertical wall at x=3 splits the canvas into two transparent regions.
        for y in 0..<8 {
            try state.activeTab.document.setPixel(x: 3, y: UInt32(y), color: red)
        }
        state.shared.activeTool = .floodFill

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 4))
        state.activeTab.endStroke()

        let fg = state.shared.foregroundColor
        // The tapped left region is filled edge to edge…
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == fg)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 7) == fg)
        // …the wall keeps its color and the right region stays untouched.
        #expect(try state.activeTab.document.getPixel(x: 3, y: 4) == red)
        #expect(try state.activeTab.document.getPixel(x: 4, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 7, y: 7) == transparent)
    }

    @Test("dragging after the tap fills nothing further (one-shot)")
    func dragAfterTapFillsNothingFurther() throws {
        let state = Workspace(width: 8, height: 8)
        // A red vertical wall at x=3: the drag crosses from the tapped left
        // region into the right one, which must stay untouched.
        for y in 0..<8 {
            try state.activeTab.document.setPixel(x: 3, y: UInt32(y), color: red)
        }
        state.shared.activeTool = .floodFill

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 6, y: 6))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 5, y: 4) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 6, y: 6) == transparent)
    }

    @Test("an out-of-canvas tap fills nothing and does not trigger a re-render")
    func outOfCanvasTapDoesNothing() {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .floodFill
        let versionBefore = state.activeTab.canvasVersion

        // Both sides of the bounds: negative and beyond-dimension coordinates.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: -2, y: -2))
        state.activeTab.endStroke()
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 100, y: 100))
        state.activeTab.endStroke()

        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(state.activeTab.canvasVersion == versionBefore)
        // A no-op stroke leaves no History entry: the Edit Baseline is
        // discarded at stroke end when nothing changed (web parity, 243).
        // Pinned so a fill-only divergence can't slip in silently.
        #expect(!state.activeTab.canUndo)
    }

    @Test("filling a region with its own color is a visual no-op that doesn't corrupt state")
    func sameColorFillIsNoOp() throws {
        let state = Workspace(width: 8, height: 8)
        // Foreground-colored art: tapping it refills with the same color.
        let fg = state.shared.foregroundColor
        try state.activeTab.document.setPixel(x: 2, y: 2, color: fg)
        try state.activeTab.document.setPixel(x: 2, y: 3, color: fg)
        state.shared.activeTool = .floodFill
        let pixelsBefore = state.activeTab.document.composite()
        let versionBefore = state.activeTab.canvasVersion

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()

        #expect(state.activeTab.document.composite() == pixelsBefore)
        #expect(state.activeTab.canvasVersion == versionBefore)
        // Web parity (243): a same-color fill is a no-op stroke — its Stroke
        // Baseline is discarded and no undo entry appears.
        #expect(!state.activeTab.canUndo)
    }

    @Test("a no-op fill preserves the redo future")
    func noopFillPreservesRedoFuture() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .floodFill

        // A real fill, undone: the redo future now holds it.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()
        state.activeTab.handleUndo()
        #expect(state.activeTab.canRedo)

        // An out-of-canvas tap must not destroy that future (243: the eager
        // push used to clear the redo stack on every stroke start).
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 100, y: 100))
        state.activeTab.endStroke()

        #expect(state.activeTab.canRedo)
        state.activeTab.handleRedo()
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == state.shared.foregroundColor)
    }

    @Test("one undo reverts the entire fill; redo re-applies it")
    func oneUndoRevertsWholeFill() throws {
        let state = Workspace(width: 8, height: 8)
        // Pre-existing art the fill floods around (different color = region boundary).
        try state.activeTab.document.setPixel(x: 5, y: 5, color: red)
        state.shared.activeTool = .floodFill

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()
        let fg = state.shared.foregroundColor
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == fg)

        state.activeTab.handleUndo()
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 5) == red)
        #expect(paintedPixelCount(state.activeTab) == 1)

        state.activeTab.handleRedo()
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == fg)
        #expect(try state.activeTab.document.getPixel(x: 7, y: 7) == fg)
        #expect(try state.activeTab.document.getPixel(x: 5, y: 5) == red)
    }

    @Test("a secondary-button tap fills with the background color")
    func secondaryButtonFillsBackground() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .floodFill

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4), button: .secondary)
        state.activeTab.endStroke()

        // The stroke's draw color was resolved to background at begin (233 seam).
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == state.shared.backgroundColor)
        #expect(try state.activeTab.document.getPixel(x: 7, y: 7) == state.shared.backgroundColor)
    }

    /// Number of canvas pixels with a non-zero alpha channel.
}
