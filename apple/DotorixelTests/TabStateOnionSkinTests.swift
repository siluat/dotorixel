import Foundation
import Testing
@testable import Dotorixel

/// The Onion Skin's per-tab state and ghost projection on `TabState`
/// (issue 290), verified through the real bindings. The projection is a
/// read — it must never mutate the document, move the Active Frame, mark
/// dirty, or enter History; pixels on screen are issue 291's slice.
@Suite("TabState — onion skin")
struct TabStateOnionSkinTests {

    @Test("toggling on projects the neighbor's committed composite; the toggle starts off")
    func toggleOnProjectsTheNeighborsCommittedComposite() throws {
        let (tab, first, second, _) = try makeTwoFrameTab()
        // Paint the second frame so its composite is distinguishable from a
        // blank buffer, then return to the first frame.
        tab.setActiveFrame(id: second)
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()
        tab.setActiveFrame(id: first)

        // The toggle starts off, and off projects nothing.
        #expect(!tab.isOnionSkinEnabled)
        #expect(tab.onionSkinProjection.isEmpty)

        tab.toggleOnionSkin()

        #expect(tab.isOnionSkinEnabled)
        let ghosts = tab.onionSkinProjection
        // A two-frame axis with the first frame active: one next ghost only.
        #expect(ghosts.map(\.frameId) == [second])
        #expect(ghosts.first?.kind == .next)
        #expect(ghosts.first?.distance == 1)
        #expect(try ghosts.first?.pixels == tab.document.compositeAt(frameId: second))
    }

    @Test("the projection empties while playback runs and returns when it stops")
    func projectionEmptiesDuringPlaybackAndReturnsOnStop() throws {
        let (tab, _, second, clock) = try makeTwoFrameTab()
        tab.toggleOnionSkin()
        #expect(!tab.onionSkinProjection.isEmpty)

        tab.startPlayback()
        clock.fireAt(1000)

        // Playback previews committed frames full-strength — ghosts would
        // contradict the moving playhead.
        #expect(tab.onionSkinProjection.isEmpty)

        tab.stopPlayback()

        #expect(tab.onionSkinProjection.map(\.frameId) == [second])
    }

    @Test("an edit and its undo both refresh a neighbor's ghost buffer")
    func editAndUndoRefreshTheNeighborsGhostBuffer() throws {
        let (tab, first, second, _) = try makeTwoFrameTab()
        tab.toggleOnionSkin()
        // Paint the neighbor, then return to the first frame.
        tab.setActiveFrame(id: second)
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()
        tab.setActiveFrame(id: first)
        let painted = try #require(tab.onionSkinProjection.first?.pixels)
        #expect(!painted.allSatisfy { $0 == 0 })

        // Hiding the painted layer is an edit that changes the neighbor's
        // committed composite without moving the Active Frame.
        tab.setLayerVisibility(id: tab.document.activeLayerId(), visible: false)

        #expect(tab.onionSkinProjection.first?.pixels.allSatisfy { $0 == 0 } == true)

        // Undo restores the visibility — the ghost refreshes right back.
        tab.handleUndo()

        #expect(tab.onionSkinProjection.first?.pixels == painted)
    }

