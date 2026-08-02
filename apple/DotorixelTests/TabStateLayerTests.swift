import Foundation
import Testing
@testable import Dotorixel

/// Layer panel behavior on `TabState` (issue 258): active-layer selection
/// and visibility toggling with web-parity history semantics. Multi-layer
/// fixtures are built programmatically — add/remove commands are covered by
/// `TabStateLayerAddRemoveTests` (issue 259).
@Suite("TabState — layer panel")
struct TabStateLayerTests {

    /// Reads one RGBA pixel of the *active* layer's buffer.
    private func activeLayerPixel(
        _ tab: TabState, x: UInt32, y: UInt32
    ) throws -> [UInt8] {
        let pixels = try tab.document.activeLayerPixels()
        let offset = Int((y * tab.document.width() + x) * 4)
        return Array(pixels[offset..<offset + 4])
    }

    @Test("setActiveLayer switches the drawing target: a stroke lands on the tapped layer and nowhere else")
    func setActiveLayerSwitchesDrawingTarget() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        let topId = makeLayerId()
        try state.activeTab.document.addLayer(newId: topId, name: "Layer 2")
        #expect(state.activeTab.document.activeLayerId() == topId)

        state.activeTab.setActiveLayer(id: bottomId)
        #expect(state.activeTab.document.activeLayerId() == bottomId)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()

        // The stroke landed on the re-activated bottom layer…
        #expect(try activeLayerPixel(state.activeTab, x: 2, y: 2) == [0x00, 0x00, 0x00, 0xFF])

        // …and nowhere else: the top layer's buffer stayed transparent.
        state.activeTab.setActiveLayer(id: topId)
        #expect(try state.activeTab.document.activeLayerPixels().allSatisfy { $0 == 0 })
    }

    @Test("set-active records no history entry and no-ops on the already-active row")
    func setActiveRecordsNoHistoryAndNoOpsOnActiveRow() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        try state.activeTab.document.addLayer(newId: makeLayerId(), name: "Layer 2")

        state.activeTab.setActiveLayer(id: bottomId)

        // Not undoable (web parity: persisted-UI mutation, never a History entry).
        #expect(!state.activeTab.canUndo)

        // Tapping the already-active row is a full no-op — no re-render signal.
        let versionBefore = state.activeTab.canvasVersion
        state.activeTab.setActiveLayer(id: bottomId)
        #expect(state.activeTab.canvasVersion == versionBefore)
    }

    @Test("set-active no-ops while a stroke is drawing: the stroke's target never switches mid-stroke")
    func setActiveNoOpsWhileDrawing() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        let topId = makeLayerId()
        try state.activeTab.document.addLayer(newId: topId, name: "Layer 2")

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        state.activeTab.setActiveLayer(id: bottomId)
        #expect(state.activeTab.document.activeLayerId() == topId)
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        state.activeTab.endStroke()

        // The whole stroke landed on the layer it began on.
        #expect(try activeLayerPixel(state.activeTab, x: 1, y: 1) == [0x00, 0x00, 0x00, 0xFF])
        #expect(try activeLayerPixel(state.activeTab, x: 3, y: 1) == [0x00, 0x00, 0x00, 0xFF])
        state.activeTab.setActiveLayer(id: bottomId)
        #expect(try state.activeTab.document.activeLayerPixels().allSatisfy { $0 == 0 })
    }

    @Test("the eye toggle removes the layer from the composite and records one undo entry; undo restores the visibility")
    func visibilityToggleUpdatesCompositeAndRecordsOneUndoEntry() throws {
        let state = Workspace(width: 8, height: 8)
        let layerId = state.activeTab.document.activeLayerId()
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()
        #expect(paintedPixelCount(state.activeTab) == 1)

        state.activeTab.setLayerVisibility(id: layerId, visible: false)

        // The hidden layer drops out of the composite immediately…
        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(state.activeTab.document.layers()[0].visible == false)

        // …and exactly one undo entry was recorded: one undo restores the
        // visibility while the stroke's pixel (the older entry) survives.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.layers()[0].visible)
        #expect(paintedPixelCount(state.activeTab) == 1)
    }

    @Test("the eye no-ops while a stroke is drawing: the stroke's pending baseline is never disturbed")
    func visibilityToggleNoOpsWhileDrawing() throws {
        let state = Workspace(width: 8, height: 8)
        let layerId = state.activeTab.document.activeLayerId()

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        // A second finger taps the eye mid-stroke (iPad multitouch) — the
        // mid-stroke seal ignores it; committing here would replace the
        // stroke's pending Edit Baseline.
        state.activeTab.setLayerVisibility(id: layerId, visible: false)
        #expect(state.activeTab.document.layers()[0].visible)
        state.activeTab.endStroke()

        // The stroke's own undo entry survived intact: one undo erases the
        // whole stroke and empties the stack.
        state.activeTab.handleUndo()
        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(!state.activeTab.canUndo)
    }

    @Test("a no-op visibility change records nothing and leaves the redo future intact")
    func noOpVisibilityChangeRecordsNothing() throws {
        let state = Workspace(width: 8, height: 8)
        let layerId = state.activeTab.document.activeLayerId()
        state.activeTab.setLayerVisibility(id: layerId, visible: false)
        state.activeTab.handleUndo()
        #expect(state.activeTab.canRedo)

        // Re-asserting the current visibility is a no-op: no entry, no
        // re-render signal, and the redo future (the undone hide) survives.
        let versionBefore = state.activeTab.canvasVersion
        state.activeTab.setLayerVisibility(id: layerId, visible: true)
        #expect(state.activeTab.canvasVersion == versionBefore)
        #expect(!state.activeTab.canUndo)
        #expect(state.activeTab.canRedo)
    }

    @Test("a hidden layer stays selectable and drawable")
    func hiddenLayerStaysSelectableAndDrawable() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        try state.activeTab.document.addLayer(newId: makeLayerId(), name: "Layer 2")

        state.activeTab.setLayerVisibility(id: bottomId, visible: false)
        state.activeTab.setActiveLayer(id: bottomId)
        #expect(state.activeTab.document.activeLayerId() == bottomId)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 4, y: 4))
        state.activeTab.endStroke()

        // The paint landed on the hidden layer's own buffer…
        #expect(try activeLayerPixel(state.activeTab, x: 4, y: 4) == [0x00, 0x00, 0x00, 0xFF])
        // …while the composite keeps excluding it.
        #expect(paintedPixelCount(state.activeTab) == 0)
    }

    @Test("layersInPanelOrder lists the stack top-first — the order the panel renders")
    func layersInPanelOrderListsStackTopFirst() throws {
        let state = Workspace(width: 8, height: 8)
        try state.activeTab.document.addLayer(newId: makeLayerId(), name: "Layer 2")
        try state.activeTab.document.addLayer(newId: makeLayerId(), name: "Layer 3")

        // `layers()` is stack order (bottom-first); the panel shows the
        // top of the stack at the top of the list.
        #expect(state.activeTab.layersInPanelOrder.map(\.name) == ["Layer 3", "Layer 2", "Layer 1"])
    }
}

