import Foundation
import SwiftData
import Testing
@testable import Dotorixel

/// An in-memory store per test — the SwiftData analog of the web's fake
/// storage in `session-persistence.test.ts`.
private func makeInMemoryPersistence() throws -> SessionPersistence {
    let container = try ModelContainer(
        for: DocumentRecord.self, WorkspaceRecord.self,
        configurations: ModelConfiguration(isStoredInMemoryOnly: true)
    )
    return SessionPersistence(modelContainer: container)
}

@Suite("SessionPersistence — SwiftData store round-trip")
@MainActor
struct SessionPersistenceTests {

    @Test("a saved workspace snapshot restores equal: tabs, documents, shared state, viewports")
    func savedSnapshotRestoresEqual() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        let first = workspace.activeTab
        first.beginStroke(at: ScreenCanvasCoords(x: 1, y: 2))
        first.endStroke()
        first.addLayer()
        first.toggleTimelinePanel()
        workspace.addTab()
        workspace.shared.activeTool = .eraser
        workspace.shared.pixelPerfect = false
        workspace.setActiveTab(0)
        let snapshot = workspace.toSnapshot()

        try await persistence.save(snapshot, dirtyDocIds: nil)
        let restored = try #require(await persistence.restore())

        #expect(restored.tabs.map(\.id) == snapshot.tabs.map(\.id))
        #expect(restored.tabs.map(\.name) == snapshot.tabs.map(\.name))
        #expect(restored.activeTabIndex == 0)

        let restoredFirst = restored.tabs[0]
        let originalFirst = snapshot.tabs[0]
        #expect(restoredFirst.width == 4)
        #expect(restoredFirst.height == 4)
        #expect(restoredFirst.layers == originalFirst.layers)
        #expect(restoredFirst.activeLayerId == originalFirst.activeLayerId)
        #expect(restoredFirst.nextLayerNumber == originalFirst.nextLayerNumber)
        #expect(restoredFirst.timelinePanelCollapsed)
        #expect(restoredFirst.viewport == originalFirst.viewport)

