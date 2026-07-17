import Testing
@testable import Dotorixel

/// Binding-level smoke tests for `ApplePixelCanvas` FFI methods.
///
/// The algorithms are unit-tested in the Rust core; these only prove the
/// methods are callable across the UniFFI boundary and marshal correctly.
@Suite("PixelCanvas FFI bindings — smoke")
struct CanvasBindingsTests {

    @Test("flood fill crosses the FFI boundary and fills the connected region")
    func floodFillSmoke() throws {
        let canvas = try ApplePixelCanvas(width: 4, height: 4)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

        #expect(canvas.floodFill(x: 1, y: 1, fillColor: red))

        // The whole canvas is one transparent region, so every corner fills.
        #expect(try canvas.getPixel(x: 0, y: 0) == red)
        #expect(try canvas.getPixel(x: 3, y: 3) == red)
    }

    @Test("edit baseline begin/end cross the FFI boundary and report the verdict")
    func editBaselineSmoke() throws {
        let canvas = try ApplePixelCanvas(width: 2, height: 2)
        let history = AppleHistoryManager.defaultManager()

        // No-op edit: identical pixels at begin and end → nothing committed.
        history.beginEdit(width: canvas.width(), height: canvas.height(), pixels: canvas.pixels())
        let noopCommitted = history.endEdit(currentWidth: canvas.width(), currentHeight: canvas.height(), currentPixels: canvas.pixels())
        #expect(!noopCommitted)
        #expect(!history.canUndo())

        // Real edit: a changed pixel at end → the baseline commits.
        history.beginEdit(width: canvas.width(), height: canvas.height(), pixels: canvas.pixels())
        try canvas.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        let realCommitted = history.endEdit(currentWidth: canvas.width(), currentHeight: canvas.height(), currentPixels: canvas.pixels())
        #expect(realCommitted)
        #expect(history.canUndo())
    }
}
