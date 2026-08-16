import Foundation
import SwiftData
import Testing
@testable import Dotorixel

/// An in-memory store per test — the SwiftData analog of the web's fake
/// storage in `session-persistence.test.ts`.
private func makeInMemoryContainer() throws -> ModelContainer {
    try ModelContainer(
        for: DocumentRecord.self, WorkspaceRecord.self,
        configurations: ModelConfiguration(isStoredInMemoryOnly: true)
    )
}

private func makeInMemoryPersistence() throws -> SessionPersistence {
    SessionPersistence(modelContainer: try makeInMemoryContainer())
}

/// The exact pre-Marquee store shape. Keeping this as a separate SwiftData
/// schema lets the migration test write a real legacy SQLite store rather
/// than approximating one with a current `DocumentRecord(marquee: nil)`.
private enum LegacySessionSchema: VersionedSchema {
    static let versionIdentifier = Schema.Version(1, 0, 0)
    static let models: [any PersistentModel.Type] = [
        DocumentRecord.self,
        WorkspaceRecord.self,
    ]

    @Model
    final class DocumentRecord {
        @Attribute(.unique) var id: String
        var name: String
        var width: Int
        var height: Int
        var layers: [StoredLayer]
        var activeLayerId: String
        var nextLayerNumber: Int
        var timelinePanelCollapsed: Bool
        var saved: Bool
        var createdAt: Date
        var updatedAt: Date

        init(from tab: TabSnapshot, at now: Date) {
            id = tab.id
            name = tab.name
            width = Int(tab.width)
            height = Int(tab.height)
            layers = tab.layers.map {
                StoredLayer(
                    id: $0.id,
                    name: $0.name,
                    visible: $0.visible,
                    opacity: $0.opacity,
                    pixels: $0.pixels
                )
            }
            activeLayerId = tab.activeLayerId
            nextLayerNumber = Int(tab.nextLayerNumber)
            timelinePanelCollapsed = tab.timelinePanelCollapsed
            saved = false
            createdAt = now
            updatedAt = now
        }
    }

    @Model
    final class WorkspaceRecord {
        @Attribute(.unique) var id: String
        var tabOrder: [String]
        var activeTabIndex: Int
        var sharedState: StoredSharedState
        var viewports: [String: StoredViewport]

        init(from snapshot: WorkspaceSnapshot) {
            id = "current"
            tabOrder = snapshot.tabs.map(\.id)
            activeTabIndex = snapshot.activeTabIndex
            sharedState = StoredSharedState(
                activeTool: snapshot.sharedState.activeTool.rawValue,
                foregroundColor: StoredColor(snapshot.sharedState.foregroundColor),
                backgroundColor: StoredColor(snapshot.sharedState.backgroundColor),
                recentColors: snapshot.sharedState.recentColors.map(StoredColor.init),
                pixelPerfect: snapshot.sharedState.pixelPerfect
            )
            viewports = Dictionary(uniqueKeysWithValues: snapshot.tabs.map { tab in
                (tab.id, StoredViewport(
                    pixelSize: Int(tab.viewport.pixelSize),
                    zoom: tab.viewport.zoom,
                    panX: tab.viewport.panX,
                    panY: tab.viewport.panY,
                    showGrid: tab.viewport.showGrid
                ))
            })
        }
    }
}

private extension StoredColor {
    init(_ color: Color) {
        self.init(r: color.r, g: color.g, b: color.b, a: color.a)
    }
}

