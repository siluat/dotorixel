import Testing
import SwiftUI
import SnapshotTesting
@testable import Dotorixel

/// Rendered baseline for the sampling loupe overlay (235): the 9×9 grid with
/// every cell state (opaque, transparent checker, out-of-canvas hatch), the
/// center-cell rings, and the hex chip.
///
/// Recording host and re-record procedure: `apple/DotorixelTests/README.md`.
@Suite("Loupe view — rendered baseline")
@MainActor
struct LoupeViewSnapshotTests {

    /// A grid sampled at a canvas corner: out-of-canvas cells on the top and
    /// left, an opaque center, opaque neighbors, a semi-transparent pixel
    /// (must render as its full-opacity RGB, not a blend — web parity), and
    /// transparent cells — every visual state in one image.
    private func cornerGrid() throws -> [Dotorixel.Color?] {
        let canvas = try ApplePixelCanvas(width: 16, height: 16)
        let red = Dotorixel.Color(r: 0xE5, g: 0x3E, b: 0x3E, a: 0xFF)
        let blue = Dotorixel.Color(r: 0x3E, g: 0x6B, b: 0xE5, a: 0xFF)
        let halfGreen = Dotorixel.Color(r: 0x3E, g: 0xE5, b: 0x6B, a: 0x80)
        try canvas.setPixel(x: 2, y: 2, color: red)
        try canvas.setPixel(x: 3, y: 2, color: blue)
        try canvas.setPixel(x: 2, y: 3, color: blue)
        try canvas.setPixel(x: 3, y: 3, color: halfGreen)
        return sampleGrid(canvas: canvas, center: ScreenCanvasCoords(x: 2, y: 2), size: LoupeGeometry.gridSize)
    }

    @Test("loupe renders the grid states, center rings, and hex chip")
    func loupeBaseline() throws {
        assertSnapshot(
            of: LoupeView(grid: try cornerGrid()),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("loupe over a transparent center mutes the chip to an em-dash")
    func loupeTransparentCenterBaseline() throws {
        let canvas = try ApplePixelCanvas(width: 16, height: 16)
        let grid = sampleGrid(canvas: canvas, center: ScreenCanvasCoords(x: 8, y: 8), size: LoupeGeometry.gridSize)

        assertSnapshot(
            of: LoupeView(grid: grid),
            as: .image(layout: .sizeThatFits)
        )
    }
}
