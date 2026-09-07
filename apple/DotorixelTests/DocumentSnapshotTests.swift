import Foundation
import Testing
@testable import Dotorixel

@Suite("Document Snapshot — preservation and reconstruction")
struct DocumentSnapshotTests {
    @Test("capture preserves the whole frame grid independently of later edits")
    func capturedGridSurvivesLaterEdits() throws {
        let document = makeSingleLayerDocument(width: 2, height: 1)
        let firstFrame = document.activeFrameId()
        let bottomLayer = document.activeLayerId()
        let topLayer = makeLayerId()
        let secondFrame = makeFrameId()
        let red = Color(r: 255, g: 0, b: 0, a: 255)
        let blue = Color(r: 0, g: 0, b: 255, a: 255)
        try document.setPixel(x: 0, y: 0, color: red)
        try document.addLayer(newId: topLayer, name: "Details")
        try document.addFrame(newId: secondFrame)
        try document.setPixel(x: 1, y: 0, color: blue)
        try document.setFrameDuration(id: firstFrame, durationMs: 80)
        try document.setFrameDuration(id: secondFrame, durationMs: 250)
        try document.reorderFrame(id: secondFrame, newIndex: 0)
        try document.setLayerVisibility(id: bottomLayer, visible: false)
        let marquee = AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 1)
        try document.setMarquee(region: marquee)
        let nextLayerNumber = document.nextLayerNumber()

        let snapshot = DocumentSnapshot.capture(document)
        try document.removeFrame(id: firstFrame)
        try document.setPixel(x: 1, y: 0, color: red)
        try document.setMarquee(region: nil)

