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

@Suite("Workspace — tab lifecycle")
struct WorkspaceTabLifecycleTests {

    @Test("addTab appends a fresh default-size document tab and makes it active")
    func addTabAppendsAndActivates() {
        let workspace = Workspace(width: 32, height: 24)

        let tab = workspace.addTab()

        #expect(workspace.tabs.count == 2)
        #expect(workspace.activeTab === tab)
        // Web parity: fresh tabs take the lowest unused "Untitled N".
        #expect(tab.name == "Untitled 2")
        // A fresh tab is default-sized, not a copy of the first tab's size.
        #expect(tab.document.width() == 16)
        #expect(tab.document.height() == 16)
        #expect(tab.shared === workspace.shared)
    }

    @Test("setActiveTab switches tabs; documents and history stay per-tab")
    func setActiveTabSwitchesAndIsolatesHistory() throws {
        let workspace = Workspace()
        let tabA = workspace.activeTab
        tabA.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tabA.endStroke()

        let tabB = workspace.addTab()
        #expect(workspace.activeTab === tabB)
        #expect(tabB.document.composite().allSatisfy { $0 == 0 })

        // Undo on B has nothing to undo and must never reach A's history.
        #expect(!tabB.canUndo)
        tabB.handleUndo()
        #expect(try tabA.document.getPixel(x: 2, y: 2) == workspace.shared.foregroundColor)

        workspace.setActiveTab(0)
        #expect(workspace.activeTab === tabA)
        #expect(tabA.canUndo)
    }

    @Test("activating another tab commits the outgoing tab's in-flight stroke")
    func activationResolvesInFlightStroke() throws {
        let workspace = Workspace()
        let tabA = workspace.activeTab
        workspace.addTab()
        workspace.setActiveTab(0)

        tabA.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        workspace.setActiveTab(1)

        // The switch resolved the stroke: drawn pixels stay, the undo entry
        // is sealed, and A is no longer mid-stroke.
        #expect(!tabA.isDrawing)
        #expect(tabA.canUndo)
        #expect(try tabA.document.getPixel(x: 1, y: 1) == workspace.shared.foregroundColor)
    }

    @Test("addTab commits the outgoing tab's in-flight stroke before activating the new tab")
    func addTabResolvesInFlightStroke() {
        let workspace = Workspace()
        let tabA = workspace.activeTab

        tabA.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        workspace.addTab()

        #expect(!tabA.isDrawing)
        #expect(tabA.canUndo)
    }

    @Test("closing the active tab activates its right neighbor, or the new last tab at the end")
    func closeActiveTabActivatesNeighbor() {
        let workspace = Workspace()
        let tabA = workspace.activeTab
        let tabB = workspace.addTab()
        let tabC = workspace.addTab()

        // Close the middle, active tab: the right neighbor takes its index.
        workspace.setActiveTab(1)
        workspace.closeTab(1)
        #expect(workspace.tabs.count == 2)
        #expect(workspace.activeTab === tabC)
        #expect(!workspace.tabs.contains(where: { $0 === tabB }))

        // Close the last, active tab: activation clamps to the new last tab.
        workspace.closeTab(1)
        #expect(workspace.activeTab === tabA)
    }

    @Test("closing a tab before the active one keeps the same tab active")
    func closeTabBeforeActiveKeepsActiveTab() {
        let workspace = Workspace()
        workspace.addTab()
        let tabC = workspace.addTab()

        workspace.closeTab(0)

        #expect(workspace.activeTab === tabC)
    }

    @Test("the sole remaining tab cannot be closed")
    func soleTabCannotBeClosed() {
        let workspace = Workspace()
        let onlyTab = workspace.activeTab
        #expect(!workspace.canCloseTab)

        workspace.closeTab(0)

        #expect(workspace.tabs.count == 1)
        #expect(workspace.activeTab === onlyTab)

        workspace.addTab()
        #expect(workspace.canCloseTab)
    }

    @Test("a closed tab's Untitled number is freed and reused by the next addTab")
    func closedTabNumberIsReused() {
        let workspace = Workspace()
        workspace.addTab()
        workspace.addTab()

        // Close "Untitled 2": the middle number frees up.
        workspace.closeTab(1)

        #expect(workspace.addTab().name == "Untitled 2")
        // The gap is filled again, so the next tab takes the next number up.
        #expect(workspace.addTab().name == "Untitled 4")
    }
}

@Suite("Workspace — canvas presentation")
struct WorkspaceCanvasPresentationTests {

    private let squareArea = ViewportSize(width: 1024, height: 1024)

    @Test("the first presentation fits and centers the canvas in the area")
    func firstPresentationFits() {
        let workspace = Workspace()

        workspace.presentActiveTab(in: squareArea)

        // A fresh 16×16 tab renders 32-device-pixel cells (512px canvas);
        // fitted into a 1024px square it doubles the zoom and centers with
        // zero margin on both axes.
        #expect(workspace.activeTab.viewport.zoom() == 2.0)
        #expect(workspace.activeTab.viewport.panX() == 0.0)
        #expect(workspace.activeTab.viewport.panY() == 0.0)
    }

    @Test("an area size change preserves a presented tab's zoom (Timeline collapse, window resize)")
    func areaSizeChangePreservesZoom() {
        let workspace = Workspace()
        workspace.presentActiveTab(in: squareArea)
        // The user zooms in; a Timeline collapse then resizes the area.
        workspace.activeTab.handleZoomIn()
        let chosenZoom = workspace.activeTab.viewport.zoom()
        #expect(chosenZoom > 2.0)

        workspace.presentActiveTab(in: ViewportSize(width: 1024, height: 800))

        #expect(workspace.activeTab.viewport.zoom() == chosenZoom)
        #expect(workspace.activeTab.viewportSize.height == 800)
    }

    @Test("switching fits only a tab not yet presented; a revisited tab keeps its viewport")
    func switchingFitsOnlyUnseenTabs() {
        let workspace = Workspace()
        workspace.presentActiveTab(in: squareArea)
        workspace.activeTab.handleZoomIn()
        let firstTabZoom = workspace.activeTab.viewport.zoom()

        workspace.addTab()
        workspace.presentActiveTab(in: squareArea)
        // The fresh tab gets its own first fit...
        #expect(workspace.activeTab.viewport.zoom() == 2.0)

        workspace.setActiveTab(0)
        workspace.presentActiveTab(in: squareArea)
        // ...while the revisited tab keeps the zoom the user chose.
        #expect(workspace.activeTab.viewport.zoom() == firstTabZoom)
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
