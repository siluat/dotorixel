import Foundation
import Testing
@testable import Dotorixel

/// Frame axis behavior on `TabState` (issues 284, 285): Active Frame switching
/// from the timeline ruler and the structural frame operations that grow the
/// axis, with web-parity history semantics.
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

    // MARK: - Frame operations (issue 285)

    @Test("add inserts an empty frame after the active one and makes it the drawing target")
    func addFrameInsertsEmptyFrameAfterActive() throws {
        let tab = Workspace(width: 8, height: 8).activeTab
        let first = tab.activeFrameId

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()

        tab.addFrame()

        let ids = tab.frameColumns.map(\.id)
        #expect(ids.count == 2)
        #expect(ids[0] == first)
        // The new frame lands directly after the active one and becomes the
        // drawing target — its composite is fully transparent…
        #expect(tab.activeFrameId == ids[1])
        #expect(try isFrameBlank(tab, frameId: ids[1]))
        // …and the frame it was added after keeps its pixels.
        #expect(try !isFrameBlank(tab, frameId: first))
    }

    @Test("duplicate clones the active frame's whole composited moment into a new active frame")
    func duplicateFrameClonesTheActiveFrame() throws {
        let tab = Workspace(width: 8, height: 8).activeTab
        try tab.document.addLayer(newId: makeLayerId(), name: "Layer 2")
        let source = tab.activeFrameId

        // Paint on both layers, so the clone has to carry the whole moment
        // rather than only the active layer's Cel.
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        tab.setActiveLayer(id: tab.document.layers()[0].id)
        tab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        tab.endStroke()
        let sourceComposite = try tab.document.compositeAt(frameId: source)

        tab.duplicateFrame()

        let ids = tab.frameColumns.map(\.id)
        #expect(ids.count == 2)
        #expect(ids[0] == source)
        let copy = ids[1]
        #expect(tab.activeFrameId == copy)
        #expect(try tab.document.compositeAt(frameId: copy) == sourceComposite)

        // The copy is a deep clone: painting on it leaves the source alone.
        tab.beginStroke(at: ScreenCanvasCoords(x: 7, y: 7))
        tab.endStroke()
        #expect(try tab.document.compositeAt(frameId: source) == sourceComposite)
    }

    @Test("remove deletes the frame, activates an adjacent one, and is refused on the last frame")
    func removeFrameDeletesAndRelocatesTheActiveFrame() throws {
        let (tab, first, second) = try makeTwoFrameTab()

        // Frame 1 alone carries paint, so the surviving axis is identifiable.
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        tab.setActiveFrame(id: second)

        #expect(tab.canRemoveFrame)
        tab.removeFrame(id: second)

        #expect(tab.frameColumns.map(\.id) == [first])
        #expect(tab.activeFrameId == first)
        #expect(try !isFrameBlank(tab, frameId: first))

        // A document never has zero frames: the sole frame's affordance is
        // disabled, and the command refuses it without recording an entry.
        #expect(!tab.canRemoveFrame)
        let versionBefore = tab.canvasVersion
        tab.removeFrame(id: first)
        #expect(tab.frameColumns.map(\.id) == [first])
        #expect(tab.canvasVersion == versionBefore)
    }

    @Test("one undo restores the frame structure and the Cel pixels each operation changed; redo reapplies it")
    func undoRestoresFrameStructureAndPixels() throws {
        let tab = Workspace(width: 8, height: 8).activeTab
        let first = tab.activeFrameId

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()

        // Add — one entry, undone in one step.
        tab.addFrame()
        #expect(tab.frameColumns.count == 2)
        tab.handleUndo()
        #expect(tab.frameColumns.map(\.id) == [first])
        #expect(tab.activeFrameId == first)
        tab.handleRedo()
        #expect(tab.frameColumns.count == 2)
        // The snapshot carries the active pointer, so redo lands back on the
        // frame the add had activated.
        #expect(tab.activeFrameId == tab.frameColumns[1].id)

        // Remove — the undo has to bring back the frame's Cel pixels, not just
        // its slot on the axis, so paint the second frame before deleting it.
        let second = tab.frameColumns[1].id
        tab.setActiveFrame(id: second)
        tab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        tab.endStroke()
        let removedComposite = try tab.document.compositeAt(frameId: second)

        tab.removeFrame(id: second)
        #expect(tab.frameColumns.map(\.id) == [first])

        tab.handleUndo()
        #expect(tab.frameColumns.map(\.id) == [first, second])
        #expect(try tab.document.compositeAt(frameId: second) == removedComposite)

        tab.handleRedo()
        #expect(tab.frameColumns.map(\.id) == [first])
    }

    @Test("frame operations no-op while a stroke is drawing: the axis never moves under a live stroke")
    func frameOperationsNoOpWhileDrawing() throws {
        let (tab, first, second) = try makeTwoFrameTab()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.addFrame()
        tab.duplicateFrame()
        tab.removeFrame(id: second)
        #expect(tab.frameColumns.map(\.id) == [first, second])
        #expect(tab.activeFrameId == first)

        tab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        tab.endStroke()

        // The whole stroke landed on the frame it began on, and one undo — the
        // stroke's own entry — takes it back.
        #expect(try isFrameBlank(tab, frameId: second))
        tab.handleUndo()
        #expect(try isFrameBlank(tab, frameId: first))
        #expect(!tab.canUndo)
    }

    @Test("a live stroke's occupancy dot appears on its own Cel while every other Cel keeps its own")
    func liveStrokeUpdatesOnlyItsOwnCelOccupancy() throws {
        let (tab, first, second) = try makeTwoFrameTab()
        try tab.document.addLayer(newId: makeLayerId(), name: "Layer 2")
        let bottom = tab.document.layers()[0].id
        let top = tab.document.activeLayerId()

        // Frame 2 carries paint on the bottom layer, so the axis starts with
        // an occupancy the stroke below must neither lose nor duplicate.
        tab.setActiveFrame(id: second)
        tab.setActiveLayer(id: bottom)
        tab.beginStroke(at: ScreenCanvasCoords(x: 6, y: 6))
        tab.endStroke()

        tab.setActiveFrame(id: first)
        tab.setActiveLayer(id: top)
        #expect(tab.frameColumns[0].occupiedLayerIds.isEmpty)

        // Mid-stroke: the dot lands on the Cel being painted…
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        #expect(tab.frameColumns[0].occupiedLayerIds == [top])
        // …and the untouched frame keeps the occupancy it already had.
        #expect(tab.frameColumns[1].occupiedLayerIds == [bottom])

        tab.endStroke()
        #expect(tab.frameColumns[0].occupiedLayerIds == [top])
        #expect(tab.frameColumns[1].occupiedLayerIds == [bottom])
    }

    @Test("an erasing stroke clears its own occupancy dot mid-stroke")
    func liveEraseClearsItsOwnCelOccupancy() throws {
        let state = Workspace(width: 8, height: 8)
        let tab = state.activeTab
        let layer = tab.document.activeLayerId()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        #expect(tab.frameColumns[0].occupiedLayerIds == [layer])

        // Occupancy is not a one-way latch: the re-probe has to see the Cel
        // empty again while the eraser is still down.
        state.shared.activeTool = .eraser
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        #expect(tab.frameColumns[0].occupiedLayerIds.isEmpty)
        tab.endStroke()
        #expect(tab.frameColumns[0].occupiedLayerIds.isEmpty)
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