        let restored = try snapshot.makeDocument(timelinePanelCollapsed: true)
        #expect(restored.width() == 2)
        #expect(restored.height() == 1)
        #expect(restored.frames().map(\.id) == [secondFrame, firstFrame])
        #expect(restored.frames().map(\.durationMs) == [250, 80])
        #expect(restored.activeFrameId() == secondFrame)
        #expect(restored.layers().map(\.id) == [bottomLayer, topLayer])
        #expect(restored.layers()[1].name == "Details")
        #expect(!restored.layers()[0].visible)
        #expect(restored.activeLayerId() == topLayer)
        #expect(restored.nextLayerNumber() == nextLayerNumber)
        #expect(restored.marquee() == marquee)
        #expect(restored.isTimelinePanelCollapsed())
        #expect(Array(restored.composite()) == [0, 0, 0, 0, 0, 0, 255, 255])
        try restored.setActiveFrame(id: firstFrame)
        try restored.setActiveLayer(id: bottomLayer)
        #expect(try restored.getPixel(x: 0, y: 0) == red)
        #expect(try restored.getPixel(x: 1, y: 0) == Color(r: 0, g: 0, b: 0, a: 0))
    }

    @Test("capture projects a Floating Selection's baseline without losing other frames or resolving it")
    func floatingCapturePreservesEveryFrame() throws {
        let document = makeSingleLayerDocument(width: 2, height: 1)
        let firstFrame = document.activeFrameId()
        let secondFrame = makeFrameId()
        let red = Color(r: 255, g: 0, b: 0, a: 255)
        let blue = Color(r: 0, g: 0, b: 255, a: 255)
        try document.setPixel(x: 0, y: 0, color: blue)
        try document.addFrame(newId: secondFrame)
        try document.setPixel(x: 0, y: 0, color: red)
        let marquee = AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        try document.setMarquee(region: marquee)
        let floating = FloatingSelectionLifecycle()
        #expect(floating.liftFromMarquee(marquee, in: document))
        #expect(floating.moveTo(FloatingSelectionOffset(dx: 1, dy: 0)))

        let snapshot = DocumentSnapshot.capture(document, floatingSelection: floating)
        let restored = try snapshot.makeDocument()

        #expect(restored.activeFrameId() == secondFrame)
        #expect(Array(try restored.compositeAt(frameId: secondFrame))
            == [255, 0, 0, 255, 0, 0, 0, 0])
        #expect(Array(try restored.compositeAt(frameId: firstFrame))
            == [0, 0, 255, 255, 0, 0, 0, 0])
        #expect(snapshot.layers[0].pixels == snapshot.layers[0].cels[1].pixels)
        #expect(restored.marquee() == marquee)
        #expect(floating.isActive)
        #expect(floating.offset == FloatingSelectionOffset(dx: 1, dy: 0))
        #expect(document.activeFrameId() == secondFrame)
        #expect(document.composite() == Data(repeating: 0, count: 8))
    }

    @Test("pending recovery preserves the source pixels and other active Layer without repairing live state")
    func pendingRecoveryCaptureIsReadOnly() throws {
        let document = makeSingleLayerDocument(width: 1, height: 1)
        let sourceLayer = document.activeLayerId()
        let otherLayer = makeLayerId()
        try document.setPixel(x: 0, y: 0, color: Color(r: 255, g: 0, b: 0, a: 255))
        let floating = FloatingSelectionLifecycle()
        #expect(floating.liftFromMarquee(
            AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1), in: document
        ))
        // A real Document with a mismatched active Layer exercises degraded
        // cancellation without replacing the lifecycle or its pixel operations.
        try document.addLayer(newId: otherLayer, name: "Other")
        guard case .degraded = floating.cancel(in: document) else {
            Issue.record("The active-Layer mismatch must leave recovery pending")
            return
        }

        let snapshot = DocumentSnapshot.capture(document, floatingSelection: floating)
        let restored = try snapshot.makeDocument()

        #expect(restored.activeLayerId() == otherLayer)
        #expect(restored.marquee() == nil)
        #expect(Array(try #require(restored.pixelLayerSnapshots().first {
            $0.id == sourceLayer
        }).pixels) == [255, 0, 0, 255])
        #expect(restored.pixelLayerSnapshots().last?.pixels == Data(repeating: 0, count: 4))
        #expect(!DocumentSnapshot.isDocumentBlank(document, floatingSelection: floating))
        #expect(document.composite() == Data(repeating: 0, count: 4))
        #expect(document.activeLayerId() == otherLayer)
        #expect(floating.hasPendingRecovery)
        #expect(!floating.isActive)
    }

    @Test("a Reference-active Document preserves the source and placement but exports only Pixel Layers")
    func referenceRoundTripStaysPixelOnly() throws {
        let document = makeSingleLayerDocument(width: 2, height: 1)
        try document.setPixel(x: 0, y: 0, color: Color(r: 255, g: 0, b: 0, a: 255))
        let referenceId = makeLayerId()
        let source = Data([200, 100, 50, 7, 0, 0, 255, 255])
        try document.addReferenceLayer(
            newId: referenceId, name: "guide.png", sourceRgba: source,
            sourceWidth: 2, sourceHeight: 1
        )
        try document.setReferencePlacement(
            id: referenceId, placement: AppleReferencePlacementUpdate(x: -1.5, y: 2, scale: 3)
        )
        let snapshot = DocumentSnapshot.capture(document)
        try document.removeLayer(id: referenceId)

        let restored = try snapshot.makeDocument()
        let reference = try #require(restored.referenceLayerSnapshot())
        #expect(restored.activeLayerId() == referenceId)
        #expect(reference.name == "guide.png")
        #expect(reference.visible)
        #expect(reference.opacity == 1)
        #expect(reference.sourceRgba == source)
        #expect(reference.naturalWidth == 2)
        #expect(reference.naturalHeight == 1)
        #expect(reference.placement
            == AppleReferencePlacement(x: -1.5, y: 2, scale: 3, rotation: 0))
        #expect(restored.marquee() == nil)
        #expect(!restored.isTimelinePanelCollapsed())
        #expect(Array(restored.compositeForExport()) == [255, 0, 0, 255, 0, 0, 0, 0])
        #expect(try decodedRgbaPixels(png: restored.encodeExportPng(), width: 2, height: 1)
            == [255, 0, 0, 255, 0, 0, 0, 0])
    }

    @Test("reconstruction rejects incomplete frame data instead of silently degrading it",
          arguments: [true, false])
    func invalidFrameAssemblyThrows(missingActiveFrame: Bool) throws {
        let original = DocumentSnapshot.capture(makeSingleLayerDocument(width: 1, height: 1))
        var layer = original.layers[0]
        if !missingActiveFrame { layer.cels = [] }
        let malformed = DocumentSnapshot(
            width: original.width,
            height: original.height,
            layers: [layer],
            frames: original.frames,
            activeFrameId: missingActiveFrame ? nil : original.activeFrameId,
            reference: nil,
            activeLayerId: original.activeLayerId,
            nextLayerNumber: original.nextLayerNumber,
            marquee: nil
        )

        #expect(throws: AppleError.self) {
            try malformed.makeDocument()
        }
    }
}
