import Foundation
import Testing
@testable import Dotorixel

@Suite("Workspace snapshot — capture")
struct WorkspaceSnapshotCaptureTests {

    @Test("toSnapshot captures documents, tab arrangement, shared state, and per-tab viewports")
    func snapshotCapturesWorkspace() throws {
        let workspace = Workspace(width: 4, height: 4)
        let first = workspace.activeTab
        first.beginStroke(at: ScreenCanvasCoords(x: 1, y: 2))
        first.endStroke()
        first.toggleTimelinePanel()

        let second = workspace.addTab()
        workspace.shared.activeTool = .eraser
        workspace.shared.pixelPerfect = false
        workspace.shared.recordRecentColor(Color(r: 1, g: 2, b: 3, a: 255))
        second.showGrid = false
        workspace.setActiveTab(0)

        let snapshot = workspace.toSnapshot()

        #expect(snapshot.tabs.map(\.id) == [first.documentId, second.documentId])
        #expect(snapshot.activeTabIndex == 0)

        let firstTab = snapshot.tabs[0]
        #expect(firstTab.name == "Untitled 1")
        #expect(firstTab.width == 4)
        #expect(firstTab.height == 4)
        #expect(firstTab.activeLayerId == first.document.activeLayerId())
        #expect(firstTab.nextLayerNumber == first.document.nextLayerNumber())
        #expect(firstTab.timelinePanelCollapsed)
        // The stroke landed at (1, 2): its RGBA slot in the row-major layer
        // buffer must hold the drawn foreground color (opaque black).
        let pixels = firstTab.layers[0].pixels
        let drawnOffset = (2 * 4 + 1) * 4
        #expect(Array(pixels[drawnOffset..<(drawnOffset + 4)]) == [0, 0, 0, 255])

        #expect(snapshot.sharedState.activeTool == .eraser)
        #expect(!snapshot.sharedState.pixelPerfect)
        // Most-recent first: the explicit record, then the black the stroke
        // drew with (drawing records its color as a use).
        #expect(snapshot.sharedState.recentColors == [
            Color(r: 1, g: 2, b: 3, a: 255),
            Color(r: 0, g: 0, b: 0, a: 255)
        ])
        #expect(snapshot.sharedState.foregroundColor == workspace.shared.foregroundColor)
        #expect(snapshot.sharedState.backgroundColor == workspace.shared.backgroundColor)

        let secondTab = snapshot.tabs[1]
        #expect(!secondTab.viewport.showGrid)
        #expect(firstTab.viewport.showGrid)
        #expect(firstTab.viewport.zoom == first.viewport.zoom())
        #expect(firstTab.viewport.panX == first.viewport.panX())
        #expect(firstTab.viewport.panY == first.viewport.panY())
        #expect(firstTab.viewport.pixelSize == first.viewport.pixelSize())
    }

    @Test("a live Floating Selection snapshots pre-lift source pixels without resolving it")
    func floatingSelectionSnapshotUsesPreLiftPixels() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let red = Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        let blue = Color(r: 0, g: 0, b: 0xFF, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)

        try tab.document.setPixel(x: 1, y: 1, color: red)
        try tab.document.setPixel(x: 2, y: 1, color: blue)
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 1)
        )
        workspace.activateTool(.selection)
        tab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        tab.continueStroke(to: ScreenCanvasCoords(x: 2, y: 1))
        tab.endStroke()

        let snapshot = workspace.toSnapshot()
        let pixels = try #require(
            snapshot.tabs[0].layers.first {
                $0.id == tab.document.activeLayerId()
            }
        ).pixels
        #expect(pixel(in: pixels, width: 4, x: 1, y: 1) == red)
        #expect(pixel(in: pixels, width: 4, x: 2, y: 1) == blue)

        // Snapshot projection is read-only: the live document stays lifted
        // and its destination remains a render-only source-over patch.
        #expect(tab.floatingSelectionOffset == FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(try tab.document.getPixel(x: 1, y: 1) == transparent)
        #expect(try tab.document.getPixel(x: 2, y: 1) == blue)
        #expect(pixel(in: try tab.renderPixels(), width: 4, x: 2, y: 1) == red)
    }

    @Test("a Reference-carrying tab round-trips: underlay, row, placement, and active pointer restore exactly")
    func referenceLayerRoundTripsThroughSnapshotAndRestore() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        let pixelLayerId = tab.document.activeLayerId()
        try tab.document.setPixel(
            x: 2,
            y: 1,
            color: Color(r: 0x44, g: 0x55, b: 0x66, a: 0xFF)
        )
        // A semi-transparent source byte — the value a lossy round-trip
        // would corrupt.
        let sourceRgba = Data([200, 100, 50, 7, 255, 0, 0, 255])
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: sourceRgba,
            width: 2,
            height: 1
        ))
        tab.setReferencePlacement(
            AppleReferencePlacementUpdate(x: 1.5, y: -2.0, scale: 3.0))

        let snapshot = workspace.toSnapshot()
        let tabSnapshot = snapshot.tabs[0]

        // Pixel Layers persist exactly as before; the Reference rides
        // alongside instead of being skipped (the closed 278 gap).
        #expect(tabSnapshot.layers.map(\.id) == [pixelLayerId])
        let reference = try #require(tabSnapshot.reference)
        #expect(reference.name == "guide.png")
        #expect(reference.visible)
        #expect(reference.sourceRgba == sourceRgba)
        #expect(reference.naturalWidth == 2)
        #expect(reference.naturalHeight == 1)
        #expect(reference.placement
            == AppleReferencePlacement(x: 1.5, y: -2.0, scale: 3.0, rotation: 0))
        // Import left the Reference active; the snapshot keeps that pointer
        // (the 278 fallback to a Pixel Layer comes out).
        #expect(tabSnapshot.activeLayerId == reference.id)

        let restored = try Workspace(restoring: snapshot)
        let restoredTab = restored.activeTab
        #expect(restoredTab.document.layers().map(\.kind) == [.reference, .pixel])
        #expect(restoredTab.document.activeLayerId() == reference.id)
        #expect(restoredTab.document.composite() == tab.document.composite())
        #expect(restoredTab.layersInPanelOrder.map(\.kind) == [.pixel, .reference])

        let underlay = try #require(restoredTab.referenceLayerUnderlay)
        #expect(underlay.sourceRgba == sourceRgba)
        #expect(underlay.naturalWidth == 2)
        #expect(underlay.naturalHeight == 1)
        #expect(underlay.placement
            == AppleReferencePlacement(x: 1.5, y: -2.0, scale: 3.0, rotation: 0))
    }

    @Test("a hidden Reference restores hidden — no underlay, visibility intact")
    func hiddenReferenceRestoresHidden() throws {
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        try tab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: Data([0xFF, 0, 0, 0xFF]),
            width: 1,
            height: 1
        ))
        let referenceId = tab.document.activeLayerId()
        tab.setLayerVisibility(id: referenceId, visible: false)

        let restored = try Workspace(restoring: workspace.toSnapshot())
        let restoredTab = restored.activeTab

        #expect(restoredTab.referenceLayerUnderlay == nil)
        let referenceRow = try #require(
            restoredTab.layersInPanelOrder.first { $0.kind == .reference })
        #expect(!referenceRow.visible)
    }

    private func pixel(in pixels: Data, width: Int, x: Int, y: Int) -> Color {
        let offset = (y * width + x) * 4
        return Color(
            r: pixels[offset],
            g: pixels[offset + 1],
            b: pixels[offset + 2],
            a: pixels[offset + 3]
        )
    }
}

