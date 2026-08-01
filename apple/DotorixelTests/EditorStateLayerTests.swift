import Foundation
import Testing
@testable import Dotorixel

/// Layer panel behavior on `EditorState` (issue 258): active-layer selection
/// and visibility toggling with web-parity history semantics. Multi-layer
/// fixtures are built programmatically — add/remove commands are covered by
/// `EditorStateLayerAddRemoveTests` (issue 259).
@Suite("EditorState — layer panel")
struct EditorStateLayerTests {

    /// Reads one RGBA pixel of the *active* layer's buffer.
    private func activeLayerPixel(
        _ state: EditorState, x: UInt32, y: UInt32
    ) throws -> [UInt8] {
        let pixels = try state.document.activeLayerPixels()
        let offset = Int((y * state.document.width() + x) * 4)
        return Array(pixels[offset..<offset + 4])
    }

    @Test("setActiveLayer switches the drawing target: a stroke lands on the tapped layer and nowhere else")
    func setActiveLayerSwitchesDrawingTarget() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()
        let topId = makeLayerId()
        try state.document.addLayer(newId: topId, name: "Layer 2")
        #expect(state.document.activeLayerId() == topId)

        state.setActiveLayer(id: bottomId)
        #expect(state.document.activeLayerId() == bottomId)

        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.endStroke()

        // The stroke landed on the re-activated bottom layer…
        #expect(try activeLayerPixel(state, x: 2, y: 2) == [0x00, 0x00, 0x00, 0xFF])

        // …and nowhere else: the top layer's buffer stayed transparent.
        state.setActiveLayer(id: topId)
        #expect(try state.document.activeLayerPixels().allSatisfy { $0 == 0 })
    }

    @Test("set-active records no history entry and no-ops on the already-active row")
    func setActiveRecordsNoHistoryAndNoOpsOnActiveRow() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()
        try state.document.addLayer(newId: makeLayerId(), name: "Layer 2")

        state.setActiveLayer(id: bottomId)

        // Not undoable (web parity: persisted-UI mutation, never a History entry).
        #expect(!state.canUndo)

        // Tapping the already-active row is a full no-op — no re-render signal.
        let versionBefore = state.canvasVersion
        state.setActiveLayer(id: bottomId)
        #expect(state.canvasVersion == versionBefore)
    }

    @Test("set-active no-ops while a stroke is drawing: the stroke's target never switches mid-stroke")
    func setActiveNoOpsWhileDrawing() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()
        let topId = makeLayerId()
        try state.document.addLayer(newId: topId, name: "Layer 2")

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.setActiveLayer(id: bottomId)
        #expect(state.document.activeLayerId() == topId)
        state.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        state.endStroke()

        // The whole stroke landed on the layer it began on.
        #expect(try activeLayerPixel(state, x: 1, y: 1) == [0x00, 0x00, 0x00, 0xFF])
        #expect(try activeLayerPixel(state, x: 3, y: 1) == [0x00, 0x00, 0x00, 0xFF])
        state.setActiveLayer(id: bottomId)
        #expect(try state.document.activeLayerPixels().allSatisfy { $0 == 0 })
    }

    @Test("the eye toggle removes the layer from the composite and records one undo entry; undo restores the visibility")
    func visibilityToggleUpdatesCompositeAndRecordsOneUndoEntry() throws {
        let state = EditorState(width: 8, height: 8)
        let layerId = state.document.activeLayerId()
        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.endStroke()
        #expect(paintedPixelCount(state) == 1)

        state.setLayerVisibility(id: layerId, visible: false)

        // The hidden layer drops out of the composite immediately…
        #expect(paintedPixelCount(state) == 0)
        #expect(state.document.layers()[0].visible == false)

        // …and exactly one undo entry was recorded: one undo restores the
        // visibility while the stroke's pixel (the older entry) survives.
        state.handleUndo()
        #expect(state.document.layers()[0].visible)
        #expect(paintedPixelCount(state) == 1)
    }

    @Test("the eye no-ops while a stroke is drawing: the stroke's pending baseline is never disturbed")
    func visibilityToggleNoOpsWhileDrawing() throws {
        let state = EditorState(width: 8, height: 8)
        let layerId = state.document.activeLayerId()

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        // A second finger taps the eye mid-stroke (iPad multitouch) — the
        // mid-stroke seal ignores it; committing here would replace the
        // stroke's pending Edit Baseline.
        state.setLayerVisibility(id: layerId, visible: false)
        #expect(state.document.layers()[0].visible)
        state.endStroke()

        // The stroke's own undo entry survived intact: one undo erases the
        // whole stroke and empties the stack.
        state.handleUndo()
        #expect(paintedPixelCount(state) == 0)
        #expect(!state.canUndo)
    }

    @Test("a no-op visibility change records nothing and leaves the redo future intact")
    func noOpVisibilityChangeRecordsNothing() throws {
        let state = EditorState(width: 8, height: 8)
        let layerId = state.document.activeLayerId()
        state.setLayerVisibility(id: layerId, visible: false)
        state.handleUndo()
        #expect(state.canRedo)

        // Re-asserting the current visibility is a no-op: no entry, no
        // re-render signal, and the redo future (the undone hide) survives.
        let versionBefore = state.canvasVersion
        state.setLayerVisibility(id: layerId, visible: true)
        #expect(state.canvasVersion == versionBefore)
        #expect(!state.canUndo)
        #expect(state.canRedo)
    }

    @Test("a hidden layer stays selectable and drawable")
    func hiddenLayerStaysSelectableAndDrawable() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()
        try state.document.addLayer(newId: makeLayerId(), name: "Layer 2")

        state.setLayerVisibility(id: bottomId, visible: false)
        state.setActiveLayer(id: bottomId)
        #expect(state.document.activeLayerId() == bottomId)

        state.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.endStroke()

        // The paint landed on the hidden layer's own buffer…
        #expect(try activeLayerPixel(state, x: 4, y: 4) == [0x00, 0x00, 0x00, 0xFF])
        // …while the composite keeps excluding it.
        #expect(paintedPixelCount(state) == 0)
    }

    @Test("layersInPanelOrder lists the stack top-first — the order the panel renders")
    func layersInPanelOrderListsStackTopFirst() throws {
        let state = EditorState(width: 8, height: 8)
        try state.document.addLayer(newId: makeLayerId(), name: "Layer 2")
        try state.document.addLayer(newId: makeLayerId(), name: "Layer 3")

        // `layers()` is stack order (bottom-first); the panel shows the
        // top of the stack at the top of the list.
        #expect(state.layersInPanelOrder.map(\.name) == ["Layer 3", "Layer 2", "Layer 1"])
    }
}

