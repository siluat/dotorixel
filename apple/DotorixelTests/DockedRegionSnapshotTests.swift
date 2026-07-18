import Testing
import SwiftUI
import SnapshotTesting
@testable import Dotorixel

/// Rendered-layout regression tests for the docked editor's leaf region views.
///
/// These verify the **tier → rendered sizing** step: given a `LayoutTier`, does the
/// view actually render at the tier-driven dimension (e.g. the right panel is 240pt
/// wide at `.xWide`)? `DesignTokensTierSizingTests` already covers the token *values*
/// and `LayoutTierTests` covers `width → tier`; only a pixel render can confirm the
/// view *applies* the token, since the tier flows through a `GeometryReader`-measured
/// width that structural inspection can't see.
///
/// Scope, the pinned recording host, and the re-record procedure live in
/// `apple/DotorixelTests/README.md`.
///
/// Note: "snapshot" here is the image-reference testing technique
/// (swift-snapshot-testing), distinct from the History `Snapshot` (undo/redo buffer).
@Suite("Docked region views — rendered layout snapshots (tier → sizing)")
@MainActor
struct DockedRegionSnapshotTests {

    /// Fixed extent for a view's flexible axis so `.sizeThatFits` produces a
    /// deterministic image. The tier-driven axis stays intrinsic — that is the
    /// dimension each snapshot verifies (panel/toolbar width; top/status bar height).
    private let stripHeight: CGFloat = 560   // vertical strips: RightPanel, LeftToolbar
    private let barWidth: CGFloat = 640       // horizontal bars: TopBar, StatusBar

    private func state() -> EditorState { EditorState(width: 16, height: 16) }

    // MARK: - RightPanel (width: 200 wide / 240 x-wide)

    @Test("RightPanel renders wide width (200pt)")
    func rightPanelWide() {
        assertSnapshot(
            of: RightPanel(editorState: state(), tier: .wide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("RightPanel renders x-wide width (240pt)")
    func rightPanelXWide() {
        assertSnapshot(
            of: RightPanel(editorState: state(), tier: .xWide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    /// Content regression (not tier sizing): the Recent row renders its
    /// swatches most-recent first, wrapping past the panel width. Eight
    /// entries make the wrap visible (seven 22pt swatches fit one row).
    @Test("RightPanel renders a populated Recent row")
    func rightPanelPopulatedRecentRow() {
        let populated = state()
        let channels: [UInt8] = [0x20, 0x50, 0x80, 0xA0, 0xC0, 0xE0, 0xF0, 0xFF]
        for value in channels {
            populated.recordRecentColor(Color(r: value, g: 0x40, b: 0x40, a: 0xFF))
        }
        assertSnapshot(
            of: RightPanel(editorState: populated, tier: .wide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - LeftToolbar (width: 44 wide / 48 x-wide)

    @Test("LeftToolbar renders wide width (44pt)")
    func leftToolbarWide() {
        assertSnapshot(
            of: LeftToolbar(editorState: state(), tier: .wide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("LeftToolbar renders x-wide width (48pt)")
    func leftToolbarXWide() {
        assertSnapshot(
            of: LeftToolbar(editorState: state(), tier: .xWide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - TopBar (height: 44 wide / 48 x-wide)

    @Test("TopBar renders wide height (44pt)")
    func topBarWide() {
        assertSnapshot(
            of: TopBar(editorState: state(), tier: .wide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("TopBar renders x-wide height (48pt)")
    func topBarXWide() {
        assertSnapshot(
            of: TopBar(editorState: state(), tier: .xWide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    /// Content regression (not tier sizing): with a non-freehand tool active
    /// the pixel-perfect toggle renders disabled (dimmed, no accent) — the
    /// default-state bars above always show it enabled and on.
    @Test("TopBar renders the pixel-perfect toggle disabled for a non-freehand tool")
    func topBarPixelPerfectDisabled() {
        let nonFreehand = state()
        nonFreehand.activeTool = .floodFill
        assertSnapshot(
            of: TopBar(editorState: nonFreehand, tier: .wide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - StatusBar (height: 28 wide / 32 x-wide)

    @Test("StatusBar renders wide height (28pt)")
    func statusBarWide() {
        assertSnapshot(
            of: StatusBar(editorState: state(), tier: .wide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("StatusBar renders x-wide height (32pt)")
    func statusBarXWide() {
        assertSnapshot(
            of: StatusBar(editorState: state(), tier: .xWide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }
}
