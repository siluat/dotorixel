import Testing
@testable import Dotorixel

@Suite("Navigation Bounds — canvas ∪ Reference footprint union")
struct NavigationBoundsTests {
    @Test("returns the canvas rectangle when there is no Reference footprint")
    func canvasOnlyWithoutFootprint() {
        let bounds = navigationBounds(
            canvasWidth: 16,
            canvasHeight: 24,
            referenceFootprint: nil
        )
        #expect(bounds == NavigationBounds(minX: 0, minY: 0, maxX: 16, maxY: 24))
    }

    @Test("expands to the union when the Reference footprint extends beyond the canvas")
    func unionWithProtrudingFootprint() {
        let bounds = navigationBounds(
            canvasWidth: 16,
            canvasHeight: 16,
            referenceFootprint: AppleReferenceFootprint(
                minX: -5, minY: 2, maxX: 40, maxY: 12
            )
        )
        #expect(bounds == NavigationBounds(minX: -5, minY: 0, maxX: 40, maxY: 16))
    }

    @Test("returns the canvas rectangle when the Reference footprint lies inside it")
    func canvasWithContainedFootprint() {
        let bounds = navigationBounds(
            canvasWidth: 16,
            canvasHeight: 16,
            referenceFootprint: AppleReferenceFootprint(
                minX: 2, minY: 2, maxX: 10, maxY: 10
            )
        )
        #expect(bounds == NavigationBounds(minX: 0, minY: 0, maxX: 16, maxY: 16))
    }
}
