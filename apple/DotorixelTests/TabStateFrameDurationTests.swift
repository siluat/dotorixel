import Foundation
import Testing
@testable import Dotorixel

/// Per-frame display-duration editing on `TabState` (issue 287): the commit
/// path the Timeline's duration editor dispatches through, with web-parity
/// history semantics and the binding-owned clamp range.
@Suite("TabState — frame duration")
struct TabStateFrameDurationTests {

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

    private func duration(of frameId: String, in tab: TabState) -> UInt32? {
        tab.frameColumns.first(where: { $0.id == frameId })?.durationMs
    }

    @Test("setFrameDuration retimes one frame and leaves the others untouched")
    func setFrameDurationRetimesOnlyItsOwnFrame() throws {
        let (tab, first, second) = try makeTwoFrameTab()

        tab.setFrameDuration(id: first, durationMs: 250)

        #expect(duration(of: first, in: tab) == 250)
        // Durations are per-frame: the other frame keeps the core's default.
        #expect(duration(of: second, in: tab) == 100)
    }

    @Test("a committed retime is one undoable entry; redo reapplies it")
    func committedRetimeIsUndoable() throws {
        let (tab, first, _) = try makeTwoFrameTab()

        tab.setFrameDuration(id: first, durationMs: 250)

        tab.handleUndo()
        #expect(duration(of: first, in: tab) == 100)
        #expect(!tab.canUndo)

        tab.handleRedo()
        #expect(duration(of: first, in: tab) == 250)
    }

    @Test("committing the frame's current duration records no history entry")
    func unchangedCommitRecordsNoHistoryEntry() throws {
        let (tab, first, _) = try makeTwoFrameTab()

        tab.setFrameDuration(id: first, durationMs: 100)

        #expect(duration(of: first, in: tab) == 100)
        #expect(!tab.canUndo)
    }

    @Test("an out-of-range dispatch stores the binding-clamped bound")
    func outOfRangeDispatchStoresTheClampedBound() throws {
        let (tab, first, _) = try makeTwoFrameTab()

        // The clamp lives at the binding boundary (issue 283); the shell
        // command inherits it rather than restating the range.
        tab.setFrameDuration(id: first, durationMs: frameMaxDurationMs() + 1)
        #expect(duration(of: first, in: tab) == frameMaxDurationMs())

        tab.setFrameDuration(id: first, durationMs: frameMinDurationMs() - 1)
        #expect(duration(of: first, in: tab) == frameMinDurationMs())
    }

    @Test("a duplicated frame carries its source's duration")
    func duplicatedFrameCarriesItsSourcesDuration() throws {
        let (tab, first, _) = try makeTwoFrameTab()

        tab.setFrameDuration(id: first, durationMs: 250)
        tab.duplicateFrame()

        // Core behavior, verified at the shell seam: the copy is retimed like
        // its source, and retiming the copy leaves the source untouched.
        let copy = tab.activeFrameId
        #expect(copy != first)
        #expect(duration(of: copy, in: tab) == 250)

        tab.setFrameDuration(id: copy, durationMs: 500)
        #expect(duration(of: first, in: tab) == 250)
    }

    @Test("setFrameDuration no-ops while a stroke is drawing: no retime lands under a live stroke")
    func setFrameDurationNoOpsWhileDrawing() throws {
        let (tab, first, _) = try makeTwoFrameTab()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.setFrameDuration(id: first, durationMs: 250)
        #expect(duration(of: first, in: tab) == 100)
        tab.endStroke()

        // One undo — the stroke's own entry — empties History: the refused
        // retime contributed nothing.
        tab.handleUndo()
        #expect(!tab.canUndo)
    }
}
