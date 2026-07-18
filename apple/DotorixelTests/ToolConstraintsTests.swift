import Testing
@testable import Dotorixel

/// Shift-constrain math for the shape tools — the Swift equivalents of the
/// web's shell-side `constrainLine` / `constrainSquare`
/// (`src/lib/canvas/tool-constraints.ts`), verified against the same cases.
@Suite("Tool constraints — 45° snap and square normalization")
struct ToolConstraintsTests {

    @Test("a near-diagonal drag snaps to the exact 45° diagonal")
    func lineSnapsToDiagonal() {
        let anchor = ScreenCanvasCoords(x: 0, y: 0)
        let current = ScreenCanvasCoords(x: 10, y: 8)

        let snapped = constrainLine(anchor: anchor, current: current)

        #expect(snapped == ScreenCanvasCoords(x: 10, y: 10))
    }

    @Test("a shallow drag snaps to the horizontal axis, including the 2:1 boundary")
    func lineSnapsToHorizontal() {
        let anchor = ScreenCanvasCoords(x: 0, y: 0)

        // |dy| * 2 == |dx| is the last ratio that still snaps horizontal.
        let boundary = constrainLine(anchor: anchor, current: ScreenCanvasCoords(x: 10, y: 5))
        #expect(boundary == ScreenCanvasCoords(x: 10, y: 0))

        let shallow = constrainLine(anchor: anchor, current: ScreenCanvasCoords(x: 10, y: 3))
        #expect(shallow == ScreenCanvasCoords(x: 10, y: 0))
    }

    @Test("a steep drag snaps to the vertical axis, including the 2:1 boundary")
    func lineSnapsToVertical() {
        let anchor = ScreenCanvasCoords(x: 0, y: 0)

        // |dx| * 2 == |dy| is the last ratio that still snaps vertical.
        let boundary = constrainLine(anchor: anchor, current: ScreenCanvasCoords(x: 5, y: 10))
        #expect(boundary == ScreenCanvasCoords(x: 0, y: 10))

        let steep = constrainLine(anchor: anchor, current: ScreenCanvasCoords(x: 3, y: 10))
        #expect(steep == ScreenCanvasCoords(x: 0, y: 10))
    }

    @Test("diagonal snapping preserves direction in every quadrant, from a non-origin anchor")
    func lineSnapsDiagonallyInAllQuadrants() {
        let anchor = ScreenCanvasCoords(x: 8, y: 8)

        #expect(constrainLine(anchor: anchor, current: ScreenCanvasCoords(x: 13, y: 12))
            == ScreenCanvasCoords(x: 13, y: 13))
        #expect(constrainLine(anchor: anchor, current: ScreenCanvasCoords(x: 3, y: 12))
            == ScreenCanvasCoords(x: 3, y: 13))
        #expect(constrainLine(anchor: anchor, current: ScreenCanvasCoords(x: 3, y: 4))
            == ScreenCanvasCoords(x: 3, y: 3))
        #expect(constrainLine(anchor: anchor, current: ScreenCanvasCoords(x: 13, y: 4))
            == ScreenCanvasCoords(x: 13, y: 3))
    }

    @Test("a rectangular drag is forced square, keeping the drag direction on both axes")
    func squareNormalizesNegativeDrags() {
        let anchor = ScreenCanvasCoords(x: 8, y: 8)

        // Positive drag: the longer axis wins.
        #expect(constrainSquare(anchor: anchor, current: ScreenCanvasCoords(x: 13, y: 10))
            == ScreenCanvasCoords(x: 13, y: 13))
        // Negative drags keep their sign per axis.
        #expect(constrainSquare(anchor: anchor, current: ScreenCanvasCoords(x: 3, y: 10))
            == ScreenCanvasCoords(x: 3, y: 13))
        #expect(constrainSquare(anchor: anchor, current: ScreenCanvasCoords(x: 3, y: 6))
            == ScreenCanvasCoords(x: 3, y: 3))
        #expect(constrainSquare(anchor: anchor, current: ScreenCanvasCoords(x: 10, y: 3))
            == ScreenCanvasCoords(x: 13, y: 3))
    }

    @Test("a zero-axis square drag treats the zero delta as a positive direction (web parity)")
    func squareZeroDeltaCountsAsPositive() {
        let anchor = ScreenCanvasCoords(x: 8, y: 8)

        // dx == 0 → `dx >= 0` picks +x on the web; mirror that here.
        #expect(constrainSquare(anchor: anchor, current: ScreenCanvasCoords(x: 8, y: 4))
            == ScreenCanvasCoords(x: 12, y: 4))
    }
}
