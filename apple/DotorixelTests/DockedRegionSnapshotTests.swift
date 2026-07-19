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

    /// Content regression (not tier sizing): the hex row between the FG/BG
    /// pair and the HSV picker shows the current foreground's uppercase hex
    /// digits. A non-default foreground makes the live binding visible — the
    /// default-state strips above would render the same row as 000000.
    @Test("RightPanel renders the hex row for a non-default foreground")
    func rightPanelHexRowNonDefaultForeground() {
        let recolored = state()
        recolored.foregroundColor = Color(r: 0xFF, g: 0x8A, b: 0x65, a: 0xFF)
        assertSnapshot(
            of: RightPanel(editorState: recolored, tier: .wide).frame(height: stripHeight),
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

    /// Content regression (not tier sizing): the active constrainable tool
    /// carries the Constrain badge (accent dot, top-right) while the latch is
    /// on — the default-state strips above never show it.
    @Test("LeftToolbar renders the Constrain badge on the active latched tool")
    func leftToolbarConstrainBadge() {
        let latched = state()
        latched.activeTool = .line
        latched.isConstrainLatchOn = true
        assertSnapshot(
            of: LeftToolbar(editorState: latched, tier: .wide).frame(height: stripHeight),
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

    // MARK: - Korean locale (issue 242 acceptance: translated chrome, no layout breakage)

    /// Locale regression, not tier sizing: each leaf view rendered under the
    /// ko locale baselines the String Catalog resolution path (section titles,
    /// button labels, status-bar tool name) and pins that the longer Korean
    /// strings don't break the docked layout. ko is the only baselined locale
    /// (scope decision in issue 242); LeftToolbar is icon-only, so its ko
    /// snapshot guards layout drift rather than text.

    @Test("RightPanel renders Korean chrome at wide")
    func rightPanelKoreanLocale() {
        assertSnapshot(
            of: RightPanel(editorState: state(), tier: .wide)
                .frame(height: stripHeight)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("LeftToolbar renders Korean chrome at wide")
    func leftToolbarKoreanLocale() {
        assertSnapshot(
            of: LeftToolbar(editorState: state(), tier: .wide)
                .frame(height: stripHeight)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("TopBar renders Korean chrome at wide")
    func topBarKoreanLocale() {
        assertSnapshot(
            of: TopBar(editorState: state(), tier: .wide)
                .frame(width: barWidth)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("StatusBar renders Korean chrome at wide")
    func statusBarKoreanLocale() {
        assertSnapshot(
            of: StatusBar(editorState: state(), tier: .wide)
                .frame(width: barWidth)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }
}
