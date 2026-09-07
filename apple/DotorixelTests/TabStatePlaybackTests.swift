import Foundation
import Testing
@testable import Dotorixel

/// Shell integration: Playback effects must not schedule persistence.
/// Transition rules are covered directly by EditLifecyclePlaybackTests.
@Suite("TabState — playback")
struct TabStatePlaybackTests {

    @Test("no playback action pushes history or marks the document dirty")
    func playbackActionsPushNoHistoryAndMarkNothingDirty() throws {
        let clock = FakeFrameScheduler()
        let recorder = PlaybackDirtyRecorder()
        let preparedDocument = makeSingleLayerDocument(width: 8, height: 8)
        let preparedShared = SharedState()
        try preparedDocument.addFrame(newId: makeFrameId())
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, notifier: recorder, frameScheduler: clock)
        let tab = workspace.activeTab
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

}

/// Playback across the tab lifecycle (issue 288): activation and close are
/// workspace decisions, so the stops they force live at the workspace seam.
@Suite("Workspace — playback lifecycle")
struct WorkspacePlaybackLifecycleTests {

    @Test("switching tabs stops the outgoing tab's playback")
    func tabSwitchStopsTheOutgoingTabsPlayback() throws {
        let clock = FakeFrameScheduler()
        let preparedDocument = makeSingleLayerDocument(width: 8, height: 8)
        let preparedShared = SharedState()
        try preparedDocument.addFrame(newId: makeFrameId())
        let workspace = workspaceWithDocument(preparedDocument, shared: preparedShared, frameScheduler: clock)
        let tab = workspace.activeTab
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
