import Testing
import CoreGraphics
@testable import Dotorixel

/// Sampling loupe lifecycle (235), exercised through the `TabState` public
/// stroke API: the loupe appears on the first sample of an eyedropper stroke,
/// its grid tracks the drag, and it disappears on release or cancel.
@Suite("Sampling loupe — appears with the eyedropper stroke, tracks it, disappears")
struct SamplingLoupeTests {

    private let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

    @Test("beginning an eyedropper stroke shows the loupe with the target-centered grid")
    func eyedropperBeginShowsLoupe() throws {
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setPixel(x: 5, y: 5, color: red)
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))

        #expect(state.activeTab.samplingLoupe.isActive)
        #expect(state.activeTab.samplingLoupe.grid[LoupeGeometry.centerIndex] == red)
    }

    @Test("the grid tracks the drag onto a new target pixel")
    func gridTracksDrag() throws {
        let state = Workspace(width: 16, height: 16)
        try state.activeTab.document.setPixel(x: 5, y: 5, color: red)
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 5, y: 5))

        #expect(state.activeTab.samplingLoupe.grid[LoupeGeometry.centerIndex] == red)
    }

    @Test("release dismisses the loupe")
    func releaseDismissesLoupe() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.endStroke()

        #expect(!state.activeTab.samplingLoupe.isActive)
    }

    @Test("cancel dismisses the loupe")
    func cancelDismissesLoupe() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .eyedropper

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.cancelStroke()

        #expect(!state.activeTab.samplingLoupe.isActive)
    }

    @Test("non-sampling tools never show the loupe")
    func drawingToolsNeverShowLoupe() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .pencil

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))

        #expect(!state.activeTab.samplingLoupe.isActive)
        state.activeTab.endStroke()
    }

    @Test("position derives from the pushed pointer while the loupe is active")
    func positionDerivesFromPushedPointer() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .eyedropper

        // The pointer push is independent of the stroke lifecycle and always
        // safe to call — here it lands before the stroke begins.
        state.activeTab.samplingLoupe.updatePointer(
            screen: CGPoint(x: 300, y: 400),
            viewport: CGSize(width: 800, height: 600),
            inputSource: .mouse
        )
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))

        // Default tr quadrant off the mouse offset, using the real geometry.
        #expect(state.activeTab.samplingLoupe.position == CGPoint(
            x: 300 + LoupeGeometry.mouseOffset,
            y: 400 - LoupeGeometry.height - LoupeGeometry.mouseOffset
        ))
    }

    @Test("position is nil before the loupe is active or any pointer is pushed")
    func positionIsNilWhenInactiveOrPointerless() {
        let state = Workspace(width: 16, height: 16)
        state.shared.activeTool = .eyedropper

        // Pointer pushed but no active stroke → nil.
        state.activeTab.samplingLoupe.updatePointer(
            screen: CGPoint(x: 300, y: 400),
            viewport: CGSize(width: 800, height: 600),
            inputSource: .mouse
        )
        #expect(state.activeTab.samplingLoupe.position == nil)

        // Active stroke on a fresh state with no pointer push → nil.
        let untouched = Workspace(width: 16, height: 16)
        untouched.shared.activeTool = .eyedropper
        untouched.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        #expect(untouched.activeTab.samplingLoupe.position == nil)
    }
}
