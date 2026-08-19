import Foundation
import Testing
@testable import Dotorixel

/// The playback engine on `TabState` (issue 288): the transient playhead over
/// the frame axis, verified through the real bindings at the display-buffer
/// seam. Playback is a preview, not an edit — it must never move the Active
/// Frame, mark the document dirty, or enter History.
@Suite("TabState — playback")
struct TabStatePlaybackTests {

    @Test("starting playback shows the first frame's composite; the Active Frame stays untouched")
    func startExposesPlayheadCompositeWithoutMovingTheActiveFrame() throws {
        let (tab, first, second, _) = try makeTwoFrameTab()
        // Paint the second frame and leave it active, so the playhead's frame
        // (the first) and the Active Frame's composite are distinguishable.
        tab.setActiveFrame(id: second)
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()

        tab.startPlayback()

        #expect(tab.isPlaying)
        #expect(tab.playheadFrameId == first)
        // The display buffer shows the playhead frame's committed composite…
        #expect(try tab.renderPixels() == tab.document.compositeAt(frameId: first))
        // …while the edit pointer never moved.
        #expect(tab.activeFrameId == second)
    }

    @Test("a clock tick advances the playhead once the frame's duration elapses")
    func clockTickAdvancesThePlayheadAtTheFrameDuration() throws {
        let (tab, _, second, clock) = try makeTwoFrameTab()
        tab.startPlayback()

        // The first tick only primes the clock baseline; the default frame
        // duration (100ms) then elapses across the next tick.
        clock.fireAt(1000)
        clock.fireAt(1100)

        #expect(tab.playheadFrameId == second)
        #expect(try tab.renderPixels() == tab.document.compositeAt(frameId: second))
    }

    @Test("with Loop off, running off the last frame stops playback and releases the clock")
    func loopOffCompletionStopsPlaybackAndReleasesTheClock() throws {
        let (tab, _, _, clock) = try makeTwoFrameTab()
        tab.startPlayback()

        // 250ms crosses both default 100ms holds and runs off the end.
        clock.fireAt(1000)
        clock.fireAt(1250)

        #expect(!tab.isPlaying)
        #expect(tab.playheadFrameId == nil)
        // The display returns to the Active Frame's edit composite…
        #expect(try tab.renderPixels() == tab.document.composite())
        // …and a stopped tab never keeps a clock running.
        #expect(!clock.hasScheduled)
    }

    @Test("with Loop on, the sequence end wraps back to the first frame and keeps playing")
    func loopOnWrapsAndKeepsPlaying() throws {
        let (tab, first, _, clock) = try makeTwoFrameTab()
        tab.togglePlaybackLoop()
        tab.startPlayback()

        // The same 250ms that stops a loop-off run wraps a loop-on one.
        clock.fireAt(1000)
        clock.fireAt(1250)

        #expect(tab.isPlaying)
        #expect(tab.playheadFrameId == first)
        #expect(clock.hasScheduled)
    }

    @Test("stopping playback returns the display to the Active Frame and releases the clock")
    func stopReturnsToTheActiveFrameComposite() throws {
        let (tab, _, second, clock) = try makeTwoFrameTab()
        tab.setActiveFrame(id: second)
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()
        tab.startPlayback()
        clock.fireAt(1000)

        tab.stopPlayback()

        #expect(!tab.isPlaying)
        #expect(tab.playheadFrameId == nil)
        // Back on the Active Frame's edit composite (the painted second frame).
        #expect(try tab.renderPixels() == tab.document.composite())
        #expect(!clock.hasScheduled)
    }

    @Test("a multi-second tick delta is clamped so a resumed app never fast-forwards")
    func backgroundResumeDeltaIsClamped() throws {
        let (tab, first, second, clock) = try makeTwoFrameTab()
        // Grow the axis to [first, second, third] — addFrame inserts after the
        // active frame, so the third is added while the second is active.
        let third = makeFrameId()
        try tab.document.setActiveFrame(id: second)
        try tab.document.addFrame(newId: third)
        try tab.document.setActiveFrame(id: first)
        tab.togglePlaybackLoop()
        tab.startPlayback()

        clock.fireAt(1000)
        // A 1700ms delta (a backgrounded-app resume) is clamped to 1000ms:
        // 1000ms across the 300ms loop lands on the second frame, where the
        // unclamped 1700ms would land on the third.
        clock.fireAt(2700)

        #expect(tab.playheadFrameId == second)
    }

