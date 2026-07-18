import Foundation
import Testing
@testable import Dotorixel

/// The pixel-shift primitive behind the move tool, tested against the web
/// shell's `shiftPixels` semantics: pixels shifted past the canvas edge are
/// clipped, vacated areas become transparent.
@Suite("Pixel shift — web parity semantics")
struct PixelShiftTests {

    @Test("a diagonal shift moves a pixel and vacates its origin")
    func diagonalShiftMovesPixel() {
        var source = Data(count: 4 * 4 * 4)
        writePixel(&source, width: 4, x: 1, y: 1, rgba: (0xFF, 0x00, 0x00, 0xFF))

        let shifted = shiftedPixels(source, width: 4, height: 4, dx: 1, dy: 1)

        #expect(readPixel(shifted, width: 4, x: 2, y: 2) == (0xFF, 0x00, 0x00, 0xFF))
        #expect(readPixel(shifted, width: 4, x: 1, y: 1) == (0, 0, 0, 0))
    }

    @Test("a zero shift returns the source unchanged")
    func zeroShiftIsIdentity() {
        var source = Data(count: 4 * 4 * 4)
        writePixel(&source, width: 4, x: 0, y: 0, rgba: (0x11, 0x22, 0x33, 0xFF))
        writePixel(&source, width: 4, x: 3, y: 3, rgba: (0x44, 0x55, 0x66, 0xFF))

        let shifted = shiftedPixels(source, width: 4, height: 4, dx: 0, dy: 0)

        #expect(shifted == source)
    }

    @Test(
        "pixels shifted past each edge are clipped",
        arguments: [(dx: 1, dy: 0), (dx: -1, dy: 0), (dx: 0, dy: 1), (dx: 0, dy: -1)]
    )
    func edgePixelsAreClipped(delta: (dx: Int, dy: Int)) {
        // Every pixel opaque: a 1-step shift must clip exactly one edge
        // row/column and vacate the opposite one.
        var source = Data(count: 3 * 3 * 4)
        for y in 0..<3 {
            for x in 0..<3 {
                writePixel(&source, width: 3, x: x, y: y, rgba: (0xAA, 0xBB, 0xCC, 0xFF))
            }
        }

        let shifted = shiftedPixels(source, width: 3, height: 3, dx: delta.dx, dy: delta.dy)

        for y in 0..<3 {
            for x in 0..<3 {
                let vacated = (delta.dx == 1 && x == 0) || (delta.dx == -1 && x == 2)
                    || (delta.dy == 1 && y == 0) || (delta.dy == -1 && y == 2)
                let expected: (UInt8, UInt8, UInt8, UInt8) = vacated ? (0, 0, 0, 0) : (0xAA, 0xBB, 0xCC, 0xFF)
                #expect(readPixel(shifted, width: 3, x: x, y: y) == expected)
            }
        }
    }

    @Test(
        "a shift of at least the full canvas leaves everything transparent",
        arguments: [(dx: 4, dy: 0), (dx: -4, dy: 0), (dx: 0, dy: 4), (dx: 0, dy: -4), (dx: 4, dy: 4)]
    )
    func fullCanvasShiftClearsEverything(delta: (dx: Int, dy: Int)) {
        var source = Data(count: 4 * 4 * 4)
        for y in 0..<4 {
            for x in 0..<4 {
                writePixel(&source, width: 4, x: x, y: y, rgba: (0xAA, 0xBB, 0xCC, 0xFF))
            }
        }

        let shifted = shiftedPixels(source, width: 4, height: 4, dx: delta.dx, dy: delta.dy)

        #expect(shifted == Data(count: 4 * 4 * 4))
    }

    private func writePixel(_ data: inout Data, width: Int, x: Int, y: Int, rgba: (UInt8, UInt8, UInt8, UInt8)) {
        let offset = (y * width + x) * 4
        data[offset] = rgba.0
        data[offset + 1] = rgba.1
        data[offset + 2] = rgba.2
        data[offset + 3] = rgba.3
    }

    private func readPixel(_ data: Data, width: Int, x: Int, y: Int) -> (UInt8, UInt8, UInt8, UInt8) {
        let offset = (y * width + x) * 4
        return (data[offset], data[offset + 1], data[offset + 2], data[offset + 3])
    }
}

