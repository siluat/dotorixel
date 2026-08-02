import Testing
@testable import Dotorixel

@Suite("Workspace — ownership boundaries")
struct WorkspaceOwnershipTests {

    @Test("a new workspace opens with a single tab holding the requested document")
    func newWorkspaceOpensWithSingleTab() {
        let workspace = Workspace(width: 16, height: 12)

        #expect(workspace.tabs.count == 1)
        #expect(workspace.activeTab.document.width() == 16)
        #expect(workspace.activeTab.document.height() == 12)
    }

    @Test("shared state defaults match the web editor")
    func sharedStateDefaultsMatchWeb() {
        let workspace = Workspace(width: 16, height: 16)

        #expect(workspace.shared.activeTool == .pencil)
        #expect(workspace.shared.foregroundColor == Color(r: 0x00, g: 0x00, b: 0x00, a: 0xFF))
        #expect(workspace.shared.backgroundColor == Color(r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF))
        #expect(workspace.shared.recentColors.isEmpty)
        #expect(workspace.shared.pixelPerfect)
    }

    @Test("every tab references the workspace's shared state")
    func tabsReferenceWorkspaceSharedState() {
        let workspace = Workspace(width: 16, height: 16)

        #expect(workspace.activeTab.shared === workspace.shared)
    }
}

@Suite("TabState — per-tab document state")
struct TabStatePerTabTests {

    @Test("a stroke on the active tab draws the shared foreground color; undo and redo restore per-tab history")
    func strokeDrawsSharedForegroundAndIsUndoablePerTab() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab

        tab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 4))
        tab.endStroke()
        #expect(try tab.document.getPixel(x: 3, y: 4) == workspace.shared.foregroundColor)

        tab.handleUndo()
        #expect(tab.document.composite().allSatisfy { $0 == 0 })

        tab.handleRedo()
        #expect(try tab.document.getPixel(x: 3, y: 4) == workspace.shared.foregroundColor)
    }

    @Test("a new tab carries a display name and a unique document identity")
    func newTabCarriesNameAndIdentity() {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab

        // Web parity: fresh tabs are named "Untitled N".
        #expect(tab.name == "Untitled 1")
        #expect(!tab.documentId.isEmpty)
        // Two independently created workspaces must never share a document id.
        let otherTab = Workspace(width: 16, height: 16).activeTab
        #expect(tab.documentId != otherTab.documentId)
    }

    @Test("the Timeline panel collapse flag is tab-scoped and toggles from the tab")
    func timelinePanelCollapseIsTabScoped() {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab

        #expect(!tab.isTimelinePanelCollapsed)
        tab.toggleTimelinePanel()
        #expect(tab.isTimelinePanelCollapsed)
        tab.toggleTimelinePanel()
        #expect(!tab.isTimelinePanelCollapsed)
    }
}

@Suite("Workspace — keyboard host & tool activation")
struct WorkspaceInputTests {

    @Test("keyboard undo dispatches through the workspace host into the active tab's history")
    func keyboardUndoDispatchesToActiveTab() {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab

        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        #expect(tab.canUndo)

        workspace.keyboardShortcuts.handleKeyDown("z", modifiers: [.command])

        #expect(!tab.canUndo)
        #expect(tab.document.composite().allSatisfy { $0 == 0 })
    }

    @Test("the G shortcut toggles the active tab's grid")
    func gridShortcutTogglesActiveTabGrid() {
        let workspace = Workspace(width: 16, height: 16)

        #expect(workspace.activeTab.showGrid)
        workspace.keyboardShortcuts.handleKeyDown("g")
        #expect(!workspace.activeTab.showGrid)
    }

    @Test("re-activating the active constrainable tool from the toolbar toggles the Constrain latch")
    func reactivatingConstrainableToolTogglesLatch() {
        let workspace = Workspace(width: 16, height: 16)
        workspace.shared.activeTool = .line

        workspace.activateTool(.line)
        #expect(workspace.isConstrainLatchOn)
        #expect(workspace.shared.activeTool == .line)

        workspace.activateTool(.pencil)
        #expect(workspace.shared.activeTool == .pencil)
        // Selecting a different tool leaves the latch untouched (web parity).
        #expect(workspace.isConstrainLatchOn)
    }

    @Test("swapColors exchanges the shared foreground and background")
    func swapColorsExchangesSharedSlots() {
        let workspace = Workspace(width: 16, height: 16)
        let fg = workspace.shared.foregroundColor
        let bg = workspace.shared.backgroundColor

        workspace.swapColors()

        #expect(workspace.shared.foregroundColor == bg)
        #expect(workspace.shared.backgroundColor == fg)
    }
}
