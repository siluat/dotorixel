import Foundation
import Testing
@testable import Dotorixel

@Suite("Reference Layer underlay — viewport projection")
struct ReferenceLayerUnderlayTests {
    @Test("placement footprint is projected through effective pixel size and rounded pan")
    func footprintProjectsThroughViewport() {
        let underlay = ReferenceLayerUnderlay(
            sourceKey: "reference",
            sourceRgba: Data([0xFF, 0, 0, 0xFF, 0, 0xFF, 0xFF]),
            naturalWidth: 2,
            naturalHeight: 1,
            placement: AppleReferencePlacement(x: 0.5, y: 1, scale: 2, rotation: 0),
            footprint: AppleReferenceFootprint(minX: 0.5, minY: 1, maxX: 4.5, maxY: 3),
            opacity: 1
        )

        let projection = underlay.projectForRendering(
            effectivePixelSize: 10,
            panX: 3.2,
            panY: 4.6
        )

        #expect(projection.viewportRect ==
            ReferenceLayerUnderlayRect(left: 8, top: 15, width: 40, height: 20))
        #expect(projection.rotation == 0)
        #expect(projection.sourceKey == underlay.sourceKey)
    }

    @Test("the production render projection carries the core quarter-turn to Metal")
    func projectionCarriesQuarterTurn() {
        let base = ReferenceLayerUnderlay(
            sourceKey: "reference",
            sourceRgba: Data(repeating: 0, count: 4 * 2 * 4),
            naturalWidth: 4,
            naturalHeight: 2,
            placement: AppleReferencePlacement(x: 1, y: 2, scale: 1, rotation: 1),
            footprint: AppleReferenceFootprint(minX: 1, minY: 2, maxX: 3, maxY: 6),
            opacity: 1
        )

        let projection = base.projectForRendering(
            effectivePixelSize: 8,
            panX: -3.4,
            panY: 2.4
        )

        #expect(projection.rotation == 1)
        #expect(projection.viewportRect ==
            ReferenceLayerUnderlayRect(left: 5, top: 18, width: 16, height: 32))
    }
}