    @Test("a structural document change stops playback — removing a frame must not race a moving playhead")
    func structuralChangeStopsPlayback() throws {
        let (tab, _, second, clock) = try makeTwoFrameTab()
        tab.startPlayback()
        clock.fireAt(1000)

        tab.removeFrame(id: second)

        #expect(!tab.isPlaying)
        #expect(tab.playheadFrameId == nil)
        #expect(!clock.hasScheduled)
    }

    @Test("a tool stroke exits the playback preview and lands on the Active Frame")
    func toolStrokeStopsPlaybackAndEditsTheActiveFrame() throws {
        let (tab, first, second, clock) = try makeTwoFrameTab()
        tab.setActiveFrame(id: second)
        tab.startPlayback()
        clock.fireAt(1000)

        // The user draws mid-playback: the stroke must apply to (and show)
        // the frame being edited, not the moving playhead.
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()

        #expect(!tab.isPlaying)
        #expect(try tab.document.compositeAt(frameId: first).allSatisfy { $0 == 0 })
        #expect(try !tab.document.compositeAt(frameId: second).allSatisfy { $0 == 0 })
    }

    @Test("undo and redo exit the playback preview before touching the document")
    func undoAndRedoStopPlayback() throws {
        let (tab, first, _, clock) = try makeTwoFrameTab()
        tab.setFrameDuration(id: first, durationMs: 250)

        tab.startPlayback()
        clock.fireAt(1000)
        tab.handleUndo()
        #expect(!tab.isPlaying)

        tab.startPlayback()
        clock.fireAt(2000)
        tab.handleRedo()
        #expect(!tab.isPlaying)
    }

    @Test("pasting during playback exits the preview so the pasted selection is visible")
    func pasteDuringPlaybackStopsPlayback() throws {
        let (tab, _, _, clock) = try makeTwoFrameTab()
        tab.startPlayback()
        clock.fireAt(1000)

        let clipboard = try #require(SelectionClipboard(
            pixels: Data([0xFF, 0x00, 0x00, 0xFF]),
            width: 1,
            height: 1
        ))
        tab.pasteSelectionClipboard(clipboard)

        // Pasting is an edit action: it exits the preview so the Floating
        // Selection it creates renders instead of hiding behind the playhead.
        #expect(!tab.isPlaying)
        #expect(tab.floatingSelectionOffset != nil)
        #expect(try !tab.renderPixels().allSatisfy { $0 == 0 })
    }

    @Test("a keyboard nudge during playback exits the preview before lifting the Marquee")
    func nudgeDuringPlaybackStopsPlayback() throws {
        let (tab, _, _, clock) = try makeTwoFrameTab()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        tab.startPlayback()
        clock.fireAt(1000)

        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))

        #expect(!tab.isPlaying)
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))
    }

    @Test("starting playback commits an in-flight Floating Selection")
    func startCommitsAnInFlightFloatingSelection() throws {
        let (tab, _, _, _) = try makeTwoFrameTab()
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(tab.floatingSelectionOffset != nil)

        tab.startPlayback()

        // The lifted pixels landed on their origin Cel before the playhead
        // began previewing committed art.
        #expect(tab.floatingSelectionOffset == nil)
        #expect(tab.isPlaying)
        #expect(try tab.document.getPixel(x: 2, y: 1) == red)
    }

    @Test("togglePlayback flips between the started and stopped states")
    func togglePlaybackFlipsPlayState() throws {
        let (tab, first, _, _) = try makeTwoFrameTab()

        tab.togglePlayback()
        #expect(tab.isPlaying)
        #expect(tab.playheadFrameId == first)

        tab.togglePlayback()
        #expect(!tab.isPlaying)
        #expect(tab.playheadFrameId == nil)
    }

    @Test("no playback action pushes history or marks the document dirty")
    func playbackActionsPushNoHistoryAndMarkNothingDirty() throws {
        let clock = FakeFrameScheduler()
        let recorder = PlaybackDirtyRecorder()
        let workspace = Workspace(width: 8, height: 8, notifier: recorder, frameScheduler: clock)
        let tab = workspace.activeTab
        try tab.document.addFrame(newId: makeFrameId())
        recorder.reset()

        tab.startPlayback()
        clock.fireAt(1000)
        clock.fireAt(1100)
        tab.togglePlaybackLoop()
        tab.stopPlayback()

        #expect(!tab.canUndo)
        #expect(recorder.markedDocumentIds.isEmpty)
        #expect(recorder.workspaceMarkCount == 0)
    }

    @Test("the playhead composite respects layer visibility and excludes the Reference Layer")
    func playheadCompositeRespectsVisibilityAndExcludesReference() throws {
        let (tab, _, _, _) = try makeTwoFrameTab()
        // Paint the first frame, then hide the painted layer.
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()
        tab.setLayerVisibility(id: tab.document.activeLayerId(), visible: false)
        // Add an opaque single-pixel Reference Layer.
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "ref",
            rgba: Data([0xFF, 0x00, 0x00, 0xFF]),
            width: 1,
            height: 1
        ))

        tab.startPlayback()

        // The display buffer shows committed, visible pixel art only: the
        // hidden layer's paint and the Reference Layer are both excluded.
        #expect(try tab.renderPixels().allSatisfy { $0 == 0 })
    }
}

