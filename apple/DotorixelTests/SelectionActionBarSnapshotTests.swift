import SnapshotTesting
import SwiftUI
import Testing
@testable import Dotorixel

/// Rendered baselines for the touch-first Selection action surface.
/// Recording host and re-record procedure: `apple/DotorixelTests/README.md`.
@Suite("Selection action bar — rendered states")
@MainActor
struct SelectionActionBarSnapshotTests {

    @Test("Idle Marquee renders every selection and transform action")
    func idleMarquee() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 4, y: 4, width: 4, height: 4)
        )
        workspace.copySelection()
        tab.viewport = AppleViewport(pixelSize: 10, zoom: 1, panX: 50, panY: 100)

        assertSnapshot(
            of: SelectionActionBar(
                workspace: workspace,
                tab: tab,
                displayScale: 1
            ),
            as: .image(layout: .fixed(width: 480, height: 240))
        )
    }

    @Test("Floating Selection renders Commit and Cancel only")
    func floatingSelection() throws {
        let workspace = Workspace(width: 16, height: 16)
        let tab = workspace.activeTab
        try tab.document.setPixel(
            x: 2,
            y: 2,
            color: Color(r: 0xFF, g: 0, b: 0, a: 0xFF)
        )
        try tab.document.setMarquee(
            region: AppleMarqueeRegion(x: 2, y: 2, width: 2, height: 2)
        )
        tab.viewportSize = ViewportSize(width: 480, height: 240)
        tab.viewport = AppleViewport(pixelSize: 10, zoom: 1, panX: 50, panY: 100)
        workspace.copySelection()
        workspace.pasteSelectionClipboard()

        assertSnapshot(
            of: SelectionActionBar(
                workspace: workspace,
                tab: tab,
                displayScale: 1
            ),
            as: .image(layout: .fixed(width: 480, height: 240))
        )
    }
}
