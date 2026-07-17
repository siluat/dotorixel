import Testing
@testable import Dotorixel

/// Flood fill tool behavior, exercised through the `EditorState` public
/// stroke API: one-shot region fill on tap, undo/redo, FG/BG resolution.
@Suite("Flood fill strokes — one-shot region fill")
struct FloodFillSessionTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)
    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("a tap fills the 4-connected same-color region under it, stopping at other colors")
    func tapFillsEnclosedRegion() throws {
        let state = EditorState(width: 8, height: 8)
        // A red vertical wall at x=3 splits the canvas into two transparent regions.
        for y in 0..<8 {
            try state.pixelCanvas.setPixel(x: 3, y: UInt32(y), color: red)
        }
        state.activeTool = .floodFill

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 4))
        state.endStroke()

        let fg = state.foregroundColor
        // The tapped left region is filled edge to edge…
        #expect(try state.pixelCanvas.getPixel(x: 0, y: 0) == fg)
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 7) == fg)
        // …the wall keeps its color and the right region stays untouched.
        #expect(try state.pixelCanvas.getPixel(x: 3, y: 4) == red)
        #expect(try state.pixelCanvas.getPixel(x: 4, y: 4) == transparent)
        #expect(try state.pixelCanvas.getPixel(x: 7, y: 7) == transparent)
    }

    @Test("dragging after the tap fills nothing further (one-shot)")
    func dragAfterTapFillsNothingFurther() throws {
        let state = EditorState(width: 8, height: 8)
        // A red vertical wall at x=3: the drag crosses from the tapped left
        // region into the right one, which must stay untouched.
        for y in 0..<8 {
            try state.pixelCanvas.setPixel(x: 3, y: UInt32(y), color: red)
        }
        state.activeTool = .floodFill

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 4))
        state.continueStroke(to: ScreenCanvasCoords(x: 5, y: 4))
        state.continueStroke(to: ScreenCanvasCoords(x: 6, y: 6))
        state.endStroke()

        #expect(try state.pixelCanvas.getPixel(x: 5, y: 4) == transparent)
        #expect(try state.pixelCanvas.getPixel(x: 6, y: 6) == transparent)
    }

    @Test("an out-of-canvas tap fills nothing and does not trigger a re-render")
    func outOfCanvasTapDoesNothing() {
        let state = EditorState(width: 8, height: 8)
        state.activeTool = .floodFill
        let versionBefore = state.canvasVersion

        // Both sides of the bounds: negative and beyond-dimension coordinates.
        state.beginStroke(at: ScreenCanvasCoords(x: -2, y: -2))
        state.endStroke()
        state.beginStroke(at: ScreenCanvasCoords(x: 100, y: 100))
        state.endStroke()

        #expect(paintedPixelCount(state) == 0)
        #expect(state.canvasVersion == versionBefore)
        // The snapshots are still pushed at stroke start (web parity: the web
        // one-shot session captures history unconditionally before firing).
        // Pinned so a fill-only divergence can't slip in silently.
        #expect(state.canUndo)
    }

    @Test("filling a region with its own color is a visual no-op that doesn't corrupt state")
    func sameColorFillIsNoOp() throws {
        let state = EditorState(width: 8, height: 8)
        // Foreground-colored art: tapping it refills with the same color.
        let fg = state.foregroundColor
        try state.pixelCanvas.setPixel(x: 2, y: 2, color: fg)
        try state.pixelCanvas.setPixel(x: 2, y: 3, color: fg)
        state.activeTool = .floodFill
        let pixelsBefore = state.pixelCanvas.pixels()
        let versionBefore = state.canvasVersion

        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.endStroke()

        #expect(state.pixelCanvas.pixels() == pixelsBefore)
        #expect(state.canvasVersion == versionBefore)
        // Web parity: the snapshot is pushed at stroke start even for a
        // same-color no-op fill (see outOfCanvasTapDoesNothing).
        #expect(state.canUndo)
    }

    @Test("one undo reverts the entire fill; redo re-applies it")
    func oneUndoRevertsWholeFill() throws {
        let state = EditorState(width: 8, height: 8)
        // Pre-existing art the fill floods around (different color = region boundary).
        try state.pixelCanvas.setPixel(x: 5, y: 5, color: red)
        state.activeTool = .floodFill

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.endStroke()
        let fg = state.foregroundColor
        #expect(try state.pixelCanvas.getPixel(x: 0, y: 0) == fg)

        state.handleUndo()
        #expect(try state.pixelCanvas.getPixel(x: 0, y: 0) == transparent)
        #expect(try state.pixelCanvas.getPixel(x: 5, y: 5) == red)
        #expect(paintedPixelCount(state) == 1)

        state.handleRedo()
        #expect(try state.pixelCanvas.getPixel(x: 0, y: 0) == fg)
        #expect(try state.pixelCanvas.getPixel(x: 7, y: 7) == fg)
        #expect(try state.pixelCanvas.getPixel(x: 5, y: 5) == red)
    }

    @Test("a secondary-button tap fills with the background color")
    func secondaryButtonFillsBackground() throws {
        let state = EditorState(width: 8, height: 8)
        state.activeTool = .floodFill

        state.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4), button: .secondary)
        state.endStroke()

        // The stroke's draw color was resolved to background at begin (233 seam).
        #expect(try state.pixelCanvas.getPixel(x: 0, y: 0) == state.backgroundColor)
        #expect(try state.pixelCanvas.getPixel(x: 7, y: 7) == state.backgroundColor)
    }

    /// Number of canvas pixels with a non-zero alpha channel.
    private func paintedPixelCount(_ state: EditorState) -> Int {
        let pixels = state.pixelCanvas.pixels()
        return stride(from: 3, to: pixels.count, by: 4).count { pixels[$0] != 0 }
    }
}
