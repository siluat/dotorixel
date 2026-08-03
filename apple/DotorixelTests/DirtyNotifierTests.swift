import Testing
@testable import Dotorixel

/// Records dirty marks and tab removals — the test adapter for the
/// `DirtyNotifier` port (web parity: `createFakeDirtyNotifier`).
private final class RecordingNotifier: DirtyNotifier {
    private(set) var marked: [String] = []
    private(set) var removed: [String] = []

    func markDirty(documentId: String) { marked.append(documentId) }
    func notifyTabRemoved(documentId: String) { removed.append(documentId) }
    func reset() {
        marked = []
        removed = []
    }
}

@Suite("Dirty notification — user mutations mark the workspace dirty")
struct DirtyNotifierTests {

    @Test("a committed stroke, undo, and a layer edit each mark their document dirty")
    func documentEditsMarkDirty() {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)
        let tab = workspace.activeTab

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        #expect(notifier.marked.contains(tab.documentId))

        notifier.reset()
        tab.handleUndo()
        #expect(notifier.marked.contains(tab.documentId))

        notifier.reset()
        tab.addLayer()
        #expect(notifier.marked.contains(tab.documentId))
    }

    @Test("persisted presentation state — panel collapse, grid, zoom — marks the tab dirty")
    func presentationMutationsMarkDirty() {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)
        let tab = workspace.activeTab
        workspace.presentActiveTab(in: ViewportSize(width: 800, height: 600))
        notifier.reset()

        tab.toggleTimelinePanel()
        #expect(notifier.marked.contains(tab.documentId))

        notifier.reset()
        tab.toggleGrid()
        #expect(notifier.marked.contains(tab.documentId))

        notifier.reset()
        tab.handleZoomIn()
        #expect(notifier.marked.contains(tab.documentId))
    }

    @Test("shared-state mutations mark the active tab dirty, including direct view assignments")
    func sharedMutationsMarkDirty() {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)
        let doc = workspace.activeTab.documentId

        // The view layer assigns shared slots directly (RightPanel's color
        // wells, TopBar's pixel-perfect toggle) — marking must not depend on
        // routing through a workspace method.
        workspace.shared.foregroundColor = Color(r: 9, g: 9, b: 9, a: 255)
        #expect(notifier.marked.contains(doc))

        notifier.reset()
        workspace.shared.pixelPerfect.toggle()
        #expect(notifier.marked.contains(doc))

        notifier.reset()
        workspace.activateTool(.eraser)
        #expect(notifier.marked.contains(doc))

        notifier.reset()
        workspace.swapColors()
        #expect(notifier.marked.contains(doc))
    }

    @Test("tab lifecycle: adding marks the new document, closing notifies removal, switching marks")
    func tabLifecycleNotifies() {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)

        let added = workspace.addTab()
        #expect(notifier.marked.contains(added.documentId))

        notifier.reset()
        workspace.setActiveTab(0)
        #expect(!notifier.marked.isEmpty)

        notifier.reset()
        workspace.closeTab(1)
        #expect(notifier.removed == [added.documentId])
    }

    @Test("restoring a workspace from a snapshot marks nothing dirty")
    func restoreMarksNothing() throws {
        let source = Workspace(width: 4, height: 4)
        source.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        source.activeTab.endStroke()
        source.addTab()
        let snapshot = source.toSnapshot()

        let notifier = RecordingNotifier()
        let restored = try Workspace(restoring: snapshot, notifier: notifier)

        #expect(restored.tabs.count == 2)
        #expect(notifier.marked.isEmpty)
        #expect(notifier.removed.isEmpty)
    }
}
