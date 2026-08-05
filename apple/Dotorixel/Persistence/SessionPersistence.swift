import Foundation
import SwiftData

/// Maps workspace snapshots onto the SwiftData session store (web parity:
/// `SessionPersistence` in `session-persistence.ts`). A `ModelActor`, so
/// saves run off the main actor — the debounced background write the issue
/// calls for — while the store stays confined to one executor.
@ModelActor
actor SessionPersistence {

    /// Persists `snapshot` as the current session. `dirtyDocIds` names the
    /// documents whose records must be rewritten; `nil` rewrites every one.
    /// The workspace record (tab order, active tab, shared state, viewports)
    /// is always rewritten, and documents no longer in any tab are deleted
    /// unless the user explicitly saved them.
    func save(_ snapshot: WorkspaceSnapshot, dirtyDocIds: Set<String>?) throws {
        let previousDocIds = Set(try fetchWorkspace()?.tabOrder ?? [])
        let now = Date()

        for tab in snapshot.tabs {
            let existing = try fetchDocument(id: tab.id)
            // A tab with no stored record is written regardless of the dirty
            // set — skipping it would persist a tab order referencing a
            // document that was never stored, and restore discards the whole
            // session over the missing record.
            let shouldWrite = existing == nil || (dirtyDocIds?.contains(tab.id) ?? true)
            guard shouldWrite else { continue }
            if let existing {
                update(existing, from: tab, at: now)
            } else {
                modelContext.insert(makeRecord(from: tab, at: now))
            }
        }

        if let workspace = try fetchWorkspace() {
            workspace.tabOrder = snapshot.tabs.map(\.id)
            workspace.activeTabIndex = snapshot.activeTabIndex
            workspace.sharedState = storedSharedState(snapshot.sharedState)
            workspace.viewports = storedViewports(snapshot.tabs)
        } else {
            modelContext.insert(WorkspaceRecord(
                tabOrder: snapshot.tabs.map(\.id),
                activeTabIndex: snapshot.activeTabIndex,
                sharedState: storedSharedState(snapshot.sharedState),
                viewports: storedViewports(snapshot.tabs)
            ))
        }

        // Delete unsaved documents that are no longer in any tab (web
        // parity: closing a tab removes it from the restored session).
        let currentDocIds = Set(snapshot.tabs.map(\.id))
        for closedId in previousDocIds.subtracting(currentDocIds) {
            if let record = try fetchDocument(id: closedId), !record.saved {
                modelContext.delete(record)
            }
        }

        try modelContext.save()
    }

    /// Rebuilds the stored session as a workspace snapshot, or `nil` when
    /// there is none — no stored workspace, an empty tab order, or a store
    /// whose records are missing or unreadable. `nil` is the fresh-session
    /// fallback signal, never an error (web parity: a corrupt store must
    /// not block the editor).
    ///
    /// This layer rejects only what would trap before the core can see it
    /// (integer conversions). Value-level corruption it cannot judge —
    /// dimensions outside the core's supported range, malformed layer data —
    /// passes through and fails at core hydration in `Workspace(restoring:)`,
    /// the second half of the same fresh-session fallback; duplicating those
    /// bounds here would make this a second authority over canvas limits.
    func restore() -> WorkspaceSnapshot? {
        do {
            guard let workspace = try fetchWorkspace() else { return nil }
            var tabs: [TabSnapshot] = []
            for docId in workspace.tabOrder {
                guard let record = try fetchDocument(id: docId) else { return nil }
                tabs.append(try tabSnapshot(from: record, viewport: workspace.viewports[docId]))
            }
            guard !tabs.isEmpty else { return nil }
            return WorkspaceSnapshot(
                tabs: tabs,
                activeTabIndex: workspace.activeTabIndex,
                sharedState: sharedStateSnapshot(workspace.sharedState)
            )
        } catch {
            return nil
        }
    }

    /// Whether the stored document has been explicitly kept by the user
    /// (web parity: `isDocumentSaved`). `false` when no record exists.
    func isDocumentSaved(id: String) -> Bool {
        (try? fetchDocument(id: id))?.saved ?? false
    }

    /// Marks the stored document saved under `name` (web parity:
    /// `saveDocumentAs`) — the explicit keep that exempts it from the
    /// closed-tab cleanup in `save`. No-op when no record exists.
    func saveDocumentAs(id: String, name: String) throws {
        guard let record = try fetchDocument(id: id) else { return }
        record.saved = true
        record.name = name
        try modelContext.save()
    }

    /// Summaries of every explicitly saved document, most recently updated
    /// first (web parity: `getAllSavedDocuments`). The pixels are the export
    /// composite the browser renders as the thumbnail — the record's layers
    /// hydrated through the core, so the composite matches what export
    /// produces. One unreadable record is skipped, not the whole listing
    /// (mirrors `restore()`'s fresh-session fallback, scoped per record).
    func savedDocumentSummaries() -> [SavedDocumentSummary] {
        let descriptor = FetchDescriptor<DocumentRecord>(
            predicate: #Predicate { $0.saved },
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        guard let records = try? modelContext.fetch(descriptor) else { return [] }
        return records.compactMap { record in
            guard let snapshot = try? tabSnapshot(from: record, viewport: nil),
                  let document = try? AppleDocument.fromLayers(
                      width: snapshot.width,
                      height: snapshot.height,
                      layers: snapshot.layers,
                      activeLayerId: snapshot.activeLayerId,
                      nextLayerNumber: snapshot.nextLayerNumber,
                      timelinePanelCollapsed: snapshot.timelinePanelCollapsed
                  ) else { return nil }
            return SavedDocumentSummary(
                id: record.id,
                name: record.name,
                width: snapshot.width,
                height: snapshot.height,
                pixels: document.compositeForExport(),
                updatedAt: record.updatedAt
            )
        }
    }

    /// The tab snapshot a saved document reopens as (web parity:
    /// `getSavedDocumentSnapshot`): its stored content with the default
    /// viewport — reopening resets the view. `nil` when the record is
    /// missing, unsaved, or unreadable.
    func savedDocumentSnapshot(id: String) -> TabSnapshot? {
        guard let record = try? fetchDocument(id: id), record.saved else { return nil }
        return try? tabSnapshot(from: record, viewport: nil)
    }

    /// Removes a document record immediately, regardless of its `saved`
    /// flag (web parity: `deleteDocument`).
    func deleteDocument(id: String) throws {
        if let record = try fetchDocument(id: id) {
            modelContext.delete(record)
            try modelContext.save()
        }
    }

    /// The stored `updatedAt` of the document record with `id`, or `nil`
    /// when no record exists. Lets callers (and tests) observe write
    /// behavior without reaching into the store.
    func documentUpdatedAt(id: String) -> Date? {
        (try? fetchDocument(id: id))?.updatedAt
    }

    // MARK: - Fetching

    private func fetchWorkspace() throws -> WorkspaceRecord? {
        let singletonId = WorkspaceRecord.singletonId
        var descriptor = FetchDescriptor<WorkspaceRecord>(
            predicate: #Predicate { $0.id == singletonId }
        )
        descriptor.fetchLimit = 1
        return try modelContext.fetch(descriptor).first
    }

    private func fetchDocument(id: String) throws -> DocumentRecord? {
        var descriptor = FetchDescriptor<DocumentRecord>(
            predicate: #Predicate { $0.id == id }
        )
        descriptor.fetchLimit = 1
        return try modelContext.fetch(descriptor).first
    }

    // MARK: - Snapshot → stored

    private func makeRecord(from tab: TabSnapshot, at now: Date) -> DocumentRecord {
        DocumentRecord(
            id: tab.id,
            name: tab.name,
            width: Int(tab.width),
            height: Int(tab.height),
            layers: tab.layers.map(storedLayer),
            activeLayerId: tab.activeLayerId,
            nextLayerNumber: Int(tab.nextLayerNumber),
            timelinePanelCollapsed: tab.timelinePanelCollapsed,
            // `saved` gains meaning with the save dialog (issue 266); until
            // then every auto-saved document is unsaved working state.
            saved: false,
            createdAt: now,
            updatedAt: now
        )
    }

    private func update(_ record: DocumentRecord, from tab: TabSnapshot, at now: Date) {
        record.name = tab.name
        record.width = Int(tab.width)
        record.height = Int(tab.height)
        record.layers = tab.layers.map(storedLayer)
        record.activeLayerId = tab.activeLayerId
        record.nextLayerNumber = Int(tab.nextLayerNumber)
        record.timelinePanelCollapsed = tab.timelinePanelCollapsed
        record.updatedAt = now
    }

    private func storedLayer(_ layer: AppleLayerSnapshot) -> StoredLayer {
        StoredLayer(
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            pixels: layer.pixels
        )
    }

    private func storedColor(_ color: Color) -> StoredColor {
        StoredColor(r: color.r, g: color.g, b: color.b, a: color.a)
    }

    private func storedSharedState(_ shared: SharedStateSnapshot) -> StoredSharedState {
        StoredSharedState(
            activeTool: shared.activeTool.rawValue,
            foregroundColor: storedColor(shared.foregroundColor),
            backgroundColor: storedColor(shared.backgroundColor),
            recentColors: shared.recentColors.map(storedColor),
            pixelPerfect: shared.pixelPerfect
        )
    }

    private func storedViewports(_ tabs: [TabSnapshot]) -> [String: StoredViewport] {
        Dictionary(uniqueKeysWithValues: tabs.map { tab in
            (tab.id, StoredViewport(
                pixelSize: Int(tab.viewport.pixelSize),
                zoom: tab.viewport.zoom,
                panX: tab.viewport.panX,
                panY: tab.viewport.panY,
                showGrid: tab.viewport.showGrid
            ))
        })
    }

    // MARK: - Stored → snapshot

    /// A record whose numbers cannot round-trip (negative dimensions, an
    /// out-of-range counter). The store is an external input: throwing joins
    /// `restore()`'s fresh-session fallback, where a direct `UInt32(_:)`
    /// conversion would trap outside Swift error handling and crash launch.
    private struct CorruptRecord: Error {}

    /// The viewport a record restores with when the workspace record holds
    /// none for it — or a corrupt one (web parity: `DEFAULT_VIEWPORT`).
    private static let defaultViewport = TabViewportSnapshot(
        pixelSize: 32, zoom: 1.0, panX: 0, panY: 0, showGrid: true
    )

    private func tabSnapshot(
        from record: DocumentRecord, viewport: StoredViewport?
    ) throws -> TabSnapshot {
        guard let width = UInt32(exactly: record.width),
              let height = UInt32(exactly: record.height),
              let nextLayerNumber = UInt32(exactly: record.nextLayerNumber) else {
            throw CorruptRecord()
        }
        return TabSnapshot(
            id: record.id,
            name: record.name,
            width: width,
            height: height,
            layers: record.layers.map { layer in
                AppleLayerSnapshot(
                    id: layer.id,
                    name: layer.name,
                    visible: layer.visible,
                    opacity: layer.opacity,
                    pixels: layer.pixels
                )
            },
            activeLayerId: record.activeLayerId,
            nextLayerNumber: nextLayerNumber,
            timelinePanelCollapsed: record.timelinePanelCollapsed,
            viewport: viewportSnapshot(viewport)
        )
    }

    /// A missing viewport — or one whose values fail validation (non-finite
    /// zoom/pan, non-positive pixel size or zoom) — restores as the default
    /// viewport: one corrupt viewport must not discard the whole session's
    /// documents.
    private func viewportSnapshot(_ stored: StoredViewport?) -> TabViewportSnapshot {
        guard let stored,
              let pixelSize = UInt32(exactly: stored.pixelSize), pixelSize > 0,
              stored.zoom.isFinite, stored.zoom > 0,
              stored.panX.isFinite, stored.panY.isFinite else {
            return Self.defaultViewport
        }
        return TabViewportSnapshot(
            pixelSize: pixelSize,
            zoom: stored.zoom,
            panX: stored.panX,
            panY: stored.panY,
            showGrid: stored.showGrid
        )
    }

    private func color(_ stored: StoredColor) -> Color {
        Color(r: stored.r, g: stored.g, b: stored.b, a: stored.a)
    }

    private func sharedStateSnapshot(_ stored: StoredSharedState) -> SharedStateSnapshot {
        SharedStateSnapshot(
            // An unknown stored tool (a case renamed without migration)
            // falls back to the default tool instead of discarding the
            // whole session.
            activeTool: EditorTool(rawValue: stored.activeTool) ?? .pencil,
            foregroundColor: color(stored.foregroundColor),
            backgroundColor: color(stored.backgroundColor),
            recentColors: stored.recentColors.map(color),
            pixelPerfect: stored.pixelPerfect
        )
    }
}
