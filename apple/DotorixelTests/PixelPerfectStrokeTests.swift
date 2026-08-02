import Testing
@testable import Dotorixel

/// Pixel-perfect freehand filtering, exercised through the `TabState`
/// public stroke API: L-corner joints collapse to clean diagonals while the
/// stroke is drawn, reverts restore pre-stroke pixels, and the toggle is
/// snapshotted at stroke begin.
@Suite("Pixel-perfect strokes — L-corner filtering")
struct PixelPerfectStrokeTests {

    private let transparent = Color(r: 0, g: 0, b: 0, a: 0)

    @Test("a slow pencil L-corner reverts the corner middle pixel")
    func pencilLCornerRevertsMiddlePixel() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .pencil
        let fg = state.shared.foregroundColor

        // Right then down, one pixel per sample — the L-corner tip is (1,0).
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == fg)
        // The tip is reverted to its pre-stroke (transparent) pixel.
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == transparent)
    }

    @Test("with pixel-perfect off, the raw interpolated stroke is kept")
    func pixelPerfectOffKeepsRawStroke() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .pencil
        state.shared.pixelPerfect = false
        let fg = state.shared.foregroundColor

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()

        // No filtering: the corner tip stays painted.
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == fg)
    }

    @Test("an L-corner spanning sample batches is detected despite the shared junction pixel")
    func lCornerAcrossBatchSeamIsDetected() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .pencil
        let fg = state.shared.foregroundColor

        // Each `continueStroke` interpolates from the previous sample, so both
        // batches include the junction (2,0). Without seam dedupe the duplicate
        // puts `cur == next` in the filter's 3-window and the corner at (2,0)
        // silently survives.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == fg)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 1) == fg)
        // The corner tip at the batch seam is reverted.
        #expect(try state.activeTab.document.getPixel(x: 2, y: 0) == transparent)
    }

    @Test("an eraser L-corner reverts the tip to its pre-stroke color, not transparency")
    func eraserRevertRestoresPreStrokeColor() throws {
        let state = Workspace(width: 8, height: 8)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        // Solid red art the eraser cuts through.
        for y in 0..<3 {
            for x in 0..<3 {
                try state.activeTab.document.setPixel(x: UInt32(x), y: UInt32(y), color: red)
            }
        }
        state.shared.activeTool = .eraser

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == transparent)
        // The tip is restored to the red it held before the stroke —
        // reverting an eraser stroke must not leave a transparent hole.
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == red)
    }

    @Test("a pixel repainted later in the stroke reverts to its pre-stroke color, not an intra-stroke intermediate")
    func revertRestoresFirstTouchColor() throws {
        let state = Workspace(width: 8, height: 8)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try state.activeTab.document.setPixel(x: 1, y: 0, color: red)
        state.shared.activeTool = .pencil
        let fg = state.shared.foregroundColor

        // The stroke paints over (1,0), doubles back to repaint it, then turns
        // so a corner is detected at it. A last-touch cache would capture the
        // stroke's own paint and revert to black instead of the original red.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()

        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == fg)
        #expect(try state.activeTab.document.getPixel(x: 2, y: 0) == fg)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == fg)
        // The corner tip reverts to the pre-stroke red captured on first touch.
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == red)
    }

    @Test("toggling mid-stroke doesn't affect the in-flight stroke; the next stroke uses the new setting")
    func midStrokeToggleAffectsOnlyNextStroke() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .pencil
        let fg = state.shared.foregroundColor

        // Toggle off mid-stroke: the in-flight stroke snapshotted "on" at
        // begin and keeps filtering.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.shared.pixelPerfect = false
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == transparent)

        // The next stroke picks up the new (off) setting: raw corner kept.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 4))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))
        state.activeTab.endStroke()
        #expect(try state.activeTab.document.getPixel(x: 5, y: 4) == fg)
    }

    @Test("one undo reverts the entire filtered stroke as one step")
    func oneUndoRevertsWholeFilteredStroke() throws {
        let state = Workspace(width: 8, height: 8)
        state.shared.activeTool = .pencil

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 0))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()

        state.activeTab.handleUndo()

        // Every pixel the stroke touched — painted or reverted — is back to
        // its pre-stroke state after a single undo.
        #expect(try state.activeTab.document.getPixel(x: 0, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 0) == transparent)
        #expect(try state.activeTab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(!state.activeTab.canUndo)
    }
}
