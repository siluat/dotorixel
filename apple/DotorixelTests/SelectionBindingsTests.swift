import Foundation
import Testing
@testable import Dotorixel

/// Binding-level tests for the Phase 5 selection + transform FFI surface.
///
/// The Marquee model, region ops, and transform algorithms are unit-tested in
/// the Rust core; these prove the new surface is callable across the UniFFI
/// boundary and marshals correctly — the round-trips the selection track
/// (issues 268–276) will rely on.
@Suite("Selection + transform FFI bindings")
struct SelectionBindingsTests {

    @Test("marquee set/read round-trips through the document, including the absent state")
    func marqueeRoundTrip() throws {
        let doc = makeSingleLayerDocument(width: 8, height: 8)

        // A fresh document has no Marquee.
        #expect(doc.marquee() == nil)

        // from_drag normalizes any corner order to the same inclusive region.
        let region = appleMarqueeFromDrag(x0: 5, y0: 7, x1: 2, y1: 3)
        #expect(region == AppleMarqueeRegion(x: 2, y: 3, width: 4, height: 5))

        try doc.setMarquee(region: region)
        #expect(doc.marquee() == region)

        try doc.setMarquee(region: nil)
        #expect(doc.marquee() == nil)
    }

    @Test("region helpers answer containment and canvas clipping without shell math")
    func regionHelpers() {
        let region = appleMarqueeFromDrag(x0: 2, y0: 3, x1: 5, y1: 7)

        // Containment is inclusive of the region's own edges only.
        #expect(appleMarqueeContains(region: region, x: 2, y: 3))
        #expect(appleMarqueeContains(region: region, x: 5, y: 7))
        #expect(!appleMarqueeContains(region: region, x: 1, y: 3))
        #expect(!appleMarqueeContains(region: region, x: 6, y: 7))

        // Clipping keeps only the in-bounds overlap …
        let partial = appleMarqueeFromDrag(x0: -2, y0: 1, x1: 3, y1: 6)
        #expect(
            appleMarqueeClipTo(region: partial, canvasW: 4, canvasH: 4)
                == AppleMarqueeRegion(x: 0, y: 1, width: 4, height: 3)
        )

