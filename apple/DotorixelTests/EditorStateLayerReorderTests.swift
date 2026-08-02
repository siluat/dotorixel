import Foundation
import Testing
@testable import Dotorixel

/// Layer reordering on `EditorState` (issue 260): the panel's drop commit,
/// with web-parity history semantics.
///
/// The seam takes a **panel index** (top of panel = 0) because that is what the
/// panel's drag reports; the translation to a stack index is the behavior these
/// tests pin — an inverted mapping would silently move layers the wrong way.
@Suite("EditorState — layer reorder")
struct EditorStateLayerReorderTests {

    /// Reads one RGBA pixel of the composite — the rendered stacking these
    /// tests judge the reorder by.
    private func compositePixel(
        _ state: EditorState, x: UInt32, y: UInt32
    ) -> [UInt8] {
        let pixels = state.document.composite()
        let offset = Int((y * state.document.width() + x) * 4)
        return Array(pixels[offset..<offset + 4])
    }

    private let black: [UInt8] = [0x00, 0x00, 0x00, 0xFF]
    private let red: [UInt8] = [0xFF, 0x00, 0x00, 0xFF]

    /// Two layers painting the same cell in different colors: the composite
    /// pixel names which layer is on top.
    private func makeOverlappingStack() -> (state: EditorState, bottom: String, top: String) {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()
        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.endStroke()

        state.addLayer()
        let topId = state.document.activeLayerId()
        state.foregroundColor = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.endStroke()

        return (state, bottomId, topId)
    }

    @Test("moving the top row to the panel's bottom puts its pixels under the other layer's")
    func movingTopRowToPanelBottomRestacksTheComposite() {
        let (state, bottomId, topId) = makeOverlappingStack()
        #expect(compositePixel(state, x: 2, y: 2) == red)

        // Panel order is [top, bottom]; index 1 is the panel's bottom row.
        state.reorderLayer(id: topId, toPanelIndex: 1)

        #expect(state.layersInPanelOrder.map(\.id) == [bottomId, topId])
        #expect(compositePixel(state, x: 2, y: 2) == black)
    }

    @Test("a real move records exactly one undo entry; undo restores the previous order and composite")
    func realMoveRecordsOneEntryAndUndoRestoresOrderAndComposite() {
        let (state, bottomId, topId) = makeOverlappingStack()

        state.reorderLayer(id: topId, toPanelIndex: 1)

        // One undo restores the pre-move order and the composite it rendered…
        state.handleUndo()
        #expect(state.layersInPanelOrder.map(\.id) == [topId, bottomId])
        #expect(compositePixel(state, x: 2, y: 2) == red)

        // …and the move recorded exactly one entry: the next undo peels the
        // red stroke, not another restack.
        state.handleUndo()
        #expect(state.layersInPanelOrder.map(\.id) == [topId, bottomId])
        #expect(compositePixel(state, x: 2, y: 2) == black)
    }

    @Test("a drop at the row's current position records nothing and leaves the redo future intact")
    func dropAtCurrentPositionRecordsNothing() {
        let (state, _, topId) = makeOverlappingStack()
        state.reorderLayer(id: topId, toPanelIndex: 1)
        state.handleUndo()
        #expect(state.canRedo)

        // Dropping a row back where it started is a full no-op: no entry, no
        // re-render signal, and the redo future (the undone move) survives.
        let versionBefore = state.canvasVersion
        state.reorderLayer(id: topId, toPanelIndex: 0)
        #expect(state.canvasVersion == versionBefore)
        #expect(state.canRedo)
    }

    @Test("reordering never changes which layer is active — including when the moved row is the active one")
    func reorderPreservesTheActiveLayer() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()
        let middleId = makeLayerId()
        try state.document.addLayer(newId: middleId, name: "Layer 2")
        let topId = makeLayerId()
        try state.document.addLayer(newId: topId, name: "Layer 3")
        state.setActiveLayer(id: middleId)

        // Moving another row leaves the active pointer where it was…
        state.reorderLayer(id: topId, toPanelIndex: 2)
        #expect(state.layersInPanelOrder.map(\.id) == [middleId, bottomId, topId])
        #expect(state.activeLayerId == middleId)

        // …and so does moving the active row itself (the core tracks the
        // active layer by id, not by index).
        state.reorderLayer(id: middleId, toPanelIndex: 2)
        #expect(state.layersInPanelOrder.map(\.id) == [bottomId, topId, middleId])
        #expect(state.activeLayerId == middleId)

        // The active layer is still the drawing target after the moves.
        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.endStroke()
        #expect(try state.document.activeLayerPixels().contains { $0 != 0 })
    }

    @Test("canReorderLayers is false on a sole-layer document — the panel's disabled-handle predicate")
    func canReorderLayersReadsTheSoleLayerCase() {
        let state = EditorState(width: 8, height: 8)
        // One row has nowhere to move to, so its handle renders disabled.
        #expect(!state.canReorderLayers)

        state.addLayer()
        #expect(state.canReorderLayers)

        state.removeLayer(id: state.activeLayerId)
        #expect(!state.canReorderLayers)
    }

    @Test("a panel index past either end lands at that end — the core's silent clamp, mirrored")
    func outOfRangePanelIndexClampsToTheStackEnds() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()
        let middleId = makeLayerId()
        try state.document.addLayer(newId: middleId, name: "Layer 2")
        let topId = makeLayerId()
        try state.document.addLayer(newId: topId, name: "Layer 3")

        // A drag released below the last row reports an index past the end;
        // the row lands at the panel's bottom rather than trapping on the
        // negative stack index the raw translation would produce.
        state.reorderLayer(id: topId, toPanelIndex: 99)
        #expect(state.layersInPanelOrder.map(\.id) == [middleId, bottomId, topId])

        // The same above the first row.
        state.reorderLayer(id: topId, toPanelIndex: -5)
        #expect(state.layersInPanelOrder.map(\.id) == [topId, middleId, bottomId])
    }

    @Test("reorder no-ops while a stroke is drawing: the stroke's target never moves mid-stroke")
    func reorderNoOpsWhileDrawing() {
        let (state, bottomId, topId) = makeOverlappingStack()

        state.beginStroke(at: ScreenCanvasCoords(x: 5, y: 5))
        // A second finger drags a row's handle mid-stroke (iPad multitouch) —
        // the mid-stroke seal ignores it: committing here would replace the
        // stroke's pending Edit Baseline.
        state.reorderLayer(id: topId, toPanelIndex: 1)
        #expect(state.layersInPanelOrder.map(\.id) == [topId, bottomId])
        state.endStroke()

        // The stroke's own undo entry survived intact: one undo erases the
        // stroke and leaves the pre-stroke composite.
        state.handleUndo()
        #expect(compositePixel(state, x: 5, y: 5) == [0x00, 0x00, 0x00, 0x00])
        #expect(compositePixel(state, x: 2, y: 2) == red)
    }
}
