import Foundation
import Testing
@testable import Dotorixel

/// Binding-level tests for `AppleDocument` / `AppleDocumentHistory` FFI methods.
///
/// The Document model and DocumentHistory algorithms are unit-tested in the
/// Rust core; these prove the new layer-aware surface is callable across the
/// UniFFI boundary and marshals correctly — including the round-trips the
/// Phase 3 editor swap (issue 257) will rely on.
@Suite("Document FFI bindings")
struct DocumentBindingsTests {

    @Test("a new document reports its dimensions and a single visible active pixel layer")
    func newDocumentShape() throws {
        let layerId = UUID().uuidString
        let doc = try AppleDocument(width: 8, height: 4, firstLayerId: layerId, firstLayerName: "Layer 1")

        #expect(doc.width() == 8)
        #expect(doc.height() == 4)

        let layers = doc.layers()
        #expect(layers.count == 1)
        // Layer ids normalize to lowercase across the FFI boundary
        // (Rust `Uuid::to_string()` emits lowercase hex).
        #expect(layers[0].id == layerId.lowercased())
        #expect(layers[0].name == "Layer 1")
        #expect(layers[0].visible)
        #expect(layers[0].kind == .pixel)

        #expect(doc.activeLayerId() == layerId.lowercased())
        #expect(doc.nextLayerNumber() == 2)
    }

    @Test("a tool op draws into the active layer and the composite reflects it")
    func toolOpReachesComposite() throws {
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1")
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

        #expect(doc.applyTool(x: 1, y: 2, tool: .pencil, foregroundColor: red))

        #expect(try doc.getPixel(x: 1, y: 2) == red)

        // Composite is RGBA row-major: pixel (1, 2) starts at (2 * 4 + 1) * 4.
        let composite = doc.composite()
        #expect(composite.count == 4 * 4 * 4)
        let offset = (2 * 4 + 1) * 4
        #expect(Array(composite[offset..<offset + 4]) == [0xFF, 0x00, 0x00, 0xFF])
    }

    @Test("set pixel, flood fill, and clear round-trip on the active layer")
    func drawingOpsRoundTrip() throws {
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1")
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)
        let transparent = Color(r: 0x00, g: 0x00, b: 0x00, a: 0x00)

        try doc.setPixel(x: 0, y: 0, color: red)
        #expect(try doc.getPixel(x: 0, y: 0) == red)

        // The remaining transparent region is 4-connected around the red dot.
        #expect(doc.floodFill(x: 2, y: 2, fillColor: blue))
        #expect(try doc.getPixel(x: 3, y: 3) == blue)
        #expect(try doc.getPixel(x: 0, y: 0) == red)

        // Negative coordinates short-circuit to false, like ApplePixelCanvas.
        #expect(!doc.floodFill(x: -1, y: 0, fillColor: blue))