        // … and a fully out-of-bounds region clips to nil.
        let outside = appleMarqueeFromDrag(x0: 4, y0: 0, x1: 6, y1: 3)
        #expect(appleMarqueeClipTo(region: outside, canvasW: 4, canvasH: 4) == nil)
    }

    @Test("lift, clear, and composite-back reproduce a selection move")
    func liftClearCompositeMove() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let green = Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF)
        let transparent = Color(r: 0x00, g: 0x00, b: 0x00, a: 0x00)
        try doc.setPixel(x: 1, y: 1, color: red)
        try doc.setPixel(x: 2, y: 1, color: green)

        try doc.setMarquee(region: appleMarqueeFromDrag(x0: 1, y0: 1, x1: 2, y1: 1))

        // Lift is row-major RGBA over the Marquee's 2×1 footprint.
        let lifted = doc.liftMarqueePixels()
        #expect(lifted == Data([0xFF, 0x00, 0x00, 0xFF, 0x00, 0xFF, 0x00, 0xFF]))

        // Clear empties the source region but keeps the Marquee itself.
        doc.clearMarqueePixels()
        #expect(try doc.getPixel(x: 1, y: 1) == transparent)
        #expect(try doc.getPixel(x: 2, y: 1) == transparent)
        #expect(doc.marquee() != nil)

        // Composite-back at a shifted destination lands the pixels there.
        try doc.compositeBufferAt(
            buffer: lifted,
            region: appleMarqueeFromDrag(x0: 1, y0: 3, x1: 2, y1: 3)
        )
        #expect(try doc.getPixel(x: 1, y: 3) == red)
        #expect(try doc.getPixel(x: 2, y: 3) == green)
    }

    @Test("bounded flood fill stops at the bounds; a seed outside them changes nothing")
    func boundedFloodFill() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)
        let transparent = Color(r: 0x00, g: 0x00, b: 0x00, a: 0x00)
        let bounds = appleMarqueeFromDrag(x0: 1, y0: 1, x1: 2, y1: 2)

        // The whole canvas is one transparent 4-connected area, but the fill
        // must not escape the bounds.
        #expect(try doc.floodFillBounded(x: 1, y: 1, fillColor: blue, bounds: bounds))
        #expect(try doc.getPixel(x: 2, y: 2) == blue)
        #expect(try doc.getPixel(x: 0, y: 0) == transparent)
        #expect(try doc.getPixel(x: 3, y: 1) == transparent)

        // A seed outside the bounds fills nothing.
        let before = doc.composite()
        #expect(try !doc.floodFillBounded(x: 0, y: 0, fillColor: blue, bounds: bounds))
        #expect(doc.composite() == before)

        // Negative coordinates short-circuit to false, like floodFill.
        #expect(try !doc.floodFillBounded(x: -1, y: 0, fillColor: blue, bounds: bounds))
    }

    @Test("the patch-composite read previews substituted pixels without mutating the document")
    func patchCompositePreview() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let transparent = Color(r: 0x00, g: 0x00, b: 0x00, a: 0x00)
        try doc.setPixel(x: 0, y: 0, color: red)
        let before = doc.composite()

        // Substitute a 1×1 blue patch at (2, 2) on the active layer.
        let preview = try doc.compositeWithLayerPatch(
            layerId: doc.activeLayerId(),
            patch: Data([0x00, 0x00, 0xFF, 0xFF]),
            patchWidth: 1,
            patchHeight: 1,
            destX: 2,
            destY: 2
        )

        // The preview shows both the existing pixel and the patched one …
        let redOffset = (0 * 4 + 0) * 4
        let blueOffset = (2 * 4 + 2) * 4
        #expect(Array(preview[redOffset..<redOffset + 4]) == [0xFF, 0x00, 0x00, 0xFF])
        #expect(Array(preview[blueOffset..<blueOffset + 4]) == [0x00, 0x00, 0xFF, 0xFF])

        // … while the document itself is untouched.
        #expect(try doc.getPixel(x: 2, y: 2) == transparent)
        #expect(doc.composite() == before)

        // An unknown layer id surfaces as an error, not a crash.
        #expect(throws: AppleError.self) {
            try doc.compositeWithLayerPatch(
                layerId: UUID().uuidString,
                patch: Data([0x00, 0x00, 0xFF, 0xFF]),
                patchWidth: 1,
                patchHeight: 1,
                destX: 0,
                destY: 0
            )
        }
    }

    @Test("canvas flips transform every layer and carry the marquee mapped + clipped")
    func canvasFlipTransformsAllLayers() throws {
        let baseId = makeLayerId()
        let doc = try AppleDocument(width: 4, height: 2, firstLayerId: baseId, firstLayerName: "Layer 1")
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let green = Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF)
        try doc.setPixel(x: 0, y: 0, color: red)

        // A second, non-active layer must flip too.
        let topId = makeLayerId()
        try doc.addLayer(newId: topId, name: "Layer 2")
        try doc.setPixel(x: 3, y: 1, color: green)

        // A marquee overhanging the right edge: mirroring sends it past the
        // left edge, so it must come back clipped.
        try doc.setMarquee(region: appleMarqueeFromDrag(x0: 3, y0: 0, x1: 4, y1: 0))

        doc.flipCanvasHorizontal()

        // Both layers mirrored across the vertical center line.
        #expect(try doc.getPixel(x: 0, y: 1) == green)
        try doc.setActiveLayer(id: baseId)
        #expect(try doc.getPixel(x: 3, y: 0) == red)
        // Dimensions are unchanged; the marquee is mirrored and clipped.
        #expect(doc.width() == 4 && doc.height() == 2)
        #expect(doc.marquee() == AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1))

        doc.flipCanvasVertical()
        #expect(try doc.getPixel(x: 3, y: 1) == red)
        #expect(doc.marquee() == AppleMarqueeRegion(x: 0, y: 1, width: 1, height: 1))
    }

    @Test("canvas rotates transform every layer, swap dimensions, and carry the marquee")
    func canvasRotateSwapsDimensions() throws {
        let baseId = makeLayerId()
        let doc = try AppleDocument(width: 4, height: 2, firstLayerId: baseId, firstLayerName: "Layer 1")
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let green = Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF)
        try doc.setPixel(x: 0, y: 0, color: red)

        // A second, non-active layer must turn too.
        let topId = makeLayerId()
        try doc.addLayer(newId: topId, name: "Layer 2")
        try doc.setPixel(x: 3, y: 1, color: green)
        try doc.setMarquee(region: appleMarqueeFromDrag(x0: 0, y0: 0, x1: 1, y1: 0))

        // CW turns (x, y) into (H − 1 − y, x) inside swapped dimensions.
        doc.rotateCanvasCw()
        #expect(doc.width() == 2 && doc.height() == 4)
        #expect(try doc.getPixel(x: 0, y: 3) == green)
        try doc.setActiveLayer(id: baseId)
        #expect(try doc.getPixel(x: 1, y: 0) == red)
        #expect(doc.marquee() == AppleMarqueeRegion(x: 1, y: 0, width: 1, height: 2))

        // CCW is the inverse: dimensions and content return on every layer.
        doc.rotateCanvasCcw()
        #expect(doc.width() == 4 && doc.height() == 2)
        #expect(try doc.getPixel(x: 0, y: 0) == red)
        try doc.setActiveLayer(id: topId)
        #expect(try doc.getPixel(x: 3, y: 1) == green)
        #expect(doc.marquee() == AppleMarqueeRegion(x: 0, y: 0, width: 2, height: 1))
    }

    @Test("marquee transforms touch only the marquee region of the active layer")
    func marqueeTransformsAreRegionLocal() throws {
        let baseId = makeLayerId()
        let doc = try AppleDocument(width: 4, height: 4, firstLayerId: baseId, firstLayerName: "Layer 1")
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        let green = Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF)
        let blue = Color(r: 0x00, g: 0x00, b: 0xFF, a: 0xFF)

        // Base layer holds blue under the marquee; it must never change.
        try doc.setPixel(x: 1, y: 1, color: blue)
        let topId = makeLayerId()
        try doc.addLayer(newId: topId, name: "Layer 2")
        // Active top layer: red inside the marquee, green outside it.
        try doc.setPixel(x: 2, y: 1, color: red)
        try doc.setPixel(x: 0, y: 3, color: green)
        try doc.setMarquee(region: appleMarqueeFromDrag(x0: 1, y0: 1, x1: 2, y1: 1))

        // Flip H mirrors within the region: red (2,1) → (1,1).
        doc.flipMarqueeHorizontal()
        #expect(try doc.getPixel(x: 1, y: 1) == red)

        // Rotate CCW re-centers the 2×1 region to 1×2: red → (1,2).
        doc.rotateMarqueeCcw()
        #expect(doc.marquee() == AppleMarqueeRegion(x: 1, y: 1, width: 1, height: 2))
        #expect(try doc.getPixel(x: 1, y: 2) == red)

        // Flip V mirrors within the rotated region: red → (1,1).
        doc.flipMarqueeVertical()
        #expect(try doc.getPixel(x: 1, y: 1) == red)

        // Rotate CW restores the original footprint and sends red home.
        doc.rotateMarqueeCw()
        #expect(doc.marquee() == AppleMarqueeRegion(x: 1, y: 1, width: 2, height: 1))
        #expect(try doc.getPixel(x: 2, y: 1) == red)

        // The pixel outside the marquee and the base layer never moved.
        #expect(try doc.getPixel(x: 0, y: 3) == green)
        try doc.setActiveLayer(id: baseId)
        #expect(try doc.getPixel(x: 1, y: 1) == blue)
    }

    @Test("marquee transforms are no-ops without a marquee")
    func marqueeTransformsNoOpWithoutMarquee() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 4)
        let red = Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF)
        try doc.setPixel(x: 1, y: 1, color: red)
        let before = doc.composite()

        doc.flipMarqueeHorizontal()
        doc.flipMarqueeVertical()
        doc.rotateMarqueeCw()
        doc.rotateMarqueeCcw()

        #expect(doc.composite() == before)
    }

    @Test("a canvas transform round-trip restores the original document")
    func canvasTransformRoundTrip() throws {
        let doc = makeSingleLayerDocument(width: 4, height: 2)
        try doc.addLayer(newId: makeLayerId(), name: "Layer 2")
        try doc.setPixel(x: 0, y: 0, color: Color(r: 0xFF, g: 0x00, b: 0x00, a: 0xFF))
        try doc.setPixel(x: 3, y: 1, color: Color(r: 0x00, g: 0xFF, b: 0x00, a: 0xFF))
        try doc.setMarquee(region: appleMarqueeFromDrag(x0: 1, y0: 0, x1: 2, y1: 1))
        let before = doc.composite()
        let marqueeBefore = doc.marquee()

        doc.flipCanvasHorizontal()
        doc.flipCanvasHorizontal()
        doc.flipCanvasVertical()
        doc.flipCanvasVertical()
        for _ in 0..<4 { doc.rotateCanvasCw() }
        for _ in 0..<4 { doc.rotateCanvasCcw() }

        #expect(doc.width() == 4 && doc.height() == 2)
        #expect(doc.composite() == before)
        #expect(doc.marquee() == marqueeBefore)
    }
}
