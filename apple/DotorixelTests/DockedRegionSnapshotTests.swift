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
    private let stripHeight: CGFloat = 480   // vertical strips: RightPanel, LeftToolbar
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
