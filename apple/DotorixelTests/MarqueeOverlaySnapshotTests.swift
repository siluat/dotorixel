import Testing
import SwiftUI
import SnapshotTesting
@testable import Dotorixel

/// Rendered baseline for the marching-ants Marquee overlay: the display rect
/// is clipped to the canvas-area frame, so a Marquee panned past the visible
/// area never draws over neighboring chrome (web parity: the canvas
/// container's `overflow: hidden`). Clipping is a render-time behavior only a
/// pixel render can confirm — the projection math is unit-tested separately.
///
/// Recording host and re-record procedure: `apple/DotorixelTests/README.md`.
@Suite("Marquee overlay — rendered clipping baseline")
@MainActor
struct MarqueeOverlaySnapshotTests {

    @Test("an edge Marquee's ants clip at the canvas-area bounds")
    func edgeMarqueeClipsAtBounds() throws {
        let state = Workspace(width: 8, height: 8)
        let tab = state.activeTab
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 5, y: 5, width: 3, height: 3)
        )
        // Pan pushes the Marquee's display rect (160…220pt) past the 200pt
        // frame — the reference image must show the ants cut at the edge.
        tab.viewport = AppleViewport(pixelSize: 20, zoom: 1.0, panX: 60, panY: 60)

        assertSnapshot(
            of: MarqueeOverlay(tab: tab, displayScale: 1),
            as: .image(layout: .fixed(width: 200, height: 200))
        )
    }
}