    @Test("ghost buffers hold the neighbors' committed composites across live stroke samples")
    func ghostBuffersHoldSteadyAcrossLiveStrokeSamples() throws {
        let (tab, first, second, _) = try makeTwoFrameTab()
        tab.setActiveFrame(id: second)
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()
        tab.setActiveFrame(id: first)
        tab.toggleOnionSkin()
        let committed = try #require(tab.onionSkinProjection.first?.pixels)

        // A stroke can only touch the Active Frame's Cel (the mid-stroke
        // seal), so mid-stroke reads keep serving the neighbor's committed
        // composite unchanged.
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 3))
        #expect(tab.onionSkinProjection.first?.pixels == committed)
        tab.endStroke()

        #expect(tab.onionSkinProjection.first?.pixels == committed)
    }

    @Test("toggling marks the workspace dirty; projecting pushes no history and marks nothing")
    func togglingMarksWorkspaceDirtyAndProjectingMarksNothing() throws {
        let recorder = OnionSkinDirtyRecorder()
        let workspace = Workspace(width: 8, height: 8, notifier: recorder)
        let tab = workspace.activeTab
        try tab.document.addFrame(newId: makeFrameId())
        recorder.reset()

        tab.toggleOnionSkin()
        _ = tab.onionSkinProjection
        tab.toggleOnionSkin()
        _ = tab.onionSkinProjection

        #expect(!tab.canUndo)
        // The toggle is per-tab persisted state living in the workspace
        // record's viewports (issue 292) — it marks the workspace, never a
        // document: naming the document would rewrite its layers and stamp
        // `updatedAt` for an edit that never touched it (the PR #351
        // reasoning). The projection reads mark nothing.
        #expect(recorder.markedDocumentIds.isEmpty)
        #expect(recorder.workspaceMarkCount == 2)
    }

    @Test("ghost buffers respect layer visibility and exclude the Reference Layer")
    func ghostBuffersRespectVisibilityAndExcludeTheReference() throws {
        let (tab, first, second, _) = try makeTwoFrameTab()
        tab.toggleOnionSkin()
        // Paint the neighbor, then hide the painted layer.
        tab.setActiveFrame(id: second)
        tab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        tab.endStroke()
        tab.setActiveFrame(id: first)
        tab.setLayerVisibility(id: tab.document.activeLayerId(), visible: false)
        // Add an opaque single-pixel Reference Layer.
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "ref",
            rgba: Data([0xFF, 0x00, 0x00, 0xFF]),
            width: 1,
            height: 1
        ))

        // The ghost shows committed, visible pixel art only: the hidden
        // layer's paint and the Reference Layer are both excluded.
        let ghost = try #require(tab.onionSkinProjection.first)
        #expect(ghost.frameId == second)
        #expect(ghost.pixels.allSatisfy { $0 == 0 })
    }

    @Test("ghost buffers apply layer opacity")
    func ghostBuffersApplyLayerOpacity() throws {
        // Opacity has no runtime setter — it enters through hydration, so the
        // fixture rebuilds a document whose only layer is half-transparent.
        let layerId = makeLayerId()
        var pixels = Data(count: 2 * 2 * 4)
        pixels.replaceSubrange(0..<4, with: [0xFF, 0x00, 0x00, 0xFF])
        let document = try AppleDocument.fromLayers(
            width: 2,
            height: 2,
            layers: [AppleLayerSnapshot(
                id: layerId,
                name: "Layer 1",
                visible: true,
                opacity: 0.5,
                pixels: pixels
            )],
            activeLayerId: layerId,
            nextLayerNumber: 2,
            timelinePanelCollapsed: false
        )
        let tab = TabState(
            shared: SharedState(),
            documentId: "onion-opacity",
            name: "onion-opacity",
            isConstrainHeld: { false },
            consumePendingToolRestore: { nil },
            document: document,
            viewport: AppleViewport.forCanvas(canvasWidth: 2, canvasHeight: 2)
        )
        let first = document.activeFrameId()
        // The added frame becomes active, making the painted frame a
        // previous-side neighbor.
        try document.addFrame(newId: makeFrameId())
        tab.toggleOnionSkin()

        let ghost = try #require(tab.onionSkinProjection.first)
        #expect(ghost.frameId == first)
        #expect(ghost.kind == .previous)
        // Full-red at layer opacity 0.5 over nothing composites straight-alpha
        // to (255, 0, 0, 128) — the worked example from the core blend rule.
        #expect(Array(ghost.pixels.prefix(4)) == [0xFF, 0x00, 0x00, 0x80])
    }
}

/// Records every dirty mark so onion-skin tests can assert none arrive.
private final class OnionSkinDirtyRecorder: DirtyNotifier {
    private(set) var markedDocumentIds: [String] = []
    private(set) var workspaceMarkCount = 0

    func markDirty(documentId: String) { markedDocumentIds.append(documentId) }
    func markWorkspaceDirty() { workspaceMarkCount += 1 }
    func notifyTabRemoved(documentId: String) {}

    func reset() {
        markedDocumentIds = []
        workspaceMarkCount = 0
    }
}
