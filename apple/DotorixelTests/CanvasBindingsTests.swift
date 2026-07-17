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
}
