import Foundation
import Testing
@testable import Dotorixel

/// Frame axis behavior on `TabState` (issue 284): Active Frame switching from
/// the timeline ruler, with web-parity history semantics. Multi-frame fixtures
/// are built programmatically through the 283 bindings — the frame operations
/// that create them from the UI arrive with issue 285.
@Suite("TabState — frame axis")
struct TabStateFrameTests {

    /// A tab whose document carries a second frame, with the first frame
    /// re-activated so tests start at ordinal 1.
    private func makeTwoFrameTab() throws -> (tab: TabState, first: String, second: String) {
        let state = Workspace(width: 8, height: 8)
        let tab = state.activeTab
        let first = tab.document.activeFrameId()
        let second = makeFrameId()
        try tab.document.addFrame(newId: second)
        try tab.document.setActiveFrame(id: first)
        return (tab, first, second)
    }

    /// Whether the frame's composite is fully transparent — the "did any paint
    /// reach this frame" probe these tests read a cel through.
    private func isFrameBlank(_ tab: TabState, frameId: String) throws -> Bool {
        try tab.document.compositeAt(frameId: frameId).allSatisfy { $0 == 0 }
    }

    @Test("setActiveFrame switches the drawing target: a stroke lands on the tapped frame and nowhere else")
    func setActiveFrameSwitchesDrawingTarget() throws {
        let (tab, first, second) = try makeTwoFrameTab()

        tab.setActiveFrame(id: second)
        #expect(tab.activeFrameId == second)

        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()

        // The stroke landed on the activated frame's cel…
        let painted = try tab.document.compositeAt(frameId: second)
        let offset = Int((2 * tab.document.width() + 2) * 4)
        #expect(Array(painted[offset..<offset + 4]) == [0x00, 0x00, 0x00, 0xFF])

        // …and nowhere else: the other frame's composite stayed transparent.
        #expect(try isFrameBlank(tab, frameId: first))
    }

    @Test("set-active records no history entry and no-ops on the already-active column")
    func setActiveRecordsNoHistoryAndNoOpsOnActiveColumn() throws {
        let (tab, first, second) = try makeTwoFrameTab()

        tab.setActiveFrame(id: second)

        // Navigating the timeline never pollutes undo (web parity).
        #expect(!tab.canUndo)

        // Tapping the already-active column is a full no-op — no re-render signal.
        let versionBefore = tab.canvasVersion
        tab.setActiveFrame(id: second)
        #expect(tab.canvasVersion == versionBefore)

        // An unknown id leaves the pointer where it was.
        tab.setActiveFrame(id: makeFrameId())
        #expect(tab.activeFrameId == second)
        #expect(tab.canvasVersion == versionBefore)

        tab.setActiveFrame(id: first)
        #expect(tab.activeFrameId == first)
    }

    @Test("undo after draw-switch-draw restores the pixels of the frame that was drawn on")
    func undoRestoresThePaintedFramesPixels() throws {
        let (tab, first, second) = try makeTwoFrameTab()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        tab.setActiveFrame(id: second)
        tab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        tab.endStroke()

        // One undo per stroke — the switch in between contributed no entry.
        tab.handleUndo()
        #expect(try isFrameBlank(tab, frameId: second))
        #expect(try !isFrameBlank(tab, frameId: first))

        tab.handleUndo()
        #expect(try isFrameBlank(tab, frameId: first))
        #expect(!tab.canUndo)
    }

    @Test("frameColumns projects the axis in order with per-Cel occupancy")
    func frameColumnsProjectTheAxisWithOccupancy() throws {
        let (tab, first, second) = try makeTwoFrameTab()
        let layerId = tab.document.activeLayerId()

        #expect(tab.frameColumns.map(\.id) == [first, second])
        #expect(tab.frameColumns.allSatisfy { $0.occupiedLayerIds.isEmpty })
        // 100 ms = 10 fps, the core's default for a fresh frame.
        #expect(tab.frameColumns.allSatisfy { $0.durationMs == 100 })

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()

        #expect(tab.frameColumns[0].occupiedLayerIds == [layerId])
        #expect(tab.frameColumns[1].occupiedLayerIds.isEmpty)

        // The projection follows the document rather than a stale read.
        tab.handleUndo()
        #expect(tab.frameColumns[0].occupiedLayerIds.isEmpty)
    }

    @Test("switching frames commits an in-flight Floating Selection to the Cel it was lifted from")
    func setActiveFrameCommitsFloatingSelectionToItsOriginCel() throws {
        let (tab, first, second) = try makeTwoFrameTab()
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 2, dy: 0))
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 2, dy: 0))

        tab.setActiveFrame(id: second)

        // The lifted pixel landed on its origin frame at the translated
        // position — not on the frame the tap switched to.
        #expect(tab.floatingSelectionOffset == nil)
        #expect(try isFrameBlank(tab, frameId: second))
        tab.setActiveFrame(id: first)
        #expect(try tab.document.getPixel(x: 3, y: 1) == red)
        #expect(try tab.document.getPixel(x: 1, y: 1).a == 0)
    }

    @Test("set-active no-ops while a stroke is drawing: the stroke's target never switches mid-stroke")
    func setActiveNoOpsWhileDrawing() throws {
        let (tab, first, second) = try makeTwoFrameTab()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.setActiveFrame(id: second)
        #expect(tab.activeFrameId == first)
        tab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        tab.endStroke()

        // The whole stroke landed on the frame it began on.
        #expect(try isFrameBlank(tab, frameId: second))
        #expect(try !isFrameBlank(tab, frameId: first))
    }
}