/// Layer add/remove commands on `EditorState` (issue 259): the panel's add
/// and per-row remove actions with web-parity history semantics.
@Suite("EditorState — layer add/remove")
struct EditorStateLayerAddRemoveTests {

    @Test("addLayer inserts a transparent layer directly above the active layer and makes it active")
    func addLayerInsertsTransparentLayerAboveActiveAndActivates() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()

        state.addLayer()

        // Stack order is bottom-first: the original layer keeps index 0 and
        // the new layer sits directly above it as the new drawing target.
        let layers = state.document.layers()
        #expect(layers.map(\.id) == [bottomId, state.document.activeLayerId()])
        #expect(state.document.activeLayerId() != bottomId)

        // The new layer starts fully transparent.
        #expect(try state.document.activeLayerPixels().allSatisfy { $0 == 0 })
    }

    @Test("addLayer records exactly one undo entry: one undo restores the pre-add document")
    func addLayerRecordsExactlyOneUndoEntry() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()

        state.addLayer()

        // One undo restores the pre-add document — single layer, original
        // active pointer — and empties the stack (exactly one entry).
        state.handleUndo()
        #expect(state.document.layers().map(\.id) == [bottomId])
        #expect(state.document.activeLayerId() == bottomId)
        #expect(!state.canUndo)

        // Redo brings the added layer back as the active drawing target.
        state.handleRedo()
        #expect(state.document.layers().count == 2)
        #expect(state.document.activeLayerId() == state.document.layers()[1].id)
    }

    @Test("addLayer no-ops while a stroke is drawing: the stroke's target never switches mid-stroke")
    func addLayerNoOpsWhileDrawing() throws {
        let state = EditorState(width: 8, height: 8)

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        // A second finger taps the add button mid-stroke (iPad multitouch) —
        // the mid-stroke seal ignores it: admitting it would both switch the
        // stroke's target to the new layer and replace the stroke's pending
        // Edit Baseline.
        state.addLayer()
        #expect(state.document.layers().count == 1)
        state.endStroke()

        // The stroke's own undo entry survived intact.
        state.handleUndo()
        #expect(paintedPixelCount(state) == 0)
        #expect(!state.canUndo)
    }

    @Test("layer names count monotonically — a removed layer's number is never reused")
    func layerNamesCountMonotonically() throws {
        let state = EditorState(width: 8, height: 8)

        state.addLayer()
        let secondId = state.document.activeLayerId()
        #expect(state.document.layers().map(\.name) == ["Layer 1", "Layer 2"])

        // Web parity: the document's layer counter never decrements, so
        // names stay unique across the document's lifetime.
        try state.document.removeLayer(id: secondId)
        state.addLayer()
        #expect(state.document.layers().map(\.name) == ["Layer 1", "Layer 3"])
    }

    @Test("removeLayer deletes the active layer: the active pointer moves to an adjacent layer and its pixels leave the composite")
    func removeActiveLayerMovesPointerAndDropsPixelsFromComposite() throws {
        let state = EditorState(width: 8, height: 8)
        let bottomId = state.document.activeLayerId()
        state.addLayer()
        let topId = state.document.activeLayerId()

        // Draw on the top (active) layer so the composite has its pixel.
        state.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.endStroke()
        #expect(paintedPixelCount(state) == 1)

        state.removeLayer(id: topId)

        // The layer is gone, the active pointer moved to the adjacent layer
        // (delegated to the core), and the composite dropped its pixels.
        #expect(state.document.layers().map(\.id) == [bottomId])
        #expect(state.document.activeLayerId() == bottomId)
        #expect(paintedPixelCount(state) == 0)
    }

    @Test("undoing a remove restores the removed layer with its pixels, stack position, and active state")
    func undoRemoveRestoresLayerPixelsPositionAndActiveState() throws {
        let state = EditorState(width: 8, height: 8)
        state.addLayer()
        let middleId = state.document.activeLayerId()
        state.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.endStroke()
        state.addLayer()
        state.setActiveLayer(id: middleId)
        let stackBefore = state.document.layers().map(\.id)

        state.removeLayer(id: middleId)
        #expect(state.document.layers().count == 2)

        // One undo restores the removed mid-stack layer in place: same stack
        // order, same active pointer, pixels back in the composite.
        state.handleUndo()
        #expect(state.document.layers().map(\.id) == stackBefore)
        #expect(state.document.activeLayerId() == middleId)
        #expect(paintedPixelCount(state) == 1)
        #expect(try state.document.activeLayerPixels().contains { $0 != 0 })

        // The remove recorded exactly one entry: the next undo peels the
        // second add, not another remove-restore.
        state.handleUndo()
        #expect(state.document.layers().count == 2)
    }

    @Test("the sole-layer guard: removing the last remaining layer no-ops and records no history entry")
    func removingLastLayerNoOpsAndRecordsNothing() throws {
        let state = EditorState(width: 8, height: 8)
        let onlyId = state.document.activeLayerId()

        let versionBefore = state.canvasVersion
        state.removeLayer(id: onlyId)

        // The layer survives, nothing was recorded, and no re-render signal
        // fired — the guard branch is history-clean (web parity).
        #expect(state.document.layers().map(\.id) == [onlyId])
        #expect(!state.canUndo)
        #expect(state.canvasVersion == versionBefore)
    }

    @Test("removeLayer no-ops while a stroke is drawing: a live stroke's target must not vanish mid-stroke")
    func removeLayerNoOpsWhileDrawing() throws {
        let state = EditorState(width: 8, height: 8)
        state.addLayer()
        let topId = state.document.activeLayerId()

        state.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        // A second finger taps the row's remove button mid-stroke (iPad
        // multitouch) — the mid-stroke seal ignores it (web parity).
        state.removeLayer(id: topId)
        #expect(state.document.layers().count == 2)
        state.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        state.endStroke()

        // The whole stroke landed on the layer it began on.
        #expect(try state.document.activeLayerPixels().contains { $0 != 0 })
        #expect(state.document.activeLayerId() == topId)
    }

    @Test("canRemoveLayer reads the sole-layer guard — the panel's disabled-affordance predicate")
    func canRemoveLayerReadsSoleLayerGuard() throws {
        let state = EditorState(width: 8, height: 8)
        #expect(!state.canRemoveLayer)

        state.addLayer()
        #expect(state.canRemoveLayer)

        state.removeLayer(id: state.document.activeLayerId())
        #expect(!state.canRemoveLayer)
    }
}
