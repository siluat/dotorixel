import Foundation
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

    @Test("flush snapshots pre-lift pixels without resolving a live Floating Selection")
    func flushPreservesLiveFloatingSelection() async throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let recorder = SaveRecorder()
        let autoSave = makeAutoSave(
            workspace: workspace,
            recorder: recorder,
            debounce: .seconds(60)
        )
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        autoSave.markDirty(tab.documentId)
        await autoSave.flush()

        let savedPixels = try #require(recorder.saves.first?.snapshot.tabs[0].layers[0].pixels)
        let sourceOffset = (1 * 4 + 1) * 4
        #expect(Array(savedPixels[sourceOffset..<(sourceOffset + 4)]) == [0xFF, 0, 0, 0xFF])
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        let preview = try tab.renderPixels()
        let destinationOffset = (1 * 4 + 2) * 4
        #expect(Array(preview[destinationOffset..<(destinationOffset + 4)]) == [0xFF, 0, 0, 0xFF])
    }

    @Test("flush persists the pre-lift source after a degraded Floating cancel")
    func flushPreservesPendingFloatingRecovery() async throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let recorder = SaveRecorder()
        let autoSave = makeAutoSave(
            workspace: workspace,
            recorder: recorder,
            debounce: .seconds(60)
        )
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let sourceLayerId = tab.document.activeLayerId()
        let sourceOffset = (1 * Int(tab.document.width()) + 1) * 4

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        // Fault-inject the otherwise-guarded source-Layer mismatch through the
        // core object: production layer actions commit Floating state first.
        try tab.document.addLayer(newId: UUID().uuidString, name: "Other")
        let otherLayerId = tab.document.activeLayerId()

        #expect(!tab.cancelFloatingSelection())
        let liveSource = try #require(
            try tab.document.layerSnapshots().first { $0.id == sourceLayerId }
        )
        #expect(
            Array(liveSource.pixels[sourceOffset..<(sourceOffset + 4)])
                == [0, 0, 0, 0]
        )
        #expect(tab.document.activeLayerId() == otherLayerId)
        #expect(!tab.isDocumentBlank())

        autoSave.markDirty(tab.documentId)
        await autoSave.flush()

        let savedTab = try #require(recorder.saves.first?.snapshot.tabs[0])
        let savedSource = try #require(
            savedTab.layers.first { $0.id == sourceLayerId }
        )
        let savedOther = try #require(
            savedTab.layers.first { $0.id == otherLayerId }
        )
        #expect(
            Array(savedSource.pixels[sourceOffset..<(sourceOffset + 4)])
                == [0xFF, 0, 0, 0xFF]
        )
        #expect(savedTab.activeLayerId == otherLayerId)
        #expect(savedOther.name == "Other")
        #expect(savedOther.visible)
        #expect(savedOther.opacity == 1.0)
        #expect(Array(savedOther.pixels[0..<4]) == [0, 0, 0, 0])

        tab.handleUndo()

        let recoveredLayers = try tab.document.layerSnapshots()
        let recoveredSource = try #require(
            recoveredLayers.first { $0.id == sourceLayerId }
        )
        let recoveredOther = try #require(
            recoveredLayers.first { $0.id == otherLayerId }
        )
        #expect(
            Array(recoveredSource.pixels[sourceOffset..<(sourceOffset + 4)])
                == [0xFF, 0, 0, 0xFF]
        )
        #expect(Array(recoveredOther.pixels[0..<4]) == [0, 0, 0, 0])
        #expect(tab.document.activeLayerId() == otherLayerId)
        #expect(!tab.canUndo)
        #expect(!tab.documentHistory.canUndo())
    }

    @Test("flush with nothing dirty performs no save")
    func flushWithNothingDirtyIsNoOp() async throws {
        let workspace = Workspace(width: 4, height: 4)
        let recorder = SaveRecorder()
        let autoSave = makeAutoSave(workspace: workspace, recorder: recorder)

        await autoSave.flush()

        #expect(recorder.saves.isEmpty)
    }

    @Test("flush carries the Reference alongside the Pixel stack to persistence")
    func flushCarriesReferenceToPersistence() async throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let pixelLayerId = tab.document.activeLayerId()
        try tab.document.setPixel(
            x: 1,
            y: 1,
            color: Color(r: 0, g: 0xAA, b: 0, a: 0xFF)
        )
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: Data([0xFF, 0, 0, 0xFF]),
            width: 1,
            height: 1
        ))
        let recorder = SaveRecorder()
        let autoSave = makeAutoSave(
            workspace: workspace,
            recorder: recorder,
            debounce: .seconds(60)
        )

        autoSave.markDirty(tab.documentId)
        await autoSave.flush()

        let savedTab = try #require(recorder.saves.first?.snapshot.tabs.first)
        #expect(savedTab.layers.map(\.id) == [pixelLayerId])
        #expect(savedTab.layers[0].pixels == tab.document.compositeForExport())
        // The Reference rides alongside the Pixel stack (the closed 278
        // gap), keeping the reference-active pointer import left behind.
        let reference = try #require(savedTab.reference)
        #expect(savedTab.activeLayerId == reference.id)
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

        // The arrangement change still saves; the dirty set is empty — not
        // nil — so no remaining document is rewritten (nil would mean
        // "rewrite everything").
        #expect(recorder.saves.count == 1)
        #expect(recorder.saves[0].dirtyDocIds == [])
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