/// Move tool session behavior, exercised through the `EditorState` public
/// stroke API: dragging shifts the whole canvas by the delta from the drag
/// anchor, release commits, cancel restores the pre-stroke pixels.
@Suite("Move strokes — shift, commit, cancel")
struct MoveStrokeSessionTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)
    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("a drag translates the whole drawing and release commits it")
    func dragTranslatesAndCommits() throws {
        let state = EditorState(width: 8, height: 8)
        try state.pixelCanvas.setPixel(x: 2, y: 2, color: red)
        state.activeTool = .move

        state.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.continueStroke(to: ScreenCanvasCoords(x: 7, y: 6))
        state.endStroke()

        #expect(try state.pixelCanvas.getPixel(x: 5, y: 4) == red)
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 2) == transparent)
    }

    @Test("reversing a drag back to the anchor restores the original positions")
    func reversedDragRestoresOriginalPositions() throws {
        let state = EditorState(width: 8, height: 8)
        try state.pixelCanvas.setPixel(x: 2, y: 2, color: red)
        state.activeTool = .move

        state.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.continueStroke(to: ScreenCanvasCoords(x: 6, y: 5))
        // Back to the anchor: relative-to-anchor, so the shift must be zero —
        // not a cumulative drift from the wander.
        state.continueStroke(to: ScreenCanvasCoords(x: 4, y: 4))
        state.endStroke()

        #expect(try state.pixelCanvas.getPixel(x: 2, y: 2) == red)
        #expect(paintedPixelCount(state) == 1)
    }

    @Test("pixels dragged off-canvas are clipped and vacated areas stay transparent")
    func offCanvasPixelsAreClippedOnCommit() throws {
        let state = EditorState(width: 8, height: 8)
        try state.pixelCanvas.setPixel(x: 6, y: 6, color: red)
        try state.pixelCanvas.setPixel(x: 1, y: 1, color: red)
        state.activeTool = .move

        // +3,+3: (6,6) lands past the edge and is clipped; (1,1) → (4,4).
        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))
        state.endStroke()

        #expect(try state.pixelCanvas.getPixel(x: 4, y: 4) == red)
        #expect(paintedPixelCount(state) == 1)

        // The clip is destructive: dragging back does not resurrect (6,6).
        state.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        state.continueStroke(to: ScreenCanvasCoords(x: 2, y: 2))
        state.endStroke()

        #expect(try state.pixelCanvas.getPixel(x: 1, y: 1) == red)
        #expect(paintedPixelCount(state) == 1)
    }

    @Test("one undo restores the pre-move canvas; redo re-applies the move")
    func undoRestoresAndRedoReapplies() throws {
        let state = EditorState(width: 8, height: 8)
        try state.pixelCanvas.setPixel(x: 2, y: 2, color: red)
        state.activeTool = .move

        state.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.continueStroke(to: ScreenCanvasCoords(x: 6, y: 5))
        state.endStroke()

        state.handleUndo()
        #expect(try state.pixelCanvas.getPixel(x: 2, y: 2) == red)
        #expect(paintedPixelCount(state) == 1)

        state.handleRedo()
        #expect(try state.pixelCanvas.getPixel(x: 4, y: 3) == red)
        #expect(paintedPixelCount(state) == 1)
    }

    @Test("cancel restores the pre-stroke pixels and leaves no undo entry")
    func cancelRestoresPreStrokePixels() throws {
        let state = EditorState(width: 8, height: 8)
        try state.pixelCanvas.setPixel(x: 2, y: 2, color: red)
        state.activeTool = .move

        state.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.continueStroke(to: ScreenCanvasCoords(x: 6, y: 5))
        state.cancelStroke()

        #expect(try state.pixelCanvas.getPixel(x: 2, y: 2) == red)
        #expect(paintedPixelCount(state) == 1)
        // The cancel restored the baseline, so the stroke resolved as a no-op
        // — no History entry to undo.
        #expect(!state.canUndo)
    }

    /// Number of canvas pixels with a non-zero alpha channel.
    private func paintedPixelCount(_ state: EditorState) -> Int {
        let pixels = state.pixelCanvas.pixels()
        return stride(from: 3, to: pixels.count, by: 4).count { pixels[$0] != 0 }
    }
}
