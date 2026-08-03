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
