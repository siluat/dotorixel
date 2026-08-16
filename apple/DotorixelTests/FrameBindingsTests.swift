import Foundation
import Testing
@testable import Dotorixel

/// Binding-level tests for `AppleDocument`'s frame-axis FFI surface.
///
/// The frame model (add/duplicate/remove/reorder policy, the grid invariant,
/// per-frame compositing) is unit-tested in the Rust core; these prove the
/// frame surface is callable across the UniFFI boundary and marshals
/// correctly — the contract the Phase 6 animation slices consume.
@Suite("Frame FFI bindings")
struct FrameBindingsTests {

    @Test("a new document reports exactly one active frame at the default duration")
    func newDocumentFrameAxis() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)

        let frames = doc.frames()
        #expect(frames.count == 1)
        #expect(doc.frameCount() == 1)
        // 100 ms = 10 fps, the core's documented default for a fresh frame.
        #expect(frames[0].durationMs == 100)
        #expect(doc.activeFrameId() == frames[0].id)
    }

    @Test("add inserts a transparent frame after the active one and makes it active")
    func addFrame() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        let firstId = doc.activeFrameId()

        let secondId = makeFrameId()
        try doc.addFrame(newId: secondId)

        #expect(doc.frames().map(\.id) == [firstId, secondId])
        #expect(doc.activeFrameId() == secondId)
        // The seeded cel is transparent, so the new frame composites to nothing.
        #expect(doc.composite().allSatisfy { $0 == 0 })

        // The boundary rejects an id already on the axis.
        #expect(throws: AppleError.self) {
            try doc.addFrame(newId: secondId)
        }
    }

    @Test("set-active moves the pointer by id, and add inserts after it rather than at the end")
    func setActiveFrameGovernsInsertPosition() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let firstId = doc.activeFrameId()
        let lastId = makeFrameId()
        try doc.addFrame(newId: lastId)

        try doc.setActiveFrame(id: firstId)
        #expect(doc.activeFrameId() == firstId)

        let middleId = makeFrameId()
        try doc.addFrame(newId: middleId)
        #expect(doc.frames().map(\.id) == [firstId, middleId, lastId])
        #expect(doc.activeFrameId() == middleId)

        // An unknown id errors and preserves the previous active frame.
        #expect(throws: AppleError.self) {
            try doc.setActiveFrame(id: makeFrameId())
        }
        #expect(doc.activeFrameId() == middleId)
    }

    @Test("duplicate deep-copies the source frame's cels onto a new active frame")
    func duplicateFrame() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try doc.setPixel(x: 1, y: 2, color: red)
        let sourceId = doc.activeFrameId()
        let sourceComposite = doc.composite()

        let copyId = makeFrameId()
        try doc.duplicateFrame(newId: copyId)

        #expect(doc.frames().map(\.id) == [sourceId, copyId])
        #expect(doc.activeFrameId() == copyId)
        #expect(try doc.getPixel(x: 1, y: 2) == red)
        #expect(doc.composite() == sourceComposite)

        // The copy is deep — painting it leaves the source frame untouched.
        try doc.setPixel(x: 3, y: 3, color: red)
        try doc.setActiveFrame(id: sourceId)
        #expect(doc.composite() == sourceComposite)

        #expect(throws: AppleError.self) {
            try doc.duplicateFrame(newId: copyId)
        }
    }

    @Test("remove rejects the sole frame and relocates the active pointer to an adjacent one")
    func removeFrame() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let firstId = doc.activeFrameId()

        // The axis must always keep at least one frame.
        #expect(throws: AppleError.self) {
            try doc.removeFrame(id: firstId)
        }

        let secondId = makeFrameId()
        try doc.addFrame(newId: secondId)
        let thirdId = makeFrameId()
        try doc.addFrame(newId: thirdId)
        #expect(doc.frames().map(\.id) == [firstId, secondId, thirdId])

        // Removing the active frame moves the pointer to the frame below it.
        try doc.setActiveFrame(id: secondId)
        try doc.removeFrame(id: secondId)
        #expect(doc.frames().map(\.id) == [firstId, thirdId])
        #expect(doc.activeFrameId() == firstId)

        // Removing the first frame falls back to the frame above it.
        try doc.removeFrame(id: firstId)
        #expect(doc.frames().map(\.id) == [thirdId])
        #expect(doc.activeFrameId() == thirdId)

        #expect(throws: AppleError.self) {
            try doc.removeFrame(id: makeFrameId())
        }
    }

    @Test("reorder rearranges the axis, keeps the active pointer, and carries cels along")
    func reorderFrame() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let firstId = doc.activeFrameId()
        try doc.setPixel(x: 0, y: 0, color: red)

        let secondId = makeFrameId()
        try doc.addFrame(newId: secondId)
        let thirdId = makeFrameId()
        try doc.addFrame(newId: thirdId)

        try doc.reorderFrame(id: firstId, newIndex: 2)
        #expect(doc.frames().map(\.id) == [secondId, thirdId, firstId])
        // The active pointer is tracked by id, so the moved axis leaves it alone.
        #expect(doc.activeFrameId() == thirdId)

        // Cels stay keyed by frame id, so the paint follows its frame.
        try doc.setActiveFrame(id: firstId)
        #expect(try doc.getPixel(x: 0, y: 0) == red)

        // An out-of-range index clamps to the axis bounds instead of erroring.
        try doc.reorderFrame(id: secondId, newIndex: 99)
        #expect(doc.frames().map(\.id) == [thirdId, firstId, secondId])

        #expect(throws: AppleError.self) {
            try doc.reorderFrame(id: makeFrameId(), newIndex: 0)
        }
    }

    @Test("set-duration round-trips and clamps to the binding-owned bounds")
    func setFrameDuration() throws {
        // The bounds the shell UI shares with the binding: never zero-length,
        // never longer than a minute.
        #expect(frameMinDurationMs() == 1)
        #expect(frameMaxDurationMs() == 60_000)

        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let frameId = doc.activeFrameId()

        try doc.setFrameDuration(id: frameId, durationMs: 250)
        #expect(doc.frames()[0].durationMs == 250)

        try doc.setFrameDuration(id: frameId, durationMs: 0)
        #expect(doc.frames()[0].durationMs == frameMinDurationMs())

        try doc.setFrameDuration(id: frameId, durationMs: 999_999)
        #expect(doc.frames()[0].durationMs == frameMaxDurationMs())

        #expect(throws: AppleError.self) {
            try doc.setFrameDuration(id: makeFrameId(), durationMs: 100)
        }
    }

    @Test("composite-at reads any frame without moving the active pointer")
    func compositeAt() throws {
        let doc = makeSingleLayerDocument(width: 2, height: 2)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)

        let firstId = doc.activeFrameId()
        try doc.setPixel(x: 0, y: 0, color: red)

        let secondId = makeFrameId()
        try doc.addFrame(newId: secondId)
        try doc.setPixel(x: 0, y: 0, color: blue)

        // Pixel (0, 0) opens each frame's RGBA row-major buffer.
        #expect(Array(try doc.compositeAt(frameId: firstId).prefix(4)) == [0xFF, 0x00, 0x00, 0xFF])
        #expect(Array(try doc.compositeAt(frameId: secondId).prefix(4)) == [0x00, 0x00, 0xFF, 0xFF])
        #expect(try doc.compositeAt(frameId: secondId) == doc.composite())
        #expect(doc.activeFrameId() == secondId)

        // The boundary rejects an unknown id rather than letting the core trust it.
        #expect(throws: AppleError.self) {
            try doc.compositeAt(frameId: makeFrameId())
        }
    }

    @Test("drawing reaches only the active layer's active-frame cel")
    func drawingStaysInTheActiveCel() throws {
        let doc = makeSingleLayerDocument(width: 2, height: 2)
        let transparent = Color(r: 0x00, g: 0x00, b: 0x00, a: 0x00)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)

        let baseLayerId = doc.activeLayerId()
        try doc.addLayer(newId: makeLayerId(), name: "Layer 2")

        let firstId = doc.activeFrameId()
        let secondId = makeFrameId()
        try doc.addFrame(newId: secondId)

        try doc.setPixel(x: 0, y: 0, color: red)

        #expect(Array(try doc.compositeAt(frameId: secondId).prefix(4)) == [0xFF, 0x00, 0x00, 0xFF])
        // Neither the other frame nor the other layer's cel saw the write.
        #expect(try doc.compositeAt(frameId: firstId).allSatisfy { $0 == 0 })
        try doc.setActiveLayer(id: baseLayerId)
        #expect(try doc.getPixel(x: 0, y: 0) == transparent)
    }

    @Test("whole-document undo/redo restores frame structure and cel pixels")
    func historyAcrossAFrameOperation() throws {
        let doc = makeSingleLayerDocument(width: 2, height: 2)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try doc.setPixel(x: 0, y: 0, color: red)
        let firstId = doc.activeFrameId()

        let history = AppleDocumentHistory.defaultHistory()
        history.beginEdit(document: doc)
        let secondId = makeFrameId()
        try doc.addFrame(newId: secondId)
        try doc.setPixel(x: 1, y: 1, color: red)
        #expect(history.endEdit(current: doc))

        let undone = try #require(history.undo(current: doc))
        #expect(undone.frames().map(\.id) == [firstId])
        #expect(undone.activeFrameId() == firstId)
        #expect(Array(undone.composite().prefix(4)) == [0xFF, 0x00, 0x00, 0xFF])

        let redone = try #require(history.redo(current: undone))
        #expect(redone.frames().map(\.id) == [firstId, secondId])
        #expect(redone.activeFrameId() == secondId)
        #expect(try redone.getPixel(x: 1, y: 1) == red)
        // The restored frame axis keeps each frame's own cels.
        #expect(Array(try redone.compositeAt(frameId: firstId).prefix(4)) == [0xFF, 0x00, 0x00, 0xFF])
    }
}
