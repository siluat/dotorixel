import Foundation
import Testing
@testable import Dotorixel

/// Records dirty marks and tab removals — the test adapter for the
/// `DirtyNotifier` port (web parity: `createFakeDirtyNotifier`).
private final class RecordingNotifier: DirtyNotifier {
    private(set) var marked: [String] = []
    private(set) var workspaceMarks = 0
    private(set) var removed: [String] = []

    func markDirty(documentId: String) { marked.append(documentId) }
    func markWorkspaceDirty() { workspaceMarks += 1 }
    func notifyTabRemoved(documentId: String) { removed.append(documentId) }
    func reset() {
        marked = []
        workspaceMarks = 0
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

    @Test("switching the active frame marks the document dirty; the no-op guards mark nothing")
    func activeFrameSwitchMarksDirty() throws {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)
        let tab = workspace.activeTab
        let first = tab.activeFrameId
        tab.addFrame() // the new second frame becomes active
        notifier.reset()

        // The active-frame pointer is persisted document state since 292 —
        // a switch alone must reach the store (raised by greptile-apps and
        // cubic-dev-ai on PR #381).
        tab.setActiveFrame(id: first)
        #expect(notifier.marked.contains(tab.documentId))

        // Rejected switches change no saved state, so they mark nothing.
        notifier.reset()
        tab.setActiveFrame(id: first) // already active
        tab.setActiveFrame(id: makeFrameId()) // unknown id
        #expect(notifier.marked.isEmpty)
    }

    @Test("defining, deselecting, and committing a moved Marquee mark the document dirty")
    func marqueeMutationsMarkDirty() {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 8, height: 8, notifier: notifier)
        let tab = workspace.activeTab
        workspace.activateTool(.selection)
        notifier.reset()

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()
        #expect(notifier.marked.contains(tab.documentId))

        notifier.reset()
        tab.beginStroke(at: ScreenCanvasCoords(x: 6, y: 6))
        tab.endStroke()
        #expect(notifier.marked.contains(tab.documentId))

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()
        notifier.reset()

        tab.nudgeMarquee(by: FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(notifier.marked.isEmpty)
        workspace.activateTool(.pencil)
        #expect(notifier.marked.contains(tab.documentId))
    }

    @Test("shared-state mutations mark the workspace dirty without naming a document")
    func sharedMutationsMarkWorkspaceDirty() {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)

        // The view layer assigns shared slots directly (RightPanel's color
        // wells, TopBar's pixel-perfect toggle) — marking must not depend on
        // routing through a workspace method. Shared slots live in the
        // workspace record, so no document is named: naming one would
        // rewrite its layers for an edit that never touched it.
        workspace.shared.foregroundColor = Color(r: 9, g: 9, b: 9, a: 255)
        #expect(notifier.workspaceMarks == 1)
        #expect(notifier.marked.isEmpty)

        notifier.reset()
        workspace.shared.pixelPerfect.toggle()
        #expect(notifier.workspaceMarks == 1)

        notifier.reset()
        workspace.activateTool(.eraser)
        #expect(notifier.workspaceMarks == 1)

        notifier.reset()
        workspace.swapColors()
        #expect(notifier.workspaceMarks == 2)
        #expect(notifier.marked.isEmpty)
    }

    @Test("tab lifecycle: adding marks the new document, closing notifies removal, switching marks")
    func tabLifecycleNotifies() {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)

        let added = workspace.addTab()
        #expect(notifier.marked.contains(added.documentId))

        notifier.reset()
        workspace.setActiveTab(0)
        // A switch changes only the persisted active index — exactly one
        // workspace mark, no document named.
        #expect(notifier.workspaceMarks == 1)
        #expect(notifier.marked.isEmpty)

        notifier.reset()
        workspace.closeTab(1)
        #expect(notifier.removed == [added.documentId])
    }

    @Test("reference mutations — import, placement, visibility, delete — each mark their document dirty")
    func referenceMutationsMarkDirty() throws {
        let notifier = RecordingNotifier()
        let workspace = Workspace(width: 4, height: 4, notifier: notifier)
        let tab = workspace.activeTab
        notifier.reset()

        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png", rgba: Data([0xFF, 0, 0, 0xFF]), width: 1, height: 1))
        #expect(notifier.marked.contains(tab.documentId))
        let referenceId = tab.document.activeLayerId()

        notifier.reset()
        tab.setReferencePlacement(AppleReferencePlacementUpdate(x: 2, y: 2, scale: 1))
        #expect(notifier.marked.contains(tab.documentId))

        notifier.reset()
        tab.setLayerVisibility(id: referenceId, visible: false)
        #expect(notifier.marked.contains(tab.documentId))

        notifier.reset()
        tab.removeLayer(id: referenceId)
        #expect(notifier.marked.contains(tab.documentId))
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
        #expect(notifier.workspaceMarks == 0)
        #expect(notifier.removed.isEmpty)
    }
}
