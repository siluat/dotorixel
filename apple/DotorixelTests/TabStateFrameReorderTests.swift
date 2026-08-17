import Foundation
import Testing
@testable import Dotorixel

/// Frame reordering on `TabState` (issue 286): the ruler drag's drop commit —
/// the frame-axis sibling of `TabStateLayerReorderTests`.
///
/// The seam takes an **axis index** (leftmost column = 0) because that is what
/// the ruler's drag reports, and the ruler renders the axis in the same order
/// `frameColumns` returns it, so no panel↔storage translation stands between
/// the two the way it does for layers.
@Suite("TabState — frame reorder")
struct TabStateFrameReorderTests {

    /// Three frames, each carrying one painted pixel at `(ordinal, ordinal)`,
    /// with the first frame re-activated. The paint makes each frame
    /// identifiable by content, so a reorder that moved slots without moving
    /// Cels would show up.
    private func makeThreeFrameTab() throws -> (tab: TabState, ids: [String]) {
        let tab = Workspace(width: 8, height: 8).activeTab
        for ordinal in 1...3 {
            if ordinal > 1 { tab.addFrame() }
            tab.beginStroke(at: ScreenCanvasCoords(x: Int32(ordinal), y: Int32(ordinal)))
            tab.endStroke()
        }
        let ids = tab.frameColumns.map(\.id)
        tab.setActiveFrame(id: ids[0])
        return (tab, ids)
    }

    /// The ordinal whose paint the frame at `axisIndex` carries — how these
    /// tests read "which frame is this slot showing" from the composite.
    private func paintedOrdinal(_ tab: TabState, axisIndex: Int) throws -> Int? {
        let frameId = tab.frameColumns[axisIndex].id
        let pixels = try tab.document.compositeAt(frameId: frameId)
        return (1...3).first { ordinal in
            let offset = Int((UInt32(ordinal) * tab.document.width() + UInt32(ordinal)) * 4)
            return pixels[offset + 3] != 0
        }
    }

    @Test("dragging a frame to a new axis position rearranges the axis, and its Cels travel with it")
    func reorderRearrangesTheAxisAndCelsFollow() throws {
        let (tab, ids) = try makeThreeFrameTab()

        // The last column dragged to the head of the axis.
        tab.reorderFrame(id: ids[2], toIndex: 0)

        #expect(tab.frameColumns.map(\.id) == [ids[2], ids[0], ids[1]])
        // The composite each ordinal now shows follows the frame's content, not
        // its old slot — Cels stay keyed by frame id.
        #expect(try paintedOrdinal(tab, axisIndex: 0) == 3)
        #expect(try paintedOrdinal(tab, axisIndex: 1) == 1)
        #expect(try paintedOrdinal(tab, axisIndex: 2) == 2)
    }

    @Test("an axis index past either end lands at that end — the core's silent clamp, mirrored")
    func outOfRangeAxisIndexClampsToTheAxisEnds() throws {
        let (tab, ids) = try makeThreeFrameTab()

        // A drag released past the last column reports an index off the axis;
        // the frame settles at the end rather than trapping on the raw value.
        tab.reorderFrame(id: ids[0], toIndex: 99)
        #expect(tab.frameColumns.map(\.id) == [ids[1], ids[2], ids[0]])

        // The same released left of the first column — a negative index, which
        // the axis reads as "the head" and never as an unsigned wrap-around.
        tab.reorderFrame(id: ids[0], toIndex: -5)
        #expect(tab.frameColumns.map(\.id) == [ids[0], ids[1], ids[2]])
    }

    @Test("reordering never changes which frame is active — the pointer is preserved by id")
    func reorderPreservesTheActiveFrame() throws {
        let (tab, ids) = try makeThreeFrameTab()
        tab.setActiveFrame(id: ids[1])

        // Another column moving past the active one leaves the pointer on the
        // frame the user was editing, not on the ordinal it used to occupy.
        tab.reorderFrame(id: ids[2], toIndex: 0)
        #expect(tab.frameColumns.map(\.id) == [ids[2], ids[0], ids[1]])
        #expect(tab.activeFrameId == ids[1])

        // …and so does dragging the active column itself.
        tab.reorderFrame(id: ids[1], toIndex: 0)
        #expect(tab.frameColumns.map(\.id) == [ids[1], ids[2], ids[0]])
        #expect(tab.activeFrameId == ids[1])

        // The active frame is still the drawing target after the moves: the
        // next stroke lands on its Cel and on no other frame's.
        tab.beginStroke(at: ScreenCanvasCoords(x: 7, y: 7))
        tab.endStroke()
        let painted = try tab.document.compositeAt(frameId: ids[1])
        let offset = Int((7 * tab.document.width() + 7) * 4)
        #expect(painted[offset + 3] != 0)
    }

    @Test("a real move records exactly one undo entry; undo restores the order and redo reapplies it")
    func realMoveRecordsOneEntryAndUndoRedoRoundTrips() throws {
        let (tab, ids) = try makeThreeFrameTab()

        tab.reorderFrame(id: ids[2], toIndex: 0)

        // One undo takes the axis back to the order before the drop…
        tab.handleUndo()
        #expect(tab.frameColumns.map(\.id) == [ids[0], ids[1], ids[2]])
        // …and the move recorded exactly one entry: the next undo peels the
        // last frame's stroke, not another rearrangement.
        tab.handleUndo()
        #expect(tab.frameColumns.map(\.id) == [ids[0], ids[1], ids[2]])
        #expect(try paintedOrdinal(tab, axisIndex: 2) == nil)

        tab.handleRedo()
        tab.handleRedo()
        #expect(tab.frameColumns.map(\.id) == [ids[2], ids[0], ids[1]])
    }

    @Test("a drop at the frame's current position records nothing and leaves the redo future intact")
    func dropAtCurrentPositionRecordsNothing() throws {
        let (tab, ids) = try makeThreeFrameTab()
        tab.reorderFrame(id: ids[2], toIndex: 0)
        tab.handleUndo()
        #expect(tab.canRedo)

        // Releasing a drag where it began is a full no-op: no entry, no
        // re-render signal, and the redo future (the undone move) survives.
        let versionBefore = tab.canvasVersion
        tab.reorderFrame(id: ids[1], toIndex: 1)
        #expect(tab.canvasVersion == versionBefore)
        #expect(tab.canRedo)
    }

    @Test("reorder no-ops while a stroke is drawing: the axis never moves under a live stroke")
    func reorderNoOpsWhileDrawing() throws {
        let (tab, ids) = try makeThreeFrameTab()

        tab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        // A second finger drags a ruler header mid-stroke (iPad multitouch) —
        // the mid-stroke seal ignores it: committing here would replace the
        // stroke's pending Edit Baseline.
        tab.reorderFrame(id: ids[2], toIndex: 0)
        #expect(tab.frameColumns.map(\.id) == [ids[0], ids[1], ids[2]])
        tab.endStroke()

        // The stroke's own undo entry survived intact: one undo erases it and
        // leaves the axis exactly as the fixture painted it.
        tab.handleUndo()
        #expect(tab.frameColumns.map(\.id) == [ids[0], ids[1], ids[2]])
        #expect(try paintedOrdinal(tab, axisIndex: 0) == 1)
    }
}
