import Foundation
import SwiftData
import Testing
@testable import Dotorixel

/// A `SaveFlow` wired to a real in-memory store — the flow-model analog of
/// the persistence suite's fixture. `flush` persists the live workspace the
/// way the production `AutoSave.flush` does, minus the debounce.
@MainActor
private func makeFlowFixture(
    width: UInt32 = 4, height: UInt32 = 4
) throws -> (flow: SaveFlow, workspace: Workspace, persistence: SessionPersistence) {
    let container = try ModelContainer(
        for: DocumentRecord.self, WorkspaceRecord.self,
        configurations: ModelConfiguration(isStoredInMemoryOnly: true)
    )
    let persistence = SessionPersistence(modelContainer: container)
    let workspace = Workspace(width: width, height: height)
    let flow = SaveFlow(
        workspace: workspace,
        persistence: persistence,
        flush: { try? await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil) }
    )
    return (flow, workspace, persistence)
}

@Suite("SaveFlow — close-tab decision")
@MainActor
struct SaveFlowCloseDecisionTests {

    @Test("closing a tab whose document is saved closes immediately, no dialog")
    func savedDocumentClosesWithoutDialog() async throws {
        let (flow, workspace, persistence) = try makeFlowFixture()

        let tab = workspace.addTab()
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        try await persistence.saveDocumentAs(id: tab.documentId, name: "Kept")

        await flow.requestCloseTab(1)

        #expect(flow.pendingSave == nil)
        #expect(workspace.tabs.count == 1)
        // The saved record is still in the store for the browser.
        #expect(await persistence.isDocumentSaved(id: tab.documentId))
    }

    @Test("closing a blank unsaved tab closes immediately — nothing worth keeping")
    func blankUnsavedDocumentClosesWithoutDialog() async throws {
        let (flow, workspace, persistence) = try makeFlowFixture()

        workspace.addTab()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        await flow.requestCloseTab(1)

        #expect(flow.pendingSave == nil)
        #expect(workspace.tabs.count == 1)
    }

    @Test("closing a painted unsaved tab presents the save dialog, name prefilled from the tab")
    func paintedUnsavedDocumentPresentsDialog() async throws {
        let (flow, workspace, _) = try makeFlowFixture()

        let tab = workspace.addTab()
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()

        await flow.requestCloseTab(1)

        #expect(flow.pendingSave == SaveFlow.PendingSave(tabIndex: 1, documentName: tab.name))
        // Nothing closes until the user chooses.
        #expect(workspace.tabs.count == 2)
    }
}

@Suite("SaveFlow — save dialog resolution")
@MainActor
struct SaveFlowDialogResolutionTests {

    /// A fixture whose second tab is painted, unsaved, and awaiting the
    /// dialog's choice.
    @MainActor
    private func makePendingFixture() async throws
        -> (flow: SaveFlow, workspace: Workspace, persistence: SessionPersistence, docId: String) {
        let (flow, workspace, persistence) = try makeFlowFixture()
        let tab = workspace.addTab()
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.endStroke()
        // The document has a stored (auto-saved) record before the dialog —
        // the delete branch must actually remove it.
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        await flow.requestCloseTab(1)
        return (flow, workspace, persistence, tab.documentId)
    }

    @Test("save marks the document saved under the entered name and closes the tab")
    func saveKeepsDocumentAndClosesTab() async throws {
        let (flow, workspace, persistence, docId) = try await makePendingFixture()

        await flow.confirmSave(name: "My Sprite")

        #expect(flow.pendingSave == nil)
        #expect(workspace.tabs.count == 1)
        #expect(await persistence.isDocumentSaved(id: docId))
        #expect(await persistence.savedDocumentSummaries().map(\.name) == ["My Sprite"])
    }

    @Test("delete closes the tab and drops the document from the store")
    func deleteClosesTabAndDropsDocument() async throws {
        let (flow, workspace, persistence, docId) = try await makePendingFixture()

        await flow.confirmDelete()

        #expect(flow.pendingSave == nil)
        #expect(workspace.tabs.count == 1)
        #expect(await persistence.documentUpdatedAt(id: docId) == nil)
    }

    @Test("cancel dismisses the dialog leaving the tab and store untouched")
    func cancelLeavesEverythingUntouched() async throws {
        let (flow, workspace, persistence, docId) = try await makePendingFixture()

        flow.cancelSave()

        #expect(flow.pendingSave == nil)
        #expect(workspace.tabs.count == 2)
        #expect(await persistence.isDocumentSaved(id: docId) == false)
    }
}

@Suite("SaveFlow — saved work browser")
@MainActor
struct SaveFlowBrowserTests {

    /// A fixture with one saved-and-closed document ("Stored") and one saved
    /// document still open in a tab ("Open").
    @MainActor
    private func makeBrowserFixture() async throws
        -> (flow: SaveFlow, workspace: Workspace, persistence: SessionPersistence, storedId: String) {
        let (flow, workspace, persistence) = try makeFlowFixture()

        let stored = workspace.addTab()
        stored.beginStroke(at: ScreenCanvasCoords(x: 2, y: 1))
        stored.endStroke()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        try await persistence.saveDocumentAs(id: stored.documentId, name: "Stored")
        try await persistence.saveDocumentAs(id: workspace.tabs[0].documentId, name: "Open")
        workspace.closeTab(1)
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        return (flow, workspace, persistence, stored.documentId)
    }

    @Test("openBrowser lists saved documents, excluding those open in a tab")
    func openBrowserExcludesOpenTabs() async throws {
        let (flow, _, _, storedId) = try await makeBrowserFixture()

        await flow.openBrowser()

        #expect(flow.browserDocuments?.map(\.id) == [storedId])
    }

    @Test("selecting a document opens it in a new active tab and closes the browser")
    func selectOpensDocumentAndClosesBrowser() async throws {
        let (flow, workspace, _, storedId) = try await makeBrowserFixture()
        await flow.openBrowser()

        await flow.selectSavedDocument(id: storedId)

        #expect(flow.browserDocuments == nil)
        #expect(workspace.tabs.count == 2)
        #expect(workspace.activeTab.documentId == storedId)
        #expect(try workspace.activeTab.document.getPixel(x: 2, y: 1)
            == workspace.shared.foregroundColor)
    }

    @Test("deleting from the browser removes the document from the store and the list")
    func deleteRemovesDocumentFromStoreAndList() async throws {
        let (flow, _, persistence, storedId) = try await makeBrowserFixture()
        await flow.openBrowser()

        await flow.deleteSavedDocument(id: storedId)

        #expect(flow.browserDocuments?.isEmpty == true)
        #expect(await persistence.documentUpdatedAt(id: storedId) == nil)
    }

    @Test("selecting a document whose record vanished drops it from the list, browser stays open")
    func selectVanishedDocumentDropsListEntry() async throws {
        let (flow, workspace, persistence, storedId) = try await makeBrowserFixture()
        await flow.openBrowser()
        // Vanishes behind the presented list (e.g. another window deleted it).
        try await persistence.deleteDocument(id: storedId)

        await flow.selectSavedDocument(id: storedId)

        #expect(flow.browserDocuments?.isEmpty == true)
        #expect(workspace.tabs.count == 1)
    }
}
