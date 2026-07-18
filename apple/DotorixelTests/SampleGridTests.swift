import Testing
@testable import Dotorixel

/// Grid extraction for the sampling loupe: a 9×9 neighborhood read around the
/// eyedropper's target pixel (235). Mirrors the web's `sample-grid.ts` contract.
@Suite("Sample grid — 9×9 neighborhood around the target pixel")
struct SampleGridTests {

    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("grid is row-major with the target pixel's color at the center index")
    func gridCentersOnTargetPixel() throws {
        let canvas = try ApplePixelCanvas(width: 16, height: 16)
        try canvas.setPixel(x: 5, y: 5, color: red)

        let grid = sampleGrid(canvas: canvas, center: ScreenCanvasCoords(x: 5, y: 5), size: 9)

        #expect(grid.count == 81)
        #expect(grid[40] == red)
    }

    @Test("cells outside the canvas are nil, distinct from transparent pixels")
    func outOfBoundsCellsAreNilNotTransparent() throws {
        let canvas = try ApplePixelCanvas(width: 16, height: 16)

        // Center on the canvas origin: cells whose coordinates go negative
        // must read as "no pixel", not as transparent pixels.
        let grid = sampleGrid(canvas: canvas, center: ScreenCanvasCoords(x: 0, y: 0), size: 9)

        // Top-left cell (-4,-4) is outside; the center is a real (transparent) pixel.
        #expect(grid[0] == nil)
        #expect(grid[40] == Color(r: 0, g: 0, b: 0, a: 0))
        // Center row (y = 0): cells left of x=0 are nil, cells from x=0 on are pixels.
        let centerRow = Array(grid[36..<45])
        #expect(centerRow.map { $0 == nil } == [true, true, true, true, false, false, false, false, false])
    }
}