        doc.clear()
        #expect(try doc.getPixel(x: 0, y: 0) == transparent)
        #expect(try doc.getPixel(x: 3, y: 3) == transparent)
    }

    @Test("add inserts above the active layer and becomes active; remove surfaces the sole-layer error and moves the active pointer")
    func addRemoveSetActiveRoundTrip() throws {
        let baseId = makeLayerId()
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: baseId, firstLayerName: "Layer 1")

        // A document must always keep at least one layer.
        #expect(throws: AppleError.self) {
            try doc.removeLayer(id: baseId)
        }

        let secondId = makeLayerId()
        try doc.addLayer(newId: secondId, name: "Layer 2")
        #expect(doc.layers().map(\.id) == [baseId, secondId])
        #expect(doc.activeLayerId() == secondId)
        #expect(doc.nextLayerNumber() == 3)

        // Insert lands directly above the *active* layer, not at the top.
        try doc.setActiveLayer(id: baseId)
        let thirdId = makeLayerId()
        try doc.addLayer(newId: thirdId, name: "Layer 3")
        #expect(doc.layers().map(\.id) == [baseId, thirdId, secondId])
        #expect(doc.activeLayerId() == thirdId)

        // Removing the active layer moves the pointer to the layer below.
        try doc.removeLayer(id: thirdId)
        #expect(doc.layers().map(\.id) == [baseId, secondId])
        #expect(doc.activeLayerId() == baseId)

        // Unknown ids error without mutating the active pointer.
        #expect(throws: AppleError.self) {
            try doc.setActiveLayer(id: UUID().uuidString)
        }
        #expect(doc.activeLayerId() == baseId)
    }

    @Test("visibility and reorder round-trip; the active pointer survives reordering")
    func visibilityReorderRoundTrip() throws {
        let aId = makeLayerId()
        let bId = makeLayerId()
        let cId = makeLayerId()
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: aId, firstLayerName: "Layer 1")
        try doc.addLayer(newId: bId, name: "Layer 2")
        try doc.addLayer(newId: cId, name: "Layer 3")
        #expect(doc.layers().map(\.id) == [aId, bId, cId])
        #expect(doc.activeLayerId() == cId)

        // Visibility round-trips and does not affect activity.
        try doc.setLayerVisibility(id: aId, visible: false)
        #expect(doc.layers().map(\.visible) == [false, true, true])
        #expect(doc.activeLayerId() == cId)
        try doc.setLayerVisibility(id: aId, visible: true)
        #expect(doc.layers().map(\.visible) == [true, true, true])

        // Reorder moves the layer; the active pointer is tracked by id.
        try doc.reorderLayer(id: cId, newIndex: 0)
        #expect(doc.layers().map(\.id) == [cId, aId, bId])
        #expect(doc.activeLayerId() == cId)

        // An out-of-range index clamps to the top of the stack.
        try doc.reorderLayer(id: cId, newIndex: 99)
        #expect(doc.layers().map(\.id) == [aId, bId, cId])
    }

    @Test("resize with anchor keeps anchored content and reports the new dimensions")
    func resizeWithAnchor() throws {
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1")
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try doc.setPixel(x: 0, y: 0, color: red)

        try doc.resize(newWidth: 2, newHeight: 2, anchor: .topLeft)

        #expect(doc.width() == 2)
        #expect(doc.height() == 2)
        #expect(try doc.getPixel(x: 0, y: 0) == red)
        #expect(doc.composite().count == 2 * 2 * 4)
    }

    @Test("the export composite and its PNG encoding cross the boundary")
    func exportPath() throws {
        let doc = try AppleDocument(width: 2, height: 2, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1")
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))

        let export = doc.compositeForExport()
        #expect(export.count == 2 * 2 * 4)
        #expect(Array(export[0..<4]) == [0xFF, 0x00, 0x00, 0xFF])

        // PNG signature (per the PNG spec) proves a real encode happened.
        let png = try doc.encodeExportPng()
        #expect(Array(png.prefix(8)) == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    }

    @Test("active-layer pixels snapshot and restore round-trip, leaving other layers untouched")
    func activeLayerPixelsRoundTrip() throws {
        let baseId = makeLayerId()
        let doc = try AppleDocument(width: 2, height: 2, firstLayerId: baseId, firstLayerName: "Layer 1")
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)
        try doc.setPixel(x: 0, y: 0, color: red)

        // The snapshot reads the *active* layer: a second layer on top becomes
        // active, so its buffer starts transparent, not the base layer's red.
        let snapshot = try doc.activeLayerPixels()
        #expect(snapshot.count == 2 * 2 * 4)
        #expect(Array(snapshot[0..<4]) == [0xFF, 0x00, 0x00, 0xFF])

        try doc.addLayer(newId: UUID().uuidString, name: "Layer 2")
        let topSnapshot = try doc.activeLayerPixels()
        #expect(Array(topSnapshot[0..<4]) == [0x00, 0x00, 0x00, 0x00])

        // Restore writes only the active layer; the base layer keeps its red.
        try doc.setPixel(x: 1, y: 1, color: blue)
        try doc.restoreActiveLayerPixels(data: topSnapshot)
        #expect(try doc.getPixel(x: 1, y: 1) == Color(r: 0x00, g: 0x00, b: 0x00, a: 0x00))
        try doc.setActiveLayer(id: baseId)
        #expect(try doc.getPixel(x: 0, y: 0) == red)

        // A buffer whose length is not width × height × 4 is rejected.
        #expect(throws: AppleError.self) {
            try doc.restoreActiveLayerPixels(data: Data([0x00, 0x00]))
        }
    }

    @Test("history: a no-change edit records no entry; a pixel edit undoes and redoes")
    func historyPixelEdit() throws {
        let doc = try AppleDocument(width: 2, height: 2, firstLayerId: UUID().uuidString, firstLayerName: "Layer 1")
        let history = AppleDocumentHistory.defaultHistory()
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let transparent = Color(r: 0x00, g: 0x00, b: 0x00, a: 0x00)

        // No-op edit: identical document at begin and end → nothing committed.
        history.beginEdit(document: doc)
        #expect(!history.endEdit(current: doc))
        #expect(!history.canUndo())

        // Real edit commits; undo returns the restored document.
        history.beginEdit(document: doc)
        try doc.setPixel(x: 0, y: 0, color: red)
        #expect(history.endEdit(current: doc))
        #expect(history.canUndo())

        let restored = try #require(history.undo(current: doc))
        #expect(try restored.getPixel(x: 0, y: 0) == transparent)
        #expect(history.canRedo())

        let redone = try #require(history.redo(current: restored))
        #expect(try redone.getPixel(x: 0, y: 0) == red)

        history.clear()
        #expect(!history.canUndo())
        #expect(!history.canRedo())
    }

    @Test("malformed and duplicate layer ids surface as errors without mutating the document")
    func layerIdValidation() throws {
        let baseId = makeLayerId()
        let doc = try AppleDocument(width: 2, height: 2, firstLayerId: baseId, firstLayerName: "Layer 1")

        // Both guards live only in the binding layer (`parse_layer_id`,
        // add_layer's duplicate-id check) — the Rust core tests can't reach them.
        #expect(throws: AppleError.self) {
            try doc.addLayer(newId: "not-a-uuid", name: "Layer 2")
        }
        #expect(throws: AppleError.self) {
            try doc.addLayer(newId: baseId, name: "Layer 2")
        }
        #expect(doc.layers().map(\.id) == [baseId])
        #expect(doc.nextLayerNumber() == 2)

        #expect(throws: AppleError.self) {
            _ = try AppleDocument(width: 2, height: 2, firstLayerId: "not-a-uuid", firstLayerName: "Layer 1")
        }
    }

    @Test("history restores layer structure and dimensions across undo/redo")
    func historyStructureAndResize() throws {
        let baseId = makeLayerId()
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: baseId, firstLayerName: "Layer 1")
        let history = AppleDocumentHistory.defaultHistory()

        // Edit 1 — layer-structure change.
        history.beginEdit(document: doc)
        let secondId = makeLayerId()
        try doc.addLayer(newId: secondId, name: "Layer 2")
        #expect(history.endEdit(current: doc))

        // Edit 2 — resize.
        history.beginEdit(document: doc)
        try doc.resize(newWidth: 2, newHeight: 2, anchor: .topLeft)
        #expect(history.endEdit(current: doc))

        // Undo the resize: dimensions restore with the document.
        let afterResizeUndo = try #require(history.undo(current: doc))
        #expect(afterResizeUndo.width() == 4)
        #expect(afterResizeUndo.height() == 4)
        #expect(afterResizeUndo.layers().map(\.id) == [baseId, secondId])

        // Undo the structure change: back to the single base layer.
        let afterAddUndo = try #require(history.undo(current: afterResizeUndo))
        #expect(afterAddUndo.layers().map(\.id) == [baseId])
        #expect(afterAddUndo.activeLayerId() == baseId)

        // Redo both edits in order.
        let redoneAdd = try #require(history.redo(current: afterAddUndo))
        #expect(redoneAdd.layers().map(\.id) == [baseId, secondId])
        #expect(redoneAdd.activeLayerId() == secondId)

        let redoneResize = try #require(history.redo(current: redoneAdd))
        #expect(redoneResize.width() == 2)
        #expect(redoneResize.height() == 2)
    }

    @Test("layer snapshots expose every layer's persistence fields in stack order")
    func layerSnapshotsRead() throws {
        let baseId = makeLayerId()
        let doc = try AppleDocument(width: 2, height: 2, firstLayerId: baseId, firstLayerName: "Layer 1")
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))

        let topId = makeLayerId()
        try doc.addLayer(newId: topId, name: "Layer 2")
        try doc.setLayerVisibility(id: topId, visible: false)

        let snapshots = try doc.layerSnapshots()
        #expect(snapshots.map(\.id) == [baseId, topId])
        #expect(snapshots.map(\.name) == ["Layer 1", "Layer 2"])
        #expect(snapshots.map(\.visible) == [true, false])
        #expect(snapshots.map(\.opacity) == [1.0, 1.0])

        // Unlike `activeLayerPixels`, the snapshot carries *every* layer's
        // buffer — the drawn pixel lives on the (inactive) base layer.
        #expect(snapshots.map(\.pixels.count) == [2 * 2 * 4, 2 * 2 * 4])
        #expect(Array(snapshots[0].pixels.prefix(4)) == [0xFF, 0x00, 0x00, 0xFF])
        #expect(snapshots[1].pixels.allSatisfy { $0 == 0 })

        // A document built through the editor path starts expanded.
        #expect(!doc.isTimelinePanelCollapsed())
    }

    @Test("a persisted document round-trips: snapshot reads feed the hydration constructor and everything matches")
    func snapshotHydrationRoundTrip() throws {
        let bottomId = makeLayerId()
        let topId = makeLayerId()

        // The original is itself built through the hydration constructor —
        // it is the only path that can produce non-default opacity and a
        // collapsed Timeline panel (the editor bindings expose no setters).
        var bottomPixels = Data(count: 2 * 2 * 4)
        bottomPixels.replaceSubrange(0..<4, with: [0xFF, 0x00, 0x00, 0xFF] as [UInt8])
        let original = try AppleDocument.fromLayers(
            width: 2,
            height: 2,
            layers: [
                AppleLayerSnapshot(
                    id: bottomId, name: "Layer 1", visible: true, opacity: 1.0, pixels: bottomPixels),
                AppleLayerSnapshot(
                    id: topId, name: "Layer 2", visible: false, opacity: 0.5,
                    pixels: Data(count: 2 * 2 * 4)),
            ],
            activeLayerId: bottomId, // non-default: not the top layer
            nextLayerNumber: 7,
            timelinePanelCollapsed: true
        )

        // A hydrated document is a live editing surface: draw on it before
        // snapshotting so the round-trip carries a post-hydration edit too.
        try original.setPixel(x: 1, y: 1, color: Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF))

        let snapshots = try original.layerSnapshots()
        let hydrated = try AppleDocument.fromLayers(
            width: original.width(),
            height: original.height(),
            layers: snapshots,
            activeLayerId: original.activeLayerId(),
            nextLayerNumber: original.nextLayerNumber(),
            timelinePanelCollapsed: original.isTimelinePanelCollapsed()
        )

        #expect(hydrated.composite() == original.composite())
        let rehydrated = try hydrated.layerSnapshots()
        #expect(rehydrated.map(\.id) == [bottomId, topId])
        #expect(rehydrated.map(\.name) == ["Layer 1", "Layer 2"])
        #expect(rehydrated.map(\.visible) == [true, false])
        #expect(rehydrated.map(\.opacity) == [1.0, 0.5])
        #expect(rehydrated.map(\.pixels) == snapshots.map(\.pixels))
        #expect(hydrated.activeLayerId() == bottomId)
        #expect(hydrated.nextLayerNumber() == 7)
        #expect(hydrated.isTimelinePanelCollapsed())
    }

    @Test("a reference-carrying document round-trips through the reference snapshot read and hydration")
    func referenceSnapshotHydrationRoundTrip() throws {
        let pixelId = makeLayerId()
        let doc = try AppleDocument(
            width: 4, height: 4, firstLayerId: pixelId, firstLayerName: "Layer 1")
        #expect(doc.referenceLayerSnapshot() == nil)

        // 2×1 source with a semi-transparent pixel — the case a lossy
        // (premultiplying) round-trip would corrupt.
        let sourceRgba = Data([200, 100, 50, 7, 255, 0, 0, 255])
        let referenceId = makeLayerId()
        try doc.addReferenceLayer(
            newId: referenceId, name: "ref.png", sourceRgba: sourceRgba,
            sourceWidth: 2, sourceHeight: 1)
        try doc.setReferencePlacement(
            id: referenceId,
            placement: AppleReferencePlacementUpdate(x: 1.5, y: -2.0, scale: 3.0))
        try doc.setLayerVisibility(id: referenceId, visible: false)

        let snapshot = try #require(doc.referenceLayerSnapshot())
        #expect(snapshot.id == referenceId)
        #expect(snapshot.name == "ref.png")
        #expect(snapshot.visible == false)
        #expect(snapshot.opacity == 1.0)
        #expect(snapshot.sourceRgba == sourceRgba)
        #expect(snapshot.naturalWidth == 2)
        #expect(snapshot.naturalHeight == 1)
        #expect(snapshot.placement
            == AppleReferencePlacement(x: 1.5, y: -2.0, scale: 3.0, rotation: 0))

        // Hydrate with the reference active — the pointer state import leaves
        // behind, which issue-278 persistence could not represent.
        let hydrated = try AppleDocument.fromLayers(
            width: doc.width(),
            height: doc.height(),
            layers: doc.pixelLayerSnapshots(),
            activeLayerId: doc.activeLayerId(),
            nextLayerNumber: doc.nextLayerNumber(),
            timelinePanelCollapsed: false,
            reference: snapshot
        )

        #expect(hydrated.layers().map(\.kind) == [.reference, .pixel])
        #expect(hydrated.activeLayerId() == referenceId)
        let rehydrated = try #require(hydrated.referenceLayerSnapshot())
        #expect(rehydrated.id == referenceId)
        #expect(rehydrated.name == "ref.png")
        #expect(rehydrated.visible == false)
        #expect(rehydrated.sourceRgba == sourceRgba)
        #expect(rehydrated.placement == snapshot.placement)
    }

    @Test("hydration rejects a malformed reference snapshot instead of crashing")
    func referenceHydrationBuildErrors() throws {
        let pixelId = makeLayerId()
        func hydrate(_ reference: AppleReferenceLayerSnapshot) throws -> AppleDocument {
            try AppleDocument.fromLayers(
                width: 2, height: 2,
                layers: [AppleLayerSnapshot(
                    id: pixelId, name: "Layer 1", visible: true, opacity: 1.0,
                    pixels: Data(count: 2 * 2 * 4))],
                activeLayerId: pixelId,
                nextLayerNumber: 2,
                timelinePanelCollapsed: false,
                reference: reference
            )
        }
        func snapshot(
            scale: Float = 1.0,
            rotation: UInt8 = 0,
            sourceRgba: Data = Data(count: 2 * 1 * 4)
        ) -> AppleReferenceLayerSnapshot {
            AppleReferenceLayerSnapshot(
                id: makeLayerId(), name: "ref.png", visible: true, opacity: 1.0,
                sourceRgba: sourceRgba, naturalWidth: 2, naturalHeight: 1,
                placement: AppleReferencePlacement(x: 0, y: 0, scale: scale, rotation: rotation)
            )
        }

        // Non-positive scale violates the placement invariant.
        #expect(throws: AppleError.self) { _ = try hydrate(snapshot(scale: 0)) }

        // Rotation outside the quarter-turn range.
        #expect(throws: AppleError.self) { _ = try hydrate(snapshot(rotation: 4)) }

        // Source buffer inconsistent with the declared natural dimensions.
        #expect(throws: AppleError.self) {
            _ = try hydrate(snapshot(sourceRgba: Data(count: 3 * 3 * 4)))
        }
    }

    @Test("a multi-frame document round-trips through cel snapshots and frames-aware hydration")
    func multiFrameSnapshotHydrationRoundTrip() throws {
        let layerId = makeLayerId()
        let doc = try AppleDocument(
            width: 2, height: 2, firstLayerId: layerId, firstLayerName: "Layer 1")
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        let secondFrameId = makeFrameId()
        try doc.addFrame(newId: secondFrameId) // activates the new frame
        try doc.setPixel(x: 1, y: 1, color: Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF))
        let firstFrameId = doc.frames()[0].id
        try doc.setFrameDuration(id: firstFrameId, durationMs: 80)
        try doc.setFrameDuration(id: secondFrameId, durationMs: 250)

        // The snapshot read carries one cel per frame in axis order; `pixels`
        // keeps its active-frame meaning for the single-frame consumers.
        let snapshots = doc.pixelLayerSnapshots()
        #expect(snapshots.count == 1)
        #expect(snapshots[0].cels.map(\.frameId) == [firstFrameId, secondFrameId])
        #expect(snapshots[0].cels[1].pixels == snapshots[0].pixels)

        let hydrated = try AppleDocument.fromLayers(
            width: doc.width(),
            height: doc.height(),
            layers: snapshots,
            activeLayerId: doc.activeLayerId(),
            nextLayerNumber: doc.nextLayerNumber(),
            timelinePanelCollapsed: false,
            frames: doc.frames(),
            activeFrameId: doc.activeFrameId()
        )

        #expect(hydrated.frames() == doc.frames())
        #expect(hydrated.frames().map(\.durationMs) == [80, 250])
        #expect(hydrated.activeFrameId() == secondFrameId)
        // Per-frame composite parity — the round-trip acceptance criterion.
        for frame in doc.frames() {
            #expect(
                try hydrated.compositeAt(frameId: frame.id)
                    == doc.compositeAt(frameId: frame.id))
        }
    }

    @Test("frames-aware hydration clamps persisted durations to the binding-owned range")
    func framesAwareHydrationClampsDurations() throws {
        let layerId = makeLayerId()
        let f0 = makeFrameId()
        let f1 = makeFrameId()
        func cel(_ frameId: String) -> AppleCelSnapshot {
            AppleCelSnapshot(frameId: frameId, pixels: Data(count: 1 * 1 * 4))
        }
        let hydrated = try AppleDocument.fromLayers(
            width: 1, height: 1,
            layers: [AppleLayerSnapshot(
                id: layerId, name: "Layer 1", visible: true, opacity: 1.0,
                pixels: Data(count: 1 * 1 * 4), cels: [cel(f0), cel(f1)])],
            activeLayerId: layerId,
            nextLayerNumber: 2,
            timelinePanelCollapsed: false,
            frames: [
                AppleFrameMetadata(id: f0, durationMs: 0),
                AppleFrameMetadata(id: f1, durationMs: 100_000),
            ],
            activeFrameId: f0
        )
        #expect(hydrated.frames().map(\.durationMs)
            == [frameMinDurationMs(), frameMaxDurationMs()])
    }

    @Test("frames-aware hydration rejects inconsistent animation data instead of crashing")
    func framesAwareHydrationBuildErrors() throws {
        let layerId = makeLayerId()
        let f0 = makeFrameId()
        let f1 = makeFrameId()
        func cel(_ frameId: String, pixels: Data = Data(count: 1 * 1 * 4)) -> AppleCelSnapshot {
            AppleCelSnapshot(frameId: frameId, pixels: pixels)
        }
        func hydrate(
            cels: [AppleCelSnapshot],
            frames: [AppleFrameMetadata],
            activeFrameId: String?
        ) throws -> AppleDocument {
            try AppleDocument.fromLayers(
                width: 1, height: 1,
                layers: [AppleLayerSnapshot(
                    id: layerId, name: "Layer 1", visible: true, opacity: 1.0,
                    pixels: Data(count: 1 * 1 * 4), cels: cels)],
                activeLayerId: layerId,
                nextLayerNumber: 2,
                timelinePanelCollapsed: false,
                frames: frames,
                activeFrameId: activeFrameId
            )
        }
        func frame(_ id: String) -> AppleFrameMetadata {
            AppleFrameMetadata(id: id, durationMs: 100)
        }

        // A cel missing for a frame on the axis (the grid invariant).
        #expect(throws: AppleError.self) {
            _ = try hydrate(cels: [cel(f0)], frames: [frame(f0), frame(f1)], activeFrameId: f0)
        }

        // A cel keyed to a frame the axis does not carry.
        #expect(throws: AppleError.self) {
            _ = try hydrate(cels: [cel(f0), cel(f1)], frames: [frame(f0)], activeFrameId: f0)
        }

        // An active frame id absent from the axis.
        #expect(throws: AppleError.self) {
            _ = try hydrate(cels: [cel(f0)], frames: [frame(f0)], activeFrameId: makeFrameId())
        }

        // An empty frame axis.
        #expect(throws: AppleError.self) {
            _ = try hydrate(cels: [], frames: [], activeFrameId: f0)
        }

        // A cel id that is not a valid UUID string.
        #expect(throws: AppleError.self) {
            _ = try hydrate(
                cels: [cel("not-a-uuid")], frames: [frame(f0)], activeFrameId: f0)
        }

        // A cel buffer inconsistent with the document dimensions.
        #expect(throws: AppleError.self) {
            _ = try hydrate(
                cels: [cel(f0, pixels: Data(count: 2 * 2 * 4))],
                frames: [frame(f0)], activeFrameId: f0)
        }

        // A frame axis without an active frame id (inconsistent call).
        #expect(throws: AppleError.self) {
            _ = try hydrate(cels: [cel(f0)], frames: [frame(f0)], activeFrameId: nil)
        }
    }

    @Test("reference PNG codec round-trips the source buffer losslessly and rejects corrupt bytes")
    func referencePngCodec() throws {
        // Semi-transparent channel values — the case a premultiplying codec
        // would corrupt; persistence compression must be lossless.
        let rgba = Data([200, 100, 50, 7, 255, 0, 0, 255])
        let png = try appleEncodeReferencePng(width: 2, height: 1, rgba: rgba)
        let decoded = try appleDecodeReferencePng(bytes: png)
        #expect(decoded.width == 2)
        #expect(decoded.height == 1)
        #expect(decoded.rgba == rgba)

        #expect(throws: AppleError.self) {
            _ = try appleDecodeReferencePng(bytes: Data([1, 2, 3, 4]))
        }
    }

    @Test("hydration rejects malformed persisted parts instead of crashing")
    func hydrationBuildErrors() throws {
        let layerId = makeLayerId()
        func snapshot(
            id: String, opacity: Float = 1.0, pixels: Data = Data(count: 2 * 2 * 4)
        ) -> AppleLayerSnapshot {
            AppleLayerSnapshot(id: id, name: "Layer 1", visible: true, opacity: opacity, pixels: pixels)
        }
        func hydrate(layers: [AppleLayerSnapshot], activeLayerId: String) throws -> AppleDocument {
            try AppleDocument.fromLayers(
                width: 2, height: 2, layers: layers, activeLayerId: activeLayerId,
                nextLayerNumber: 2, timelinePanelCollapsed: false)
        }

        // Empty stack.
        #expect(throws: AppleError.self) {
            _ = try hydrate(layers: [], activeLayerId: layerId)
        }

        // Duplicate layer id.
        #expect(throws: AppleError.self) {
            _ = try hydrate(
                layers: [snapshot(id: layerId), snapshot(id: layerId)], activeLayerId: layerId)
        }

        // Pixel buffer inconsistent with the document dimensions.
        #expect(throws: AppleError.self) {
            _ = try hydrate(
                layers: [snapshot(id: layerId, pixels: Data(count: 3 * 3 * 4))],
                activeLayerId: layerId)
        }

        // Active layer id not present in the stack.
        #expect(throws: AppleError.self) {
            _ = try hydrate(layers: [snapshot(id: layerId)], activeLayerId: makeLayerId())
        }

        // Non-finite or out-of-range opacity — persisted data is an external
        // input; a NaN would slip past the compositor's clamp and render the
        // layer transparent, so the boundary rejects it.
        #expect(throws: AppleError.self) {
            _ = try hydrate(layers: [snapshot(id: layerId, opacity: .nan)], activeLayerId: layerId)
        }
        #expect(throws: AppleError.self) {
            _ = try hydrate(layers: [snapshot(id: layerId, opacity: 1.5)], activeLayerId: layerId)
        }
    }

    @Test("reference imports replace the singleton bottom layer with the latest source")
    func referenceImportReplacesSingleton() throws {
        let pixelId = makeLayerId()
        let firstReferenceId = makeLayerId()
        let secondReferenceId = makeLayerId()
        let doc = try AppleDocument(
            width: 4, height: 4, firstLayerId: pixelId, firstLayerName: "Layer 1")

        try doc.addReferenceLayer(
            newId: firstReferenceId,
            name: "First reference",
            sourceRgba: Data([0xFF, 0x00, 0x00, 0xFF]),
            sourceWidth: 1,
            sourceHeight: 1
        )
        #expect(doc.layers().map(\.id) == [firstReferenceId, pixelId])
        #expect(doc.layers().map(\.kind) == [.reference, .pixel])

        let latestSource = Data([
            0x00, 0xFF, 0x00, 0xFF,
            0x00, 0x00, 0xFF, 0xFF,
        ])
        try doc.addReferenceLayer(
            newId: secondReferenceId,
            name: "Latest reference",
            sourceRgba: latestSource,
            sourceWidth: 2,
            sourceHeight: 1
        )

        #expect(doc.layers().map(\.id) == [secondReferenceId, pixelId])
        #expect(doc.layers().map(\.kind) == [.reference, .pixel])
        #expect(doc.activeLayerId() == secondReferenceId)
        #expect(doc.layerSourcePixelsAt(stackIndex: 0) == latestSource)
        #expect(doc.layerSourcePixelsAt(stackIndex: 1) == nil)

        #expect(throws: AppleError.self) {
            try doc.addReferenceLayer(
                newId: makeLayerId(),
                name: "Invalid reference",
                sourceRgba: Data([0x00]),
                sourceWidth: 1,
                sourceHeight: 1
            )
        }
        #expect(doc.layers().map(\.id) == [secondReferenceId, pixelId])
        #expect(doc.layerSourcePixelsAt(stackIndex: 0) == latestSource)

        #expect(throws: AppleError.self) {
            try doc.addReferenceLayer(
                newId: makeLayerId(),
                name: "Zero-width reference",
                sourceRgba: Data(),
                sourceWidth: 0,
                sourceHeight: 1
            )
        }
        #expect(throws: AppleError.self) {
            try doc.addReferenceLayer(
                newId: makeLayerId(),
                name: "Zero-height reference",
                sourceRgba: Data(),
                sourceWidth: 1,
                sourceHeight: 0
            )
        }
        #expect(doc.layers().map(\.id) == [secondReferenceId, pixelId])
        #expect(doc.layerSourcePixelsAt(stackIndex: 0) == latestSource)

        #expect(throws: AppleError.self) {
            try doc.addReferenceLayer(
                newId: pixelId,
                name: "Conflicting reference",
                sourceRgba: Data([0x00, 0x00, 0x00, 0x00]),
                sourceWidth: 1,
                sourceHeight: 1
            )
        }
        #expect(doc.layers().map(\.id) == [secondReferenceId, pixelId])

        try doc.reorderLayer(id: pixelId, newIndex: 0)
        #expect(doc.layers().map(\.id) == [secondReferenceId, pixelId])
        try doc.reorderLayer(id: secondReferenceId, newIndex: 1)
        #expect(doc.layers().map(\.id) == [secondReferenceId, pixelId])
    }

    @Test("reference placement and natural dimensions round-trip with boundary validation")
    func referencePlacementRoundTrip() throws {
        let pixelId = makeLayerId()
        let referenceId = makeLayerId()
        let doc = try AppleDocument(
            width: 4, height: 4, firstLayerId: pixelId, firstLayerName: "Layer 1")
        try doc.addReferenceLayer(
            newId: referenceId,
            name: "Reference",
            sourceRgba: Data([
                0xFF, 0x00, 0x00, 0xFF,
                0x00, 0xFF, 0x00, 0xFF,
            ]),
            sourceWidth: 2,
            sourceHeight: 1
        )

        let placementUpdate = AppleReferencePlacementUpdate(
            x: 1.5, y: -2.0, scale: 0.75)
        try doc.setReferencePlacement(id: referenceId, placement: placementUpdate)

        let expectedPlacement = AppleReferencePlacement(
            x: 1.5, y: -2.0, scale: 0.75, rotation: 0)
        #expect(doc.layerPlacementAt(stackIndex: 0) == expectedPlacement)
        #expect(
            doc.layerSourceDimensionsAt(stackIndex: 0)
                == AppleReferenceDimensions(width: 2, height: 1))
        #expect(doc.layerPlacementAt(stackIndex: 1) == nil)
        #expect(doc.layerSourceDimensionsAt(stackIndex: 1) == nil)

        #expect(throws: AppleError.self) {
            try doc.setReferencePlacement(
                id: referenceId,
                placement: AppleReferencePlacementUpdate(x: .nan, y: 0, scale: 1))
        }
        #expect(throws: AppleError.self) {
            try doc.setReferencePlacement(
                id: referenceId,
                placement: AppleReferencePlacementUpdate(x: 0, y: 0, scale: 0))
        }
        #expect(doc.layerPlacementAt(stackIndex: 0) == expectedPlacement)
    }

    @Test("reference footprint reads placement geometry including quarter-turn rotation")
    func referenceFootprintRead() throws {
        let pixelId = makeLayerId()
        let referenceId = makeLayerId()
        let doc = try AppleDocument(
            width: 8, height: 8, firstLayerId: pixelId, firstLayerName: "Layer 1")
        try doc.addReferenceLayer(
            newId: referenceId,
            name: "Reference",
            sourceRgba: Data([
                0xFF, 0x00, 0x00, 0xFF,
                0x00, 0xFF, 0x00, 0xFF,
            ]),
            sourceWidth: 2,
            sourceHeight: 1
        )
        try doc.setReferencePlacement(
            id: referenceId,
            placement: AppleReferencePlacementUpdate(x: 1, y: 2, scale: 2))

        #expect(
            doc.referenceLayerFootprintAt(stackIndex: 0)
                == AppleReferenceFootprint(minX: 1, minY: 2, maxX: 5, maxY: 4))
        #expect(doc.referenceLayerFootprintAt(stackIndex: 1) == nil)

        #expect(
            try appleReferenceFootprint(
                placement: AppleReferencePlacement(x: 1, y: 2, scale: 2, rotation: 1),
                naturalWidth: 2,
                naturalHeight: 1
            ) == AppleReferenceFootprint(minX: 1, minY: 2, maxX: 3, maxY: 6))
        #expect(throws: AppleError.self) {
            _ = try appleReferenceFootprint(
                placement: AppleReferencePlacement(x: 0, y: 0, scale: 1, rotation: 4),
                naturalWidth: 2,
                naturalHeight: 1)
        }
    }

    @Test("reference fit-to-canvas centers both upscaled and downscaled sources")
    func referenceFitToCanvas() throws {
        #expect(
            try appleReferencePlacementFitToCanvas(
                canvasWidth: 20, canvasHeight: 20, naturalWidth: 4, naturalHeight: 2)
                == AppleReferencePlacement(x: 0, y: 5, scale: 5, rotation: 0))
        #expect(
            try appleReferencePlacementFitToCanvas(
                canvasWidth: 10, canvasHeight: 20, naturalWidth: 20, naturalHeight: 5)
                == AppleReferencePlacement(x: 0, y: 8.75, scale: 0.5, rotation: 0))
        #expect(throws: AppleError.self) {
            _ = try appleReferencePlacementFitToCanvas(
                canvasWidth: 10, canvasHeight: 20, naturalWidth: 0, naturalHeight: 5)
        }
    }

    @Test("reference sampling crosses the binding while document composites remain pixel-only")
    func referenceSamplingAndPixelOnlyComposites() throws {
        let pixelId = makeLayerId()
        let referenceId = makeLayerId()
        let doc = try AppleDocument(
            width: 2, height: 2, firstLayerId: pixelId, firstLayerName: "Layer 1")
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let green = Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF)
        let translucentRed = Color(r: 0xFF, g: 0, b: 0, a: 0x80)
        let translucentRedOverGreen = Color(r: 0x80, g: 0x7F, b: 0, a: 0xFF)
        let transparent = Color(r: 0, g: 0, b: 0, a: 0)
        try doc.setPixel(x: 0, y: 0, color: red)
        try doc.setPixel(x: 0, y: 1, color: translucentRed)

        let compositeWithoutReference = doc.composite()
        let exportWithoutReference = doc.compositeForExport()
        try doc.addReferenceLayer(
            newId: referenceId,
            name: "Reference",
            sourceRgba: Data([
                0, 0xFF, 0, 0xFF, 0, 0xFF, 0, 0xFF,
                0, 0xFF, 0, 0xFF, 0, 0xFF, 0, 0xFF,
            ]),
            sourceWidth: 2,
            sourceHeight: 2
        )
        try doc.setReferencePlacement(
            id: referenceId,
            placement: AppleReferencePlacementUpdate(x: 0, y: 0, scale: 1))

        #expect(doc.tryGetPixel(x: 0, y: 0) == green)
        #expect(doc.tryGetPixel(x: 2, y: 1) == nil)
        #expect(doc.sampleVisiblePixels(points: [
            ScreenCanvasCoords(x: 0, y: 0),
            ScreenCanvasCoords(x: 1, y: 1),
            ScreenCanvasCoords(x: 0, y: 1),
            ScreenCanvasCoords(x: -1, y: 0),
        ]) == [red, green, translucentRedOverGreen, transparent])
        #expect(doc.composite() == compositeWithoutReference)
        #expect(doc.compositeForExport() == exportWithoutReference)
        #expect(doc.composite() == doc.compositeForExport())

        try doc.setActiveLayer(id: pixelId)
        #expect(doc.sampleVisiblePixels(points: [ScreenCanvasCoords(x: 1, y: 1)]) == [green])

        try doc.setLayerVisibility(id: referenceId, visible: false)
        #expect(doc.sampleVisiblePixels(points: [ScreenCanvasCoords(x: 1, y: 1)]) == [
            transparent,
        ])
        #expect(doc.composite() == compositeWithoutReference)
        #expect(doc.compositeForExport() == exportWithoutReference)

        #expect(doc.tryGetPixel(x: 0, y: 0) == red)
    }
}
