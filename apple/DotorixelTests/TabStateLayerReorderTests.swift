import Foundation
import Testing
@testable import Dotorixel

/// Layer reordering on `TabState` (issue 260): the panel's drop commit,
/// with web-parity history semantics.
///
/// The seam takes a **panel index** (top of panel = 0) because that is what the
/// panel's drag reports; the translation to a stack index is the behavior these
/// tests pin — an inverted mapping would silently move layers the wrong way.
@Suite("TabState — layer reorder")
struct TabStateLayerReorderTests {
    @Test("the Reference row never exposes reorder while Pixel rows reorder only among themselves")
    func referenceRowIsFixedBelowPixelRows() throws {
        let state = Workspace(width: 8, height: 8)
        let firstPixelId = state.activeTab.document.activeLayerId()
        try state.activeTab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: Data([0, 0, 0, 0xFF]),
            width: 1,
            height: 1
        ))
        let referenceId = state.activeTab.document.activeLayerId()

        #expect(!state.activeTab.canReorderLayers)
        #expect(!state.activeTab.canReorderLayer(id: referenceId))
        #expect(!state.activeTab.canReorderLayer(id: firstPixelId))

        state.activeTab.setActiveLayer(id: firstPixelId)
        state.activeTab.addLayer()
        let secondPixelId = state.activeTab.document.activeLayerId()

        #expect(state.activeTab.canReorderLayers)
        #expect(state.activeTab.canReorderLayer(id: firstPixelId))
        #expect(state.activeTab.canReorderLayer(id: secondPixelId))
        #expect(!state.activeTab.canReorderLayer(id: referenceId))

        state.activeTab.reorderLayer(id: referenceId, toPanelIndex: 0)
        #expect(state.activeTab.document.layers().first?.id == referenceId)
    }

    /// Reads one RGBA pixel of the composite — the rendered stacking these
    /// tests judge the reorder by.
    private func compositePixel(
        _ tab: TabState, x: UInt32, y: UInt32
    ) -> [UInt8] {
        let pixels = tab.document.composite()
        let offset = Int((y * tab.document.width() + x) * 4)
        return Array(pixels[offset..<offset + 4])
    }

    private let black: [UInt8] = [0x00, 0x00, 0x00, 0xFF]
    private let red: [UInt8] = [0xFF, 0x00, 0x00, 0xFF]

    /// Two layers painting the same cell in different colors: the composite
    /// pixel names which layer is on top.
    private func makeOverlappingStack() -> (state: Workspace, bottom: String, top: String) {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()

        state.activeTab.addLayer()
        let topId = state.activeTab.document.activeLayerId()
        state.shared.foregroundColor = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()

        return (state, bottomId, topId)
    }

    @Test("moving the top row to the panel's bottom puts its pixels under the other layer's")
    func movingTopRowToPanelBottomRestacksTheComposite() {
        let (state, bottomId, topId) = makeOverlappingStack()
        #expect(compositePixel(state.activeTab, x: 2, y: 2) == red)

        // Panel order is [top, bottom]; index 1 is the panel's bottom row.
        state.activeTab.reorderLayer(id: topId, toPanelIndex: 1)

        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [bottomId, topId])
        #expect(compositePixel(state.activeTab, x: 2, y: 2) == black)
    }

    @Test("a real move records exactly one undo entry; undo restores the previous order and composite")
    func realMoveRecordsOneEntryAndUndoRestoresOrderAndComposite() {
        let (state, bottomId, topId) = makeOverlappingStack()

        state.activeTab.reorderLayer(id: topId, toPanelIndex: 1)

        // One undo restores the pre-move order and the composite it rendered…
        state.activeTab.handleUndo()
        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [topId, bottomId])
        #expect(compositePixel(state.activeTab, x: 2, y: 2) == red)

        // …and the move recorded exactly one entry: the next undo peels the
        // red stroke, not another restack.
        state.activeTab.handleUndo()
        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [topId, bottomId])
        #expect(compositePixel(state.activeTab, x: 2, y: 2) == black)
    }

    @Test("a drop at the row's current position records nothing and leaves the redo future intact")
    func dropAtCurrentPositionRecordsNothing() {
        let (state, _, topId) = makeOverlappingStack()
        state.activeTab.reorderLayer(id: topId, toPanelIndex: 1)
        state.activeTab.handleUndo()
        #expect(state.activeTab.canRedo)

        // Dropping a row back where it started is a full no-op: no entry, no
        // re-render signal, and the redo future (the undone move) survives.
        let versionBefore = state.activeTab.canvasVersion
        state.activeTab.reorderLayer(id: topId, toPanelIndex: 0)
        #expect(state.activeTab.canvasVersion == versionBefore)
        #expect(state.activeTab.canRedo)
    }

    @Test("reordering never changes which layer is active — including when the moved row is the active one")
    func reorderPreservesTheActiveLayer() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        let middleId = makeLayerId()
        try state.activeTab.document.addLayer(newId: middleId, name: "Layer 2")
        let topId = makeLayerId()
        try state.activeTab.document.addLayer(newId: topId, name: "Layer 3")
        state.activeTab.setActiveLayer(id: middleId)

        // Moving another row leaves the active pointer where it was…
        state.activeTab.reorderLayer(id: topId, toPanelIndex: 2)
        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [middleId, bottomId, topId])
        #expect(state.activeTab.activeLayerId == middleId)

        // …and so does moving the active row itself (the core tracks the
        // active layer by id, not by index).
        state.activeTab.reorderLayer(id: middleId, toPanelIndex: 2)
        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [bottomId, topId, middleId])
        #expect(state.activeTab.activeLayerId == middleId)

        // The active layer is still the drawing target after the moves.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.endStroke()
        #expect(try state.activeTab.document.activeLayerPixels().contains { $0 != 0 })
    }

    @Test("canReorderLayers is false on a sole-layer document — the panel's disabled-handle predicate")
    func canReorderLayersReadsTheSoleLayerCase() {
        let state = Workspace(width: 8, height: 8)
        // One row has nowhere to move to, so its handle renders disabled.
        #expect(!state.activeTab.canReorderLayers)

        state.activeTab.addLayer()
        #expect(state.activeTab.canReorderLayers)

        state.activeTab.removeLayer(id: state.activeTab.activeLayerId)
        #expect(!state.activeTab.canReorderLayers)
    }

    @Test("a panel index past either end lands at that end — the core's silent clamp, mirrored")
    func outOfRangePanelIndexClampsToTheStackEnds() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        let middleId = makeLayerId()
        try state.activeTab.document.addLayer(newId: middleId, name: "Layer 2")
        let topId = makeLayerId()
        try state.activeTab.document.addLayer(newId: topId, name: "Layer 3")

        // A drag released below the last row reports an index past the end;
        // the row lands at the panel's bottom rather than trapping on the
        // negative stack index the raw translation would produce.
        state.activeTab.reorderLayer(id: topId, toPanelIndex: 99)
        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [middleId, bottomId, topId])

        // The same above the first row.
        state.activeTab.reorderLayer(id: topId, toPanelIndex: -5)
        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [topId, middleId, bottomId])
    }

    @Test("reorder no-ops while a stroke is drawing: the stroke's target never moves mid-stroke")
    func reorderNoOpsWhileDrawing() {
        let (state, bottomId, topId) = makeOverlappingStack()

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        // A second finger drags a row's handle mid-stroke (iPad multitouch) —
        // the mid-stroke seal ignores it: committing here would replace the
        // stroke's pending Edit Baseline.
        state.activeTab.reorderLayer(id: topId, toPanelIndex: 1)
        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [topId, bottomId])
        state.activeTab.endStroke()

        // The stroke's own undo entry survived intact: one undo erases the
        // stroke and leaves the pre-stroke composite.
        state.activeTab.handleUndo()
        #expect(compositePixel(state.activeTab, x: 5, y: 5) == [0x00, 0x00, 0x00, 0x00])
        #expect(compositePixel(state.activeTab, x: 2, y: 2) == red)
    }
}
