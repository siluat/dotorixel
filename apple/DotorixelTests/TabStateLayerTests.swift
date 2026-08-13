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

    @Test("setting a Reference Layer imports it bottom-most and makes the operation undoable")
    func setReferenceLayerAddsBottomMostAndIsUndoable() throws {
        let state = Workspace(width: 8, height: 4)
        let pixelLayerId = state.activeTab.document.activeLayerId()
        let source = ReferenceImageSource(
            name: "guide.png",
            rgba: Data([0xFF, 0, 0, 0xFF, 0, 0, 0xFF, 0xFF]),
            width: 2,
            height: 1
        )

        try state.activeTab.setReferenceLayer(source)

        let layers = state.activeTab.document.layers()
        #expect(layers.map(\.kind) == [.reference, .pixel])
        #expect(layers[0].name == "guide.png")
        #expect(state.activeTab.document.activeLayerId() == layers[0].id)
        #expect(state.activeTab.layersInPanelOrder.map(\.id) == [pixelLayerId, layers[0].id])

        state.activeTab.handleUndo()
        #expect(state.activeTab.document.layers().map(\.id) == [pixelLayerId])
        #expect(!state.activeTab.canUndo)
    }

    @Test("a second Reference import replaces the singleton and resets fit placement")
    func secondReferenceImportReplacesAndResetsPlacement() throws {
        let state = Workspace(width: 8, height: 4)
        try state.activeTab.setReferenceLayer(ReferenceImageSource(
            name: "first.png",
            rgba: Data(repeating: 0x11, count: 2 * 2 * 4),
            width: 2,
            height: 2
        ))
        let firstId = state.activeTab.document.activeLayerId()
        try state.activeTab.document.setReferencePlacement(
            id: firstId,
            placement: AppleReferencePlacementUpdate(x: 7, y: 9, scale: 3)
        )

        try state.activeTab.setReferenceLayer(ReferenceImageSource(
            name: "second.png",
            rgba: Data(repeating: 0x22, count: 4 * 1 * 4),
            width: 4,
            height: 1
        ))

        let layers = state.activeTab.document.layers()
        #expect(layers.map(\.kind) == [.reference, .pixel])
        #expect(layers[0].name == "second.png")
        #expect(state.activeTab.document.layerSourcePixelsAt(stackIndex: 0) == Data(repeating: 0x22, count: 16))
        #expect(state.activeTab.document.layerPlacementAt(stackIndex: 0) == AppleReferencePlacement(
            x: 2,
            y: 1.5,
            scale: 1,
            rotation: 0
        ))

        state.activeTab.handleUndo()
        #expect(state.activeTab.document.layers()[0].name == "first.png")
        #expect(state.activeTab.document.layerPlacementAt(stackIndex: 0) == AppleReferencePlacement(
            x: 7,
            y: 9,
            scale: 3,
            rotation: 0
        ))
    }

    @Test("deleting the Reference removes its underlay and undo restores the row and source")
    func deleteReferenceIsUndoable() throws {
        let state = Workspace(width: 4, height: 4)
        let source = Data([0x10, 0x20, 0x30, 0xFF])
        try state.activeTab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: source,
            width: 1,
            height: 1
        ))
        let referenceId = state.activeTab.document.activeLayerId()

        state.activeTab.removeLayer(id: referenceId)
        #expect(state.activeTab.referenceLayerUnderlay == nil)
        #expect(state.activeTab.document.layers().map(\.kind) == [.pixel])

        state.activeTab.handleUndo()
        #expect(state.activeTab.referenceLayerUnderlay?.sourceRgba == source)
        #expect(state.activeTab.layersInPanelOrder.last?.id == referenceId)
    }

    @Test("deleting the Reference releases its cached source")
    func deleteReferenceClearsSourceCache() throws {
        let state = Workspace(width: 4, height: 4)
        let originalSource = Data([0x10, 0x20, 0x30, 0xFF])
        try state.activeTab.setReferenceLayer(ReferenceImageSource(
            name: "original.png",
            rgba: originalSource,
            width: 1,
            height: 1
        ))
        let referenceId = state.activeTab.document.activeLayerId()
        #expect(state.activeTab.referenceLayerUnderlay?.sourceRgba == originalSource)

        state.activeTab.removeLayer(id: referenceId)

        // Reusing the id makes stale cache retention observable without
        // exposing cache internals through TabState's production interface.
        let replacementSource = Data([0x40, 0x50, 0x60, 0xFF])
        try state.activeTab.document.addReferenceLayer(
            newId: referenceId,
            name: "replacement.png",
            sourceRgba: replacementSource,
            sourceWidth: 1,
            sourceHeight: 1
        )
        #expect(state.activeTab.referenceLayerUnderlay?.sourceRgba == replacementSource)
    }

    @Test("the last Pixel Layer cannot be deleted while a Reference is present")
    func finalPixelLayerCannotBeDeletedBehindReference() throws {
        let state = Workspace(width: 4, height: 4)
        let pixelLayerId = state.activeTab.document.activeLayerId()
        try state.activeTab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: Data([0, 0, 0, 0xFF]),
            width: 1,
            height: 1
        ))

        #expect(!state.activeTab.canRemoveLayer(id: pixelLayerId))
        state.activeTab.removeLayer(id: pixelLayerId)
        #expect(state.activeTab.document.layers().map(\.kind) == [.reference, .pixel])
        // The only history entry is still the Reference import: one undo
        // removes it and restores the original Pixel-only stack. The rejected
        // Pixel removal added no entry of its own.
        state.activeTab.handleUndo()
        #expect(state.activeTab.document.layers().map(\.kind) == [.pixel])
        #expect(!state.activeTab.canUndo)
    }

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

    @Test("canRemoveLayer answers the panel affordance for the addressed row")
    func canRemoveLayerReadsPerRowGuard() throws {
        let state = Workspace(width: 8, height: 8)
        let bottomId = state.activeTab.document.activeLayerId()
        #expect(!state.activeTab.canRemoveLayer(id: bottomId))

        state.activeTab.addLayer()
        let topId = state.activeTab.document.activeLayerId()
        #expect(state.activeTab.canRemoveLayer(id: bottomId))
        #expect(state.activeTab.canRemoveLayer(id: topId))

        state.activeTab.removeLayer(id: topId)
        #expect(!state.activeTab.canRemoveLayer(id: bottomId))
    }
}
