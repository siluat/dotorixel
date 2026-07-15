import Testing
@testable import Dotorixel

/// Binding-level smoke tests for the shape geometry FFI functions.
///
/// The algorithms are unit-tested in the Rust core; these only prove the
/// functions are callable across the UniFFI boundary and marshal coordinates
/// correctly.
@Suite("Geometry FFI bindings — smoke")
struct GeometryBindingsTests {

    @Test("rectangle outline crosses the FFI boundary and normalizes drag direction")
    func rectangleOutlineSmoke() {
        // Dragged "backwards" (3,2) → (0,0): corners must normalize.
        let outline = Set(appleRectangleOutline(x0: 3, y0: 2, x1: 0, y1: 0))

        #expect(outline.contains(ScreenCanvasCoords(x: 0, y: 0)))
        #expect(outline.contains(ScreenCanvasCoords(x: 3, y: 0)))
        #expect(outline.contains(ScreenCanvasCoords(x: 0, y: 2)))
        #expect(outline.contains(ScreenCanvasCoords(x: 3, y: 2)))
        // Outline only — interior pixels are not part of the shape.
        #expect(!outline.contains(ScreenCanvasCoords(x: 1, y: 1)))
        #expect(!outline.contains(ScreenCanvasCoords(x: 2, y: 1)))
    }

    @Test("ellipse outline crosses the FFI boundary and normalizes drag direction")
    func ellipseOutlineSmoke() {
        // Dragged "backwards" (4,4) → (0,0): a 5×5 circle inscribed in the box.
        let outline = Set(appleEllipseOutline(x0: 4, y0: 4, x1: 0, y1: 0))

        // Axis endpoints touch the bounding box edges.
        #expect(outline.contains(ScreenCanvasCoords(x: 2, y: 0)))
        #expect(outline.contains(ScreenCanvasCoords(x: 2, y: 4)))
        #expect(outline.contains(ScreenCanvasCoords(x: 0, y: 2)))
        #expect(outline.contains(ScreenCanvasCoords(x: 4, y: 2)))
        // Bounding box corners lie outside the inscribed ellipse.
        #expect(!outline.contains(ScreenCanvasCoords(x: 0, y: 0)))
        #expect(!outline.contains(ScreenCanvasCoords(x: 4, y: 4)))
    }
}