@Suite("Workspace snapshot — restore")
struct WorkspaceSnapshotRestoreTests {

    @Test("a snapshot round-trips: documents, arrangement, shared state, and viewports restore; history starts empty")
    func snapshotRoundTripsThroughRestore() throws {
        let workspace = Workspace(width: 4, height: 4)
        let first = workspace.activeTab
        first.beginStroke(at: ScreenCanvasCoords(x: 1, y: 2))
        first.endStroke()
        first.addLayer()
        first.toggleTimelinePanel()
        first.handleZoomIn()

        let second = workspace.addTab()
        second.showGrid = false
        workspace.shared.activeTool = .floodFill
        workspace.shared.pixelPerfect = false
        workspace.shared.foregroundColor = Color(r: 10, g: 20, b: 30, a: 255)
        workspace.setActiveTab(0)

        let restored = try Workspace(restoring: workspace.toSnapshot())

        #expect(restored.tabs.map(\.documentId) == [first.documentId, second.documentId])
        #expect(restored.tabs.map(\.name) == [first.name, second.name])
        #expect(restored.activeTabIndex == 0)

        let restoredFirst = restored.tabs[0]
        #expect(restoredFirst.document.composite() == first.document.composite())
        #expect(restoredFirst.document.activeLayerId() == first.document.activeLayerId())
        #expect(restoredFirst.document.nextLayerNumber() == first.document.nextLayerNumber())
        #expect(restoredFirst.layersInPanelOrder.map(\.id) == first.layersInPanelOrder.map(\.id))
        #expect(restoredFirst.isTimelinePanelCollapsed)
        #expect(restoredFirst.viewport.zoom() == first.viewport.zoom())
        #expect(restoredFirst.viewport.panX() == first.viewport.panX())
        #expect(restoredFirst.viewport.panY() == first.viewport.panY())
        #expect(restoredFirst.showGrid)
        #expect(!restored.tabs[1].showGrid)

        #expect(restored.shared.activeTool == .floodFill)
        #expect(!restored.shared.pixelPerfect)
        #expect(restored.shared.foregroundColor == Color(r: 10, g: 20, b: 30, a: 255))
        #expect(restored.shared.recentColors == workspace.shared.recentColors)

        // History is session-transient (web parity): a restored tab starts
        // with empty undo/redo stacks.
        #expect(!restoredFirst.canUndo)
        #expect(!restoredFirst.canRedo)
    }

    @Test("a restored tab keeps its persisted zoom on first presentation instead of refitting")
    func restoredTabKeepsPersistedViewportOnFirstPresentation() throws {
        let deviceSize = ViewportSize(width: 800, height: 600)
        let workspace = Workspace(width: 4, height: 4)
        let tab = workspace.activeTab
        workspace.presentActiveTab(in: deviceSize)
        tab.handleZoomIn()
        let persistedZoom = tab.viewport.zoom()

        let restored = try Workspace(restoring: workspace.toSnapshot())
        restored.presentActiveTab(in: deviceSize)

        // First presentation of a *fresh* tab fits the canvas; a restored tab
        // must instead keep the zoom it was persisted with.
        #expect(restored.activeTab.viewport.zoom() == persistedZoom)
    }
}