        #expect(restored.sharedState.activeTool == .eraser)
        #expect(!restored.sharedState.pixelPerfect)
        #expect(restored.sharedState.foregroundColor == snapshot.sharedState.foregroundColor)
        #expect(restored.sharedState.backgroundColor == snapshot.sharedState.backgroundColor)
        #expect(restored.sharedState.recentColors == snapshot.sharedState.recentColors)
    }

    @Test("an empty store restores nil — the caller falls back to a fresh session")
    func emptyStoreRestoresNil() async throws {
        let persistence = try makeInMemoryPersistence()

        #expect(await persistence.restore() == nil)
    }

    @Test("a workspace record referencing a missing document restores nil, not a crash")
    func missingDocumentRestoresNil() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        // Corrupt the store: drop the document record the workspace's tab
        // order references.
        try await persistence.deleteDocument(id: workspace.activeTab.documentId)

        #expect(await persistence.restore() == nil)
    }

    @Test("a save naming dirty documents rewrites only those; clean documents keep their stored record")
    func dirtySaveSkipsCleanDocuments() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        let cleanId = workspace.activeTab.documentId
        let dirtyTab = workspace.addTab()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        let cleanFirstStored = try #require(await persistence.documentUpdatedAt(id: cleanId))
        let dirtyFirstStored = try #require(
            await persistence.documentUpdatedAt(id: dirtyTab.documentId))

        dirtyTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        dirtyTab.endStroke()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: [dirtyTab.documentId])

        // The clean document was not rewritten (timestamp byte-identical to
        // the first save's); the dirty one was (timestamp strictly newer).
        #expect(await persistence.documentUpdatedAt(id: cleanId) == cleanFirstStored)
        #expect(try #require(
            await persistence.documentUpdatedAt(id: dirtyTab.documentId)) > dirtyFirstStored)
    }

    @Test("a document with no stored record is written even when the dirty set omits it")
    func unstoredDocumentIsWrittenDespiteCleanDirtySet() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        let tabA = workspace.activeTab
        let tabB = workspace.addTab()
        // First save of a fresh session with only the new tab dirty — the
        // never-stored first tab must be written anyway, or the stored tab
        // order references a document that does not exist and the whole
        // session is discarded on restore.
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: [tabB.documentId])

        let restored = try #require(await persistence.restore())
        #expect(restored.tabs.map(\.id) == [tabA.documentId, tabB.documentId])
    }

    @Test("a record with an out-of-range stored number restores nil instead of trapping")
    func corruptNumericRecordRestoresNil() async throws {
        let container = try ModelContainer(
            for: DocumentRecord.self, WorkspaceRecord.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        let persistence = SessionPersistence(modelContainer: container)
        let workspace = Workspace(width: 4, height: 4)
        let docId = workspace.activeTab.documentId
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // Corrupt the stored width behind the persistence API — the store is
        // an external input, and a negative width must fail the restore, not
        // trap the UInt32 conversion.
        let context = ModelContext(container)
        let record = try #require(try context.fetch(
            FetchDescriptor<DocumentRecord>(predicate: #Predicate { $0.id == docId })
        ).first)
        record.width = -1
        try context.save()

        #expect(await persistence.restore() == nil)
    }

    @Test("a corrupt stored viewport restores as the default viewport, not a discarded session")
    func corruptViewportFallsBackToDefault() async throws {
        let container = try ModelContainer(
            for: DocumentRecord.self, WorkspaceRecord.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        let persistence = SessionPersistence(modelContainer: container)
        let workspace = Workspace(width: 4, height: 4)
        let docId = workspace.activeTab.documentId
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // A negative pixel size is the corrupt-value shape SwiftData can
        // actually store (NaN fails its own JSON encoding before reaching
        // disk); it exercises the same validation fallback.
        let context = ModelContext(container)
        let record = try #require(try context.fetch(
            FetchDescriptor<WorkspaceRecord>()
        ).first)
        var viewports = record.viewports
        viewports[docId]?.pixelSize = -5
        record.viewports = viewports
        try context.save()

        // One corrupt viewport must not cost the session its documents: the
        // tab restores with the default viewport.
        let restored = try #require(await persistence.restore())
        #expect(restored.tabs[0].viewport ==
            TabViewportSnapshot(pixelSize: 32, zoom: 1.0, panX: 0, panY: 0, showGrid: true))
    }

    @Test("saveDocumentAs marks the document saved under the chosen name")
    func saveDocumentAsMarksSaved() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        let docId = workspace.activeTab.documentId
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        #expect(await persistence.isDocumentSaved(id: docId) == false)

        try await persistence.saveDocumentAs(id: docId, name: "My Sprite")

        #expect(await persistence.isDocumentSaved(id: docId))
    }

    @Test("a saved document survives closing its tab: the record outlives the next session save")
    func savedDocumentSurvivesTabClose() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        let keptId = workspace.addTab().documentId
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        try await persistence.saveDocumentAs(id: keptId, name: "Kept")

        workspace.closeTab(1)
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // The restored session no longer includes the closed tab, but the
        // saved record is still in the store for the browser to list.
        let restored = try #require(await persistence.restore())
        #expect(restored.tabs.map(\.id) == [workspace.activeTab.documentId])
        #expect(await persistence.isDocumentSaved(id: keptId))
    }

    @Test("savedDocumentSummaries lists only saved documents, most recently updated first")
    func summariesListSavedDocumentsMostRecentFirst() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        let newestId = workspace.activeTab.documentId
        let olderId = workspace.addTab().documentId
        workspace.addTab() // stays unsaved — must not appear
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // A newer content save bumps `updatedAt` — the first tab becomes the
        // most recently updated regardless of save order below.
        let newestTab = workspace.tabs[0]
        newestTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        newestTab.endStroke()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: [newestId])

        try await persistence.saveDocumentAs(id: olderId, name: "Older")
        try await persistence.saveDocumentAs(id: newestId, name: "Newest")

        let summaries = await persistence.savedDocumentSummaries()

        #expect(summaries.map(\.id) == [newestId, olderId])
        #expect(summaries.map(\.name) == ["Newest", "Older"])
        #expect(summaries[0].width == 4)
        #expect(summaries[0].height == 4)
        // The thumbnail composite covers the canvas and carries the stroke's
        // painted pixel (RGBA at (1,1) is non-zero).
        let pixels = summaries[0].pixels
        #expect(pixels.count == 4 * 4 * 4)
        #expect(pixels[(1 * 4 + 1) * 4 + 3] != 0)
    }

    @Test("savedDocumentSnapshot returns the saved content with a reset viewport; nil for unsaved")
    func savedDocumentSnapshotResetsViewportAndGuardsUnsaved() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 3))
        tab.endStroke()
        tab.handleZoomIn() // drift the live viewport away from the default
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // Unsaved: not openable from the browser.
        #expect(await persistence.savedDocumentSnapshot(id: tab.documentId) == nil)

        try await persistence.saveDocumentAs(id: tab.documentId, name: "Kept")
        let snapshot = try #require(await persistence.savedDocumentSnapshot(id: tab.documentId))

        #expect(snapshot.id == tab.documentId)
        #expect(snapshot.layers == workspace.toSnapshot().tabs[0].layers)
        // Reopening resets the view (web parity: `DEFAULT_VIEWPORT`).
        #expect(snapshot.viewport ==
            TabViewportSnapshot(pixelSize: 32, zoom: 1.0, panX: 0, panY: 0, showGrid: true))
    }

    @Test("closing a tab deletes its unsaved document from the store on the next save")
    func closedTabsUnsavedDocumentIsDeleted() async throws {
        let persistence = try makeInMemoryPersistence()

        let workspace = Workspace(width: 4, height: 4)
        let closedId = workspace.addTab().documentId
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        workspace.closeTab(1)
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        let restored = try #require(await persistence.restore())
        #expect(restored.tabs.map(\.id) == [workspace.activeTab.documentId])
        #expect(await persistence.documentUpdatedAt(id: closedId) == nil)
    }
}