/// Layer add/remove commands on `TabState` (issue 259): the panel's add
/// and per-row remove actions with web-parity history semantics.
@Suite("TabState — layer add/remove")
struct TabStateLayerAddRemoveTests {

    @Test("addLayer inserts a transparent layer directly above the active layer and makes it active")
    func addLayerInsertsTransparentLayerAboveActiveAndActivates() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()

        state.activeTab.addLayer()

        // Stack order is bottom-first: the original layer keeps index 0 and
        // the new layer sits directly above it as the new drawing target.
        let layers = state.activeTab.document.layers()
        #expect(layers.map(\.id) == [bottomId, state.activeTab.document.activeLayerId()])
        #expect(state.activeTab.document.activeLayerId() != bottomId)

        // The new layer starts fully transparent.
        #expect(try state.activeTab.document.activeLayerPixels().allSatisfy { $0 == 0 })
    }

    @Test("addLayer records exactly one undo entry: one undo restores the pre-add document")
    func addLayerRecordsExactlyOneUndoEntry() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()

        state.activeTab.addLayer()

        // One undo restores the pre-add document — single layer, original
        // active pointer — and empties the stack (exactly one entry).
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.layers().map(\.id) == [bottomId])
        #expect(state.activeTab.document.activeLayerId() == bottomId)
        #expect(!state.activeTab.canUndo)

        // Redo brings the added layer back as the active drawing target.
        state.activeTab.handleRedo()
        #expect(state.activeTab.document.layers().count == 2)
        #expect(state.activeTab.document.activeLayerId() == state.activeTab.document.layers()[1].id)
    }

    @Test("addLayer no-ops while a stroke is drawing: the stroke's target never switches mid-stroke")
    func addLayerNoOpsWhileDrawing() throws {
        let state = Workspace(width: 8, height: 8)

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        // A second finger taps the add button mid-stroke (iPad multitouch) —
        // the mid-stroke seal ignores it: admitting it would both switch the
        // stroke's target to the new layer and replace the stroke's pending
        // Edit Baseline.
        state.activeTab.addLayer()
        #expect(state.activeTab.document.layers().count == 1)
        state.activeTab.endStroke()

        // The stroke's own undo entry survived intact.
        state.activeTab.handleUndo()
        #expect(paintedPixelCount(state.activeTab) == 0)
        #expect(!state.activeTab.canUndo)
    }

    @Test("layer names count monotonically — a removed layer's number is never reused")
    func layerNamesCountMonotonically() throws {
        let state = Workspace(width: 8, height: 8)

        state.activeTab.addLayer()
        let secondId = state.activeTab.document.activeLayerId()
        #expect(state.activeTab.document.layers().map(\.name) == ["Layer 1", "Layer 2"])

        // Web parity: the document's layer counter never decrements, so
        // names stay unique across the document's lifetime.
        try state.activeTab.document.removeLayer(id: secondId)
        state.activeTab.addLayer()
        #expect(state.activeTab.document.layers().map(\.name) == ["Layer 1", "Layer 3"])
    }

    @Test("removeLayer deletes the active layer: the active pointer moves to an adjacent layer and its pixels leave the composite")
    func removeActiveLayerMovesPointerAndDropsPixelsFromComposite() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        state.activeTab.addLayer()
        let topId = state.activeTab.document.activeLayerId()

        // Draw on the top (active) layer so the composite has its pixel.
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 2, y: 2))
        state.activeTab.endStroke()
        #expect(paintedPixelCount(state.activeTab) == 1)

        state.activeTab.removeLayer(id: topId)

        // The layer is gone, the active pointer moved to the adjacent layer
        // (delegated to the core), and the composite dropped its pixels.
        #expect(state.activeTab.document.layers().map(\.id) == [bottomId])
        #expect(state.activeTab.document.activeLayerId() == bottomId)
        #expect(paintedPixelCount(state.activeTab) == 0)
    }

    @Test("undoing a remove restores the removed layer with its pixels, stack position, and active state")
    func undoRemoveRestoresLayerPixelsPositionAndActiveState() throws {
        let state = Workspace(width: 8, height: 8)
        state.activeTab.addLayer()
        let middleId = state.activeTab.document.activeLayerId()
        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 3))
        state.activeTab.endStroke()
        state.activeTab.addLayer()
        state.activeTab.setActiveLayer(id: middleId)
        let stackBefore = state.activeTab.document.layers().map(\.id)

        state.activeTab.removeLayer(id: middleId)
        #expect(state.activeTab.document.layers().count == 2)

        // One undo restores the removed mid-stack layer in place: same stack
        // order, same active pointer, pixels back in the composite.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.layers().map(\.id) == stackBefore)
        #expect(state.activeTab.document.activeLayerId() == middleId)
        #expect(paintedPixelCount(state.activeTab) == 1)
        #expect(try state.activeTab.document.activeLayerPixels().contains { $0 != 0 })

        // The remove recorded exactly one entry: the next undo peels the
        // second add, not another remove-restore.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.layers().count == 2)
    }

    @Test("the sole-layer guard: removing the last remaining layer no-ops and records no history entry")
    func removingLastLayerNoOpsAndRecordsNothing() throws {
        let state = Workspace(width: 8, height: 8)
        let onlyId = state.activeTab.document.activeLayerId()

        let versionBefore = state.activeTab.canvasVersion
        state.activeTab.removeLayer(id: onlyId)

        // The layer survives, nothing was recorded, and no re-render signal
        // fired — the guard branch is history-clean (web parity).
        #expect(state.activeTab.document.layers().map(\.id) == [onlyId])
        #expect(!state.activeTab.canUndo)
        #expect(state.activeTab.canvasVersion == versionBefore)
    }

    @Test("removeLayer no-ops while a stroke is drawing: a live stroke's target must not vanish mid-stroke")
    func removeLayerNoOpsWhileDrawing() throws {
        let state = Workspace(width: 8, height: 8)
        state.activeTab.addLayer()
        let topId = state.activeTab.document.activeLayerId()

        state.activeTab.beginStroke(at: ScreenCanvasCoords(x: 1, y: 1))
        // A second finger taps the row's remove button mid-stroke (iPad
        // multitouch) — the mid-stroke seal ignores it (web parity).
        state.activeTab.removeLayer(id: topId)
        #expect(state.activeTab.document.layers().count == 2)
        state.activeTab.continueStroke(to: ScreenCanvasCoords(x: 3, y: 1))
        state.activeTab.endStroke()

        // The whole stroke landed on the layer it began on.
        #expect(try state.activeTab.document.activeLayerPixels().contains { $0 != 0 })
        #expect(state.activeTab.document.activeLayerId() == topId)
    }

    @Test("canRemoveLayer reads the sole-layer guard — the panel's disabled-affordance predicate")
    func canRemoveLayerReadsSoleLayerGuard() throws {
        let state = Workspace(width: 8, height: 8)
        #expect(!state.activeTab.canRemoveLayer)

        state.activeTab.addLayer()
        #expect(state.activeTab.canRemoveLayer)

        state.activeTab.removeLayer(id: state.activeTab.document.activeLayerId())
        #expect(!state.activeTab.canRemoveLayer)
    }
}
