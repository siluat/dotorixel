import Testing
import CoreGraphics
@testable import Dotorixel

/// Sampling loupe lifecycle (235), exercised through the `EditorState` public
/// stroke API: the loupe appears on the first sample of an eyedropper stroke,
/// its grid tracks the drag, and it disappears on release or cancel.
@Suite("Sampling loupe — appears with the eyedropper stroke, tracks it, disappears")
struct SamplingLoupeTests {

    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("beginning an eyedropper stroke shows the loupe with the target-centered grid")
    func eyedropperBeginShowsLoupe() throws {
        let state = EditorState(width: 16, height: 16)
        try state.pixelCanvas.setPixel(x: 5, y: 5, color: red)
        state.activeTool = .eyedropper

        state.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(state.samplingLoupe.isActive)
        #expect(state.samplingLoupe.grid[LoupeGeometry.centerIndex] == red)
    }

    @Test("the grid tracks the drag onto a new target pixel")
    func gridTracksDrag() throws {
        let state = EditorState(width: 16, height: 16)
        try state.pixelCanvas.setPixel(x: 5, y: 5, color: red)
        state.activeTool = .eyedropper

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))

        #expect(state.samplingLoupe.grid[LoupeGeometry.centerIndex] == red)
    }

    @Test("release dismisses the loupe")
    func releaseDismissesLoupe() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .eyedropper

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.endStroke()

        #expect(!state.samplingLoupe.isActive)
    }

    @Test("cancel dismisses the loupe")
    func cancelDismissesLoupe() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .eyedropper

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.cancelStroke()

        #expect(!state.samplingLoupe.isActive)
    }

    @Test("non-sampling tools never show the loupe")
    func drawingToolsNeverShowLoupe() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .pencil

        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))

        #expect(!state.samplingLoupe.isActive)
        state.endStroke()
    }

    @Test("position derives from the pushed pointer while the loupe is active")
    func positionDerivesFromPushedPointer() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .eyedropper

        // The pointer push is independent of the stroke lifecycle and always
        // safe to call — here it lands before the stroke begins.
        state.samplingLoupe.updatePointer(
            screen: CGPoint(x: 300, y: 400),
            viewport: CGSize(width: 800, height: 600),
            inputSource: .mouse
        )
        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))

        // Default tr quadrant off the mouse offset, using the real geometry.
        #expect(state.samplingLoupe.position == CGPoint(
            x: 300 + LoupeGeometry.mouseOffset,
            y: 400 - LoupeGeometry.height - LoupeGeometry.mouseOffset
        ))
    }

    @Test("position is nil before the loupe is active or any pointer is pushed")
    func positionIsNilWhenInactiveOrPointerless() {
        let state = EditorState(width: 16, height: 16)
        state.activeTool = .eyedropper

        // Pointer pushed but no active stroke → nil.
        state.samplingLoupe.updatePointer(
            screen: CGPoint(x: 300, y: 400),
            viewport: CGSize(width: 800, height: 600),
            inputSource: .mouse
        )
        #expect(state.samplingLoupe.position == nil)

        // Active stroke on a fresh state with no pointer push → nil.
        let untouched = EditorState(width: 16, height: 16)
        untouched.activeTool = .eyedropper
        untouched.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        #expect(untouched.samplingLoupe.position == nil)
    }
}
