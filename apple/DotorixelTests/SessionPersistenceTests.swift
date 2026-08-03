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
        let storedUpdatedAt = try #require(await persistence.documentUpdatedAt(id: cleanId))

        dirtyTab.beginStroke(at: ScreenCanvasCoords(x: 0, y: 0))
        dirtyTab.endStroke()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: [dirtyTab.documentId])

        // The clean document was not rewritten: its stored timestamp is
        // byte-identical to the first save's.
        #expect(await persistence.documentUpdatedAt(id: cleanId) == storedUpdatedAt)
        #expect(try #require(await persistence.documentUpdatedAt(id: dirtyTab.documentId)) >= storedUpdatedAt)
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
