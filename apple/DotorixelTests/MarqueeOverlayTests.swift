import Foundation
import Testing
@testable import Dotorixel

/// The marching-ants overlay's projection math: canvas-space Marquee region →
/// display rect in canvas-area points, the same transform the hover
/// highlight uses (`round(pan) + cell × eps`, ÷ display scale) so the ants
/// hug the selected cells at every zoom level and pan offset.
@Suite("Marquee overlay — display projection")
struct MarqueeOverlayProjectionTests {

    @Test("zoom and pan place the rect at round(pan) + region × eps, in points")
    func projectsWithZoomAndPan() {
        let region = AppleMarqueeRegion(x: 2, y: 3, width: 4, height: 5)
        let viewport = AppleViewport(pixelSize: 10, zoom: 2.0, panX: 100, panY: 50)

        let rect = marqueeDisplayRect(
            region: region, canvasWidth: 16, canvasHeight: 16,
            viewport: viewport, displayScale: 2
        )

        // eps = 10 × 2 = 20 device px; ÷ scale 2 → points.
        #expect(rect == CGRect(x: 70, y: 55, width: 40, height: 50))
    }

    @Test("a fractional pan rounds to whole device pixels before projecting")
    func fractionalPanRounds() {
        let region = AppleMarqueeRegion(x: 0, y: 0, width: 1, height: 1)
        let viewport = AppleViewport(pixelSize: 8, zoom: 1.0, panX: 100.6, panY: 49.4)

        let rect = marqueeDisplayRect(
            region: region, canvasWidth: 8, canvasHeight: 8,
            viewport: viewport, displayScale: 1
        )

        #expect(rect == CGRect(x: 101, y: 49, width: 8, height: 8))
    }

    @Test("a region reaching past the canvas is clipped to it")
    func regionPastCanvasIsClipped() {
        // Defensive parity with the web overlay: display only the on-canvas
        // part, whatever produced the oversized region.
        let region = AppleMarqueeRegion(x: 6, y: 6, width: 4, height: 4)
        let viewport = AppleViewport(pixelSize: 10, zoom: 1.0, panX: 0, panY: 0)

        let rect = marqueeDisplayRect(
            region: region, canvasWidth: 8, canvasHeight: 8,
            viewport: viewport, displayScale: 1
        )

        #expect(rect == CGRect(x: 60, y: 60, width: 20, height: 20))
    }

    @Test("a region entirely outside the canvas projects nothing")
    func regionOutsideCanvasProjectsNothing() {
        let region = AppleMarqueeRegion(x: 8, y: 8, width: 2, height: 2)
        let viewport = AppleViewport(pixelSize: 10, zoom: 1.0, panX: 0, panY: 0)

        let rect = marqueeDisplayRect(
            region: region, canvasWidth: 8, canvasHeight: 8,
            viewport: viewport, displayScale: 1
        )

        #expect(rect == nil)
    }
}