private func writeLegacyStore(_ snapshot: WorkspaceSnapshot, to url: URL) throws {
    let schema = Schema(versionedSchema: LegacySessionSchema.self)
    let configuration = ModelConfiguration(
        schema: schema,
        url: url,
        cloudKitDatabase: .none
    )
    let container = try ModelContainer(for: schema, configurations: configuration)
    let context = ModelContext(container)
    let now = Date()
    snapshot.tabs.forEach {
        context.insert(LegacySessionSchema.DocumentRecord(from: $0, at: now))
    }
    context.insert(LegacySessionSchema.WorkspaceRecord(from: snapshot))
    try context.save()
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

    @Test("a Marquee survives a store round-trip and workspace hydration")
    func marqueeRoundTrips() async throws {
        let persistence = try makeInMemoryPersistence()
        let workspace = Workspace(width: 8, height: 8)
        let tab = workspace.activeTab
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 2))
        tab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 5))
        tab.endStroke()
        let expected = AppleMarqueeRegion(x: 1, y: 2, width: 4, height: 4)

        try await persistence.save(
            workspace.toSnapshot(), dirtyDocIds: [tab.documentId]
        )
        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(restored.activeTab.marquee == expected)
    }

    @Test("a Marquee user action reaches the store through the real debounced AutoSave wiring")
    func marqueeActionAutoSavesAndRestores() async throws {
        let persistence = try makeInMemoryPersistence()
        let notifier = ProxyDirtyNotifier()
        let workspace = Workspace(width: 8, height: 8, notifier: notifier)
        let tab = workspace.activeTab
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        let autoSave = AutoSave(
            save: { try await persistence.save($0, dirtyDocIds: $1) },
            getSnapshot: { workspace.toSnapshot() },
            debounce: .milliseconds(50)
        )
        notifier.target = AutoSaveDirtyNotifier(autoSave: autoSave)

        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 2))
        tab.continueStroke(to: ScreenCanvasCoords(x: 4, y: 5))
        tab.endStroke()

        // No manual flush or persistence call: the public user action must
        // cross DirtyNotifier and the actual AutoSave debounce on its own.
        try await Task.sleep(for: .milliseconds(400))
        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(restored.activeTab.marquee == AppleMarqueeRegion(
            x: 1, y: 2, width: 4, height: 4
        ))
    }

    @Test("deselecting rewrites a previously stored Marquee as absent")
    func deselectClearsStoredMarquee() async throws {
        let persistence = try makeInMemoryPersistence()
        let workspace = Workspace(width: 8, height: 8)
        let tab = workspace.activeTab
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))
        tab.endStroke()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        tab.beginStroke(at: ScreenCanvasCoords(x: 6, y: 6))
        tab.endStroke()
        try await persistence.save(
            workspace.toSnapshot(), dirtyDocIds: [tab.documentId]
        )
        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(restored.activeTab.marquee == nil)
    }

    @Test("a Reference Layer survives a store round-trip pixel-identically — placement, visibility, and active pointer included")
    func referenceRoundTrips() async throws {
        let persistence = try makeInMemoryPersistence()
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        // A semi-transparent source byte — lossy compression would corrupt it.
        let sourceRgba = Data([200, 100, 50, 7, 255, 0, 0, 255])
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png", rgba: sourceRgba, width: 2, height: 1))
        tab.setReferencePlacement(
            AppleReferencePlacementUpdate(x: 1.5, y: -2.0, scale: 3.0))

        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        let storedSnapshot = try #require(await persistence.restore())

        let reference = try #require(storedSnapshot.tabs[0].reference)
        #expect(reference.name == "guide.png")
        #expect(reference.visible)
        // Round-trip fidelity: the stored compression must be lossless.
        #expect(reference.sourceRgba == sourceRgba)
        #expect(reference.naturalWidth == 2)
        #expect(reference.naturalHeight == 1)
        #expect(reference.placement
            == AppleReferencePlacement(x: 1.5, y: -2.0, scale: 3.0, rotation: 0))

        let restored = try Workspace(restoring: storedSnapshot)
        let restoredTab = restored.activeTab
        #expect(restoredTab.document.layers().map(\.kind) == [.reference, .pixel])
        #expect(restoredTab.document.activeLayerId() == reference.id)
        let underlay = try #require(restoredTab.referenceLayerUnderlay)
        #expect(underlay.sourceRgba == sourceRgba)
        #expect(underlay.placement
            == AppleReferencePlacement(x: 1.5, y: -2.0, scale: 3.0, rotation: 0))
    }

    @Test("deleting the Reference rewrites the stored record reference-free")
    func deleteClearsStoredReference() async throws {
        let persistence = try makeInMemoryPersistence()
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png", rgba: Data([0xFF, 0, 0, 0xFF]), width: 1, height: 1))
        let referenceId = tab.document.activeLayerId()
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        tab.removeLayer(id: referenceId)
        try await persistence.save(
            workspace.toSnapshot(), dirtyDocIds: [tab.documentId]
        )
        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(storedSnapshot.tabs[0].reference == nil)
        #expect(restored.activeTab.document.layers().map(\.kind) == [.pixel])
        #expect(restored.activeTab.referenceLayerUnderlay == nil)
    }

    @Test("a corrupt reference blob yields the document without its reference — never a lost session")
    func corruptReferenceBlobDropsReferenceOnly() async throws {
        let container = try makeInMemoryContainer()
        let persistence = SessionPersistence(modelContainer: container)
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        try tab.document.setPixel(
            x: 1, y: 1, color: Color(r: 0, g: 0xAA, b: 0, a: 0xFF))
        let expectedPixels = tab.document.composite()
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png", rgba: Data([0xFF, 0, 0, 0xFF]), width: 1, height: 1))
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // Corrupt the stored PNG blob in place, as bit rot would.
        let context = ModelContext(container)
        let record = try #require(
            try context.fetch(FetchDescriptor<DocumentRecord>()).first)
        record.reference?.sourcePng = Data([1, 2, 3, 4])
        try context.save()

        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(storedSnapshot.tabs[0].reference == nil)
        #expect(restored.activeTab.document.layers().map(\.kind) == [.pixel])
        // The stored active pointer named the dropped reference; it remaps
        // to the topmost Pixel Layer instead of failing hydration.
        #expect(restored.activeTab.document.activeLayerId()
            == storedSnapshot.tabs[0].layers.last?.id)
        #expect(restored.activeTab.document.composite() == expectedPixels)
    }

    @Test("an invalid stored placement yields the document without its reference")
    func invalidStoredPlacementDropsReferenceOnly() async throws {
        let container = try makeInMemoryContainer()
        let persistence = SessionPersistence(modelContainer: container)
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png", rgba: Data([0xFF, 0, 0, 0xFF]), width: 1, height: 1))
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        let context = ModelContext(container)
        let record = try #require(
            try context.fetch(FetchDescriptor<DocumentRecord>()).first)
        record.reference?.placement.scale = 0
        try context.save()

        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(storedSnapshot.tabs[0].reference == nil)
        #expect(restored.activeTab.document.layers().map(\.kind) == [.pixel])
    }

    @Test("a stored reference id colliding with a Pixel Layer yields the document without its reference")
    func collidingReferenceIdDropsReferenceOnly() async throws {
        let container = try makeInMemoryContainer()
        let persistence = SessionPersistence(modelContainer: container)
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let pixelLayerId = tab.document.activeLayerId()
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png", rgba: Data([0xFF, 0, 0, 0xFF]), width: 1, height: 1))
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // Corrupt the stored reference to reuse a Pixel Layer's id. The
        // stored active pointer still names the reference's original id,
        // which no surviving layer carries.
        let context = ModelContext(container)
        let record = try #require(
            try context.fetch(FetchDescriptor<DocumentRecord>()).first)
        record.reference?.id = pixelLayerId
        try context.save()

        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(storedSnapshot.tabs[0].reference == nil)
        #expect(restored.activeTab.document.layers().map(\.kind) == [.pixel])
        #expect(restored.activeTab.document.activeLayerId() == pixelLayerId)
    }

    @Test("a case-variant reference id collision is still dropped — hydration parses UUIDs case-insensitively")
    func caseVariantReferenceIdCollisionDropsReferenceOnly() async throws {
        let container = try makeInMemoryContainer()
        let persistence = SessionPersistence(modelContainer: container)
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let pixelLayerId = tab.document.activeLayerId()
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png", rgba: Data([0xFF, 0, 0, 0xFF]), width: 1, height: 1))
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // The colliding id differs from the Pixel Layer's only by hex
        // casing — the hydration parser treats them as the same UUID, so
        // the boundary guard must too.
        let context = ModelContext(container)
        let record = try #require(
            try context.fetch(FetchDescriptor<DocumentRecord>()).first)
        record.reference?.id = pixelLayerId.uppercased()
        try context.save()

        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(storedSnapshot.tabs[0].reference == nil)
        #expect(restored.activeTab.document.layers().map(\.kind) == [.pixel])
    }

    @Test("after a reference drop, a case-variant active pointer at a Pixel Layer is kept, not remapped")
    func caseVariantActivePointerSurvivesReferenceDrop() async throws {
        let container = try makeInMemoryContainer()
        let persistence = SessionPersistence(modelContainer: container)
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let bottomPixelId = tab.document.activeLayerId()
        tab.addLayer() // a second, topmost Pixel Layer
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png", rgba: Data([0xFF, 0, 0, 0xFF]), width: 1, height: 1))
        try tab.document.setActiveLayer(id: bottomPixelId)
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        // Double corruption: the reference becomes undroppable-invalid and
        // the active pointer keeps its target but loses its canonical
        // casing. Hydration would accept the case-variant pointer, so the
        // post-drop remap must not move it to the topmost layer.
        let context = ModelContext(container)
        let record = try #require(
            try context.fetch(FetchDescriptor<DocumentRecord>()).first)
        record.reference?.placement.scale = 0
        record.activeLayerId = bottomPixelId.uppercased()
        try context.save()

        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(storedSnapshot.tabs[0].reference == nil)
        #expect(restored.activeTab.document.activeLayerId() == bottomPixelId)
    }

    @Test("a record without a stored Marquee restores selection-free with its pixels unchanged")
    func absentMarqueeRestoresSelectionFree() async throws {
        let persistence = try makeInMemoryPersistence()
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        let expectedPixels = tab.document.composite()

        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(storedSnapshot.tabs[0].marquee == nil)
        #expect(restored.activeTab.marquee == nil)
        #expect(restored.activeTab.document.composite() == expectedPixels)
    }

    @Test("a pre-Marquee SwiftData store migrates selection-free with its pixels unchanged")
    func preMarqueeStoreMigratesSelectionFree() async throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: UUID().uuidString, directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let storeURL = directory.appending(path: "session.store")

        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        let expectedPixels = tab.document.composite()
        try writeLegacyStore(workspace.toSnapshot(), to: storeURL)

        let currentSchema = Schema([DocumentRecord.self, WorkspaceRecord.self])
        let configuration = ModelConfiguration(
            schema: currentSchema,
            url: storeURL,
            cloudKitDatabase: .none
        )
        let container = try ModelContainer(
            for: currentSchema,
            configurations: configuration
        )
        let persistence = SessionPersistence(modelContainer: container)
        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(storedSnapshot.tabs[0].marquee == nil)
        // The pre-reference record also restores reference-free.
        #expect(storedSnapshot.tabs[0].reference == nil)
        #expect(restored.activeTab.marquee == nil)
        #expect(restored.activeTab.document.composite() == expectedPixels)
    }

    @Test("saving during a Floating Selection restores baseline pixels and the source Marquee")
    func floatingSelectionSaveRestoresBaseline() async throws {
        let persistence = try makeInMemoryPersistence()
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let blue = Color(r: 0, g: 0, b: 0xFF, a: 0xFF)
        let source = AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setPixel(x: 2, y: 1, color: blue)
        try tab.document.setMarquee(region: source)
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))

        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(restored.activeTab.marquee == source)
        #expect(restored.activeTab.floatingSelectionOffset == nil)
        #expect(try restored.activeTab.document.getPixel(x: 1, y: 1) == red)
        #expect(try restored.activeTab.document.getPixel(x: 2, y: 1) == blue)
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

    @Test("an out-of-bounds stored Marquee clips to the canvas without discarding the session")
    func outOfBoundsMarqueeClipsOnRestore() async throws {
        let container = try ModelContainer(
            for: DocumentRecord.self, WorkspaceRecord.self,
            configurations: ModelConfiguration(isStoredInMemoryOnly: true)
        )
        let persistence = SessionPersistence(modelContainer: container)
        let workspace = Workspace(width: 8, height: 8)
        let docId = workspace.activeTab.documentId
        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)

        let context = ModelContext(container)
        let record = try #require(try context.fetch(
            FetchDescriptor<DocumentRecord>(predicate: #Predicate { $0.id == docId })
        ).first)
        record.marquee = StoredMarquee(x: 6, y: 6, width: 4, height: 4)
        try context.save()

        let storedSnapshot = try #require(await persistence.restore())
        let restored = try Workspace(restoring: storedSnapshot)

        #expect(restored.activeTab.marquee == AppleMarqueeRegion(
            x: 6, y: 6, width: 2, height: 2
        ))
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

    @Test("a saved-work thumbnail remains Pixel-only with a visible Reference")
    func savedWorkThumbnailExcludesReference() async throws {
        let persistence = try makeInMemoryPersistence()
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        try tab.document.setPixel(
            x: 1,
            y: 1,
            color: Color(r: 0, g: 0xAA, b: 0, a: 0xFF)
        )
        let redReference = Data((0..<(4 * 4)).flatMap { _ in
            [UInt8(0xFF), 0, 0, 0xFF]
        })
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: redReference,
            width: 4,
            height: 4
        ))

        try await persistence.save(workspace.toSnapshot(), dirtyDocIds: nil)
        try await persistence.saveDocumentAs(id: tab.documentId, name: "Traced")

        let summary = try #require(await persistence.savedDocumentSummaries().first)
        let transparentOffset = (0 * 4 + 0) * 4
        let drawnOffset = (1 * 4 + 1) * 4
        #expect(Array(summary.pixels[transparentOffset..<(transparentOffset + 4)]) == [0, 0, 0, 0])
        #expect(Array(summary.pixels[drawnOffset..<(drawnOffset + 4)]) == [0, 0xAA, 0, 0xFF])
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