/// Playback across the tab lifecycle (issue 288): activation and close are
/// workspace decisions, so the stops they force live at the workspace seam.
@Suite("Workspace — playback lifecycle")
struct WorkspacePlaybackLifecycleTests {

    @Test("switching tabs stops the outgoing tab's playback")
    func tabSwitchStopsTheOutgoingTabsPlayback() throws {
        let clock = FakeFrameScheduler()
        let workspace = Workspace(width: 8, height: 8, frameScheduler: clock)
        let tab = workspace.activeTab
        try tab.document.addFrame(newId: makeFrameId())
        tab.startPlayback()
        clock.fireAt(1000)

        workspace.addTab()

        #expect(!tab.isPlaying)
        #expect(tab.playheadFrameId == nil)
        #expect(!clock.hasScheduled)

        tab.startPlayback()
        // Switching TO the playing tab leaves its playback running — a switch
        // stops only the outgoing tab.
        workspace.setActiveTab(0)
        #expect(tab.isPlaying)
        // The switch away is what stops it.
        workspace.setActiveTab(1)
        #expect(!tab.isPlaying)
    }

    @Test("closing a tab discards its transient playback clock")
    func closeTabDiscardsItsPlaybackClock() throws {
        let clock = FakeFrameScheduler()
        let workspace = Workspace(width: 8, height: 8, frameScheduler: clock)
        let second = workspace.addTab()
        second.startPlayback()
        clock.fireAt(1000)

        workspace.closeTab(1)

        #expect(!second.isPlaying)
        // A closed tab never keeps a clock running.
        #expect(!clock.hasScheduled)
    }

    @Test("a reopened tab's playback schedules on the workspace's injected clock")
    func reopenedTabUsesTheInjectedClock() throws {
        let source = Workspace(width: 4, height: 4)
        let snapshot = source.toSnapshot().tabs[0]

        let clock = FakeFrameScheduler()
        let workspace = Workspace(width: 8, height: 8, frameScheduler: clock)
        let reopened = try workspace.openSnapshot(snapshot)

        reopened.startPlayback()

        // The injection contract: the workspace forwards one scheduler to
        // every tab it constructs, the reopen path included.
        #expect(clock.hasScheduled)
    }
}

/// Records every dirty mark so playback tests can assert none arrive.
private final class PlaybackDirtyRecorder: DirtyNotifier {
    private(set) var markedDocumentIds: [String] = []
    private(set) var workspaceMarkCount = 0

    func markDirty(documentId: String) { markedDocumentIds.append(documentId) }
    func markWorkspaceDirty() { workspaceMarkCount += 1 }
    func notifyTabRemoved(documentId: String) {}

    func reset() {
        markedDocumentIds = []
        workspaceMarkCount = 0
    }
}
