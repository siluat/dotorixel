import Testing
@testable import Dotorixel

/// Records every save the AutoSave under test performs — the test adapter
/// for the save seam (web parity: the recording fakes in `auto-save.test.ts`).
@MainActor
private final class SaveRecorder {
    struct Save {
        let snapshot: WorkspaceSnapshot
        let dirtyDocIds: Set<String>?
    }

    private(set) var saves: [Save] = []

    func record(_ snapshot: WorkspaceSnapshot, _ dirtyDocIds: Set<String>?) {
        saves.append(Save(snapshot: snapshot, dirtyDocIds: dirtyDocIds))
    }
}

@MainActor
private func makeAutoSave(
    workspace: Workspace,
    recorder: SaveRecorder,
    debounce: Duration = .milliseconds(50)
) -> AutoSave {
    AutoSave(
        save: { snapshot, dirtyDocIds in recorder.record(snapshot, dirtyDocIds) },
        getSnapshot: { workspace.toSnapshot() },
        debounce: debounce
    )
}

@Suite("AutoSave — debounce and dirty tracking")
@MainActor
struct AutoSaveTests {

    @Test("rapid consecutive markDirty calls coalesce into one debounced save carrying every dirty document")
    func rapidMarksCoalesceIntoOneSave() async throws {
        let workspace = Workspace(width: 4, height: 4)
        let recorder = SaveRecorder()
        let autoSave = makeAutoSave(workspace: workspace, recorder: recorder)
        let docA = workspace.tabs[0].documentId
        let docB = workspace.addTab().documentId

        autoSave.markDirty(docA)
        autoSave.markDirty(docB)
        autoSave.markDirty(docA)

        // Nothing may write before the debounce elapses.
        #expect(recorder.saves.isEmpty)

        // Generous headroom over the 50 ms debounce keeps this stable.
        try await Task.sleep(for: .milliseconds(400))

        #expect(recorder.saves.count == 1)
        #expect(recorder.saves[0].dirtyDocIds == [docA, docB])
        #expect(recorder.saves[0].snapshot.tabs.map(\.id) == [docA, docB])
    }

    @Test("flush persists a pending save immediately, before the debounce elapses")
    func flushPersistsImmediately() async throws {
        let workspace = Workspace(width: 4, height: 4)
        let recorder = SaveRecorder()
        // A debounce far longer than the test: only flush can trigger the save.
        let autoSave = makeAutoSave(
            workspace: workspace, recorder: recorder, debounce: .seconds(60)
        )
        let doc = workspace.activeTab.documentId

        autoSave.markDirty(doc)
        await autoSave.flush()

        #expect(recorder.saves.count == 1)
        #expect(recorder.saves[0].dirtyDocIds == [doc])
    }

    @Test("flush with nothing dirty performs no save")
    func flushWithNothingDirtyIsNoOp() async throws {
        let workspace = Workspace(width: 4, height: 4)
        let recorder = SaveRecorder()
        let autoSave = makeAutoSave(workspace: workspace, recorder: recorder)

        await autoSave.flush()

        #expect(recorder.saves.isEmpty)
    }

    @Test("a closed tab's document is dropped from the dirty set while the arrangement still saves")
    func closedTabIsDroppedFromDirtySet() async throws {
        let workspace = Workspace(width: 4, height: 4)
        let recorder = SaveRecorder()
        let autoSave = makeAutoSave(
            workspace: workspace, recorder: recorder, debounce: .seconds(60)
        )
        let doc = workspace.activeTab.documentId

        autoSave.markDirty(doc)
        autoSave.notifyTabRemoved(doc)
        await autoSave.flush()

        // The arrangement change still saves; the removed document is not
        // named dirty, so it is not rewritten.
        #expect(recorder.saves.count == 1)
        #expect(recorder.saves[0].dirtyDocIds == nil)
    }

    @Test("a failed save restores the dirty state so the next flush retries it")
    func failedSaveRetainsDirtyStateForRetry() async throws {
        struct StoreFailure: Error {}
        let workspace = Workspace(width: 4, height: 4)
        let recorder = SaveRecorder()
        var failNextSave = true
        let autoSave = AutoSave(
            save: { snapshot, dirtyDocIds in
                if failNextSave {
                    failNextSave = false
                    throw StoreFailure()
                }
                recorder.record(snapshot, dirtyDocIds)
            },
            getSnapshot: { workspace.toSnapshot() },
            debounce: .seconds(60)
        )
        let doc = workspace.activeTab.documentId

        autoSave.markDirty(doc)
        await autoSave.flush()
        #expect(recorder.saves.isEmpty)

        await autoSave.flush()
        #expect(recorder.saves.count == 1)
        #expect(recorder.saves[0].dirtyDocIds == [doc])
    }
}
