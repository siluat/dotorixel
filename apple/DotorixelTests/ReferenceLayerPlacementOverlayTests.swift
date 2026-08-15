import CoreGraphics
import Testing
@testable import Dotorixel

@Suite("Reference placement overlay — footprint projection")
struct ReferencePlacementOverlayProjectionTests {

    @Test("the overlay rect projects the Reference Footprint through zoom and pan")
    func projectsFootprintThroughViewport() {
        // eps = 10 × 2 = 20 device px per canvas pixel; pan offsets the origin.
        // Left = 30 + 1.5 × 20 = 60 device px → 30pt at @2x; the 4 × 2 canvas
        // -pixel footprint spans 80 × 40 device px → 40 × 20pt.
        let viewport = AppleViewport(pixelSize: 10, zoom: 2, panX: 30, panY: -20)
        let footprint = AppleReferenceFootprint(minX: 1.5, minY: 2, maxX: 5.5, maxY: 4)

        #expect(referencePlacementOverlayRect(
            footprint: footprint,
            viewport: viewport,
            displayScale: 2
        ) == CGRect(x: 30, y: 10, width: 40, height: 20))
    }
}

@Suite("Reference placement overlay — handles")
struct ReferencePlacementHandleTests {

    @Test("every handle carries a touch-minimum target centered on its corner")
    func handleTargetsMeetTheTouchMinimum() {
        let box = CGRect(x: 100, y: 100, width: 200, height: 100)
        let corners: [ReferencePlacementHandle: CGPoint] = [
            .topLeft: CGPoint(x: 100, y: 100),
            .topRight: CGPoint(x: 300, y: 100),
            .bottomRight: CGPoint(x: 300, y: 200),
            .bottomLeft: CGPoint(x: 100, y: 200),
        ]

        for (handle, corner) in corners {
            let rect = referencePlacementHandleRect(handle, in: box)
            #expect(rect.width >= 44)
            #expect(rect.height >= 44)
            #expect(rect.midX == corner.x)
            #expect(rect.midY == corner.y)
        }
    }

    @Test("a press resolves to the nearest corner, or to the body between them")
    func pressResolvesToHandleOrBody() {
        let box = CGRect(x: 100, y: 100, width: 200, height: 100)

        #expect(referencePlacementHandle(at: CGPoint(x: 100, y: 100), in: box) == .topLeft)
        #expect(referencePlacementHandle(at: CGPoint(x: 300, y: 200), in: box) == .bottomRight)
        #expect(referencePlacementHandle(at: CGPoint(x: 200, y: 150), in: box) == nil)
    }

    @Test("a box smaller than its handles still resolves each corner distinctly")
    func overlappingHandlesResolveToTheNearestCorner() {
        // 4 × 4pt box: every 44pt target covers the whole box, so proximity —
        // not stacking order — has to decide which corner a press grabs.
        let box = CGRect(x: 10, y: 10, width: 4, height: 4)

        #expect(referencePlacementHandle(at: CGPoint(x: 10, y: 10), in: box) == .topLeft)
        #expect(referencePlacementHandle(at: CGPoint(x: 14, y: 10), in: box) == .topRight)
        #expect(referencePlacementHandle(at: CGPoint(x: 14, y: 14), in: box) == .bottomRight)
        #expect(referencePlacementHandle(at: CGPoint(x: 10, y: 14), in: box) == .bottomLeft)
    }
}
