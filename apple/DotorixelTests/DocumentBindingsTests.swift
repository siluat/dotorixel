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
        let baseId = UUID().uuidString.lowercased()
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: baseId, firstLayerName: "Layer 1")

        // A document must always keep at least one layer.
        #expect(throws: AppleError.self) {
            try doc.removeLayer(id: baseId)
        }

        let secondId = UUID().uuidString.lowercased()
        try doc.addLayer(newId: secondId, name: "Layer 2")
        #expect(doc.layers().map(\.id) == [baseId, secondId])
        #expect(doc.activeLayerId() == secondId)
        #expect(doc.nextLayerNumber() == 3)

        // Insert lands directly above the *active* layer, not at the top.
        try doc.setActiveLayer(id: baseId)
        let thirdId = UUID().uuidString.lowercased()
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
        let aId = UUID().uuidString.lowercased()
        let bId = UUID().uuidString.lowercased()
        let cId = UUID().uuidString.lowercased()
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

    @Test("history restores layer structure and dimensions across undo/redo")
    func historyStructureAndResize() throws {
        let baseId = UUID().uuidString.lowercased()
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: baseId, firstLayerName: "Layer 1")
        let history = AppleDocumentHistory.defaultHistory()

        // Edit 1 — layer-structure change.
        history.beginEdit(document: doc)
        let secondId = UUID().uuidString.lowercased()
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
}
