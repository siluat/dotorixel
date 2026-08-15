import Testing
import SwiftUI
import SnapshotTesting
@testable import Dotorixel

/// Rendered-layout regression tests for the docked editor's leaf region views.
///
/// Most verify the **tier → rendered sizing** step: given a `LayoutTier`, does the
/// view actually render at the tier-driven dimension (e.g. the right panel is 240pt
/// wide at `.xWide`)? `DesignTokensTierSizingTests` already covers the token *values*
/// and `LayoutTierTests` covers `width → tier`; only a pixel render can confirm the
/// view *applies* the token, since the tier flows through a `GeometryReader`-measured
/// width that structural inspection can't see.
///
/// `TimelinePanel` is the exception — it takes no tier, so its snapshots pin the
/// expanded ⇄ collapsed sizing instead.
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
    private let stripHeight: CGFloat = 560   // vertical strip: LeftToolbar, RightPanel
    private let barWidth: CGFloat = 640       // horizontal bars: TopBar, StatusBar, TimelinePanel

    private func state() -> Workspace { Workspace(width: 16, height: 16) }

    /// A flow with no store — the strip and bar only need it for tap wiring,
    /// which never fires in a snapshot render.
    private func flow(_ workspace: Workspace) -> SaveFlow {
        SaveFlow(workspace: workspace, persistence: nil, flush: { true })
    }

    private func tabStrip(_ workspace: Workspace) -> TabStrip {
        TabStrip(workspace: workspace, saveFlow: flow(workspace))
    }

    private func topBar(_ workspace: Workspace, tier: LayoutTier) -> TopBar {
        TopBar(workspace: workspace, saveFlow: flow(workspace), tier: tier)
    }

    // MARK: - RightPanel (width: 200 wide / 240 x-wide)

    @Test("RightPanel renders wide width (200pt)")
    func rightPanelWide() {
        assertSnapshot(
            of: RightPanel(workspace: state(), tier: .wide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("RightPanel renders x-wide width (240pt)")
    func rightPanelXWide() {
        assertSnapshot(
            of: RightPanel(workspace: state(), tier: .xWide).frame(height: stripHeight),
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
            populated.shared.recordRecentColor(Color(r: value, g: 0x40, b: 0x40, a: 0xFF))
        }
        assertSnapshot(
            of: RightPanel(workspace: populated, tier: .wide).frame(height: stripHeight),
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
        recolored.shared.foregroundColor = Color(r: 0xFF, g: 0x8A, b: 0x65, a: 0xFF)
        assertSnapshot(
            of: RightPanel(workspace: recolored, tier: .wide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - TimelinePanel (height: 200 expanded / 44 collapsed)

    /// The panel's tier-independent sizing (issue 261): unlike the four
    /// tier-driven regions above, neither the web nor the 092 spec varies the
    /// bottom-docked panel at the 1440 breakpoint — the height these snapshots
    /// pin is the expanded/collapsed split, not a tier.

    @Test("TimelinePanel renders expanded (200pt) with the sole-layer remove disabled")
    func timelinePanelExpanded() {
        assertSnapshot(
            of: TimelinePanel(tab: state().activeTab).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("TimelinePanel renders collapsed to its header strip (44pt)")
    func timelinePanelCollapsed() {
        let collapsed = state()
        collapsed.activeTab.toggleTimelinePanel()
        assertSnapshot(
            of: TimelinePanel(tab: collapsed.activeTab).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    /// Content regression (not sizing): the layer sidebar in its new home —
    /// rows in panel order (top of stack first), the active row's tint +
    /// leading accent bar + medium-weight name, and a hidden row's slashed
    /// eye with a dimmed name. Layer 2 hidden and Layer 1 active exercises
    /// every state on distinct rows (migrated from the RightPanel baseline).
    @Test("TimelinePanel renders a multi-layer sidebar with active and hidden rows")
    func timelinePanelMultiLayerRows() throws {
        let layered = state()
        let bottomId = layered.activeTab.document.activeLayerId()
        let middleId = makeLayerId()
        try layered.activeTab.document.addLayer(newId: middleId, name: "Layer 2")
        try layered.activeTab.document.addLayer(newId: makeLayerId(), name: "Layer 3")
        layered.activeTab.setLayerVisibility(id: middleId, visible: false)
        layered.activeTab.setActiveLayer(id: bottomId)
        assertSnapshot(
            of: TimelinePanel(tab: layered.activeTab).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    /// Content regression (issue 278): the Reference row is fixed at the
    /// bottom, carries its photo kind marker, visibility and delete actions,
    /// and has no trailing reorder handle. The header also exposes the native
    /// Reference-import entry point beside Add Layer. Import leaves the row
    /// active, so the baseline also pins the fit-to-canvas affordance the
    /// active Reference row carries (issue 280).
    @Test("TimelinePanel renders the fixed Reference underlay row")
    func timelinePanelReferenceRow() throws {
        let referenced = state()
        try referenced.activeTab.setReferenceLayer(ReferenceImageSource(
            name: "guide.png",
            rgba: Data([0xFF, 0x80, 0, 0xFF]),
            width: 1,
            height: 1
        ))
        assertSnapshot(
            of: TimelinePanel(tab: referenced.activeTab).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    /// The canvas column at the macOS window's 480pt floor: 480 minus the
    /// 44pt toolbar and 200pt right panel. Narrower than the sidebar's own
    /// 256pt spec width, so it is where the panel has to yield.
    private let narrowestCanvasColumnWidth: CGFloat = 236

    /// Layout regression (issue 346 review): at the narrowest supported canvas
    /// column the sidebar can't hold its spec width — the row controls and the
    /// frame area must stay inside the panel rather than overflow it.
    @Test("TimelinePanel keeps its content inside the narrowest supported canvas column")
    func timelinePanelNarrowColumn() {
        assertSnapshot(
            of: TimelinePanel(tab: state().activeTab).frame(width: narrowestCanvasColumnWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - TabStrip (height: 36, tier-independent)

    /// Like `TimelinePanel`, the tab strip has no tier-driven axis: the web
    /// `.tab-strip` renders 36px at both docked breakpoints. These snapshots
    /// pin the height and the strip's content states instead. No ko baseline:
    /// the strip's only visible text is tab names — unlocalized document
    /// data — so a ko render would be pixel-identical (the alert and
    /// accessibility strings never render offscreen).

    @Test("TabStrip renders the sole tab with its close affordance disabled")
    func tabStripSoleTab() {
        assertSnapshot(
            of: tabStrip(state()).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("TabStrip renders the active tab elevated with the accent underline among inactive tabs")
    func tabStripMultiTabActiveDistinction() {
        let multiTab = state()
        multiTab.addTab()
        multiTab.addTab()
        multiTab.setActiveTab(1)
        assertSnapshot(
            of: tabStrip(multiTab).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - LeftToolbar (width: 44 wide / 48 x-wide)

    @Test("LeftToolbar renders wide width (44pt)")
    func leftToolbarWide() {
        assertSnapshot(
            of: LeftToolbar(workspace: state(), tier: .wide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("LeftToolbar renders x-wide width (48pt)")
    func leftToolbarXWide() {
        assertSnapshot(
            of: LeftToolbar(workspace: state(), tier: .xWide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    /// Content regression (not tier sizing): the active constrainable tool
    /// carries the Constrain badge (accent dot, top-right) while the latch is
    /// on — the default-state strips above never show it.
    @Test("LeftToolbar renders the Constrain badge on the active latched tool")
    func leftToolbarConstrainBadge() {
        let latched = state()
        latched.shared.activeTool = .line
        latched.isConstrainLatchOn = true
        assertSnapshot(
            of: LeftToolbar(workspace: latched, tier: .wide).frame(height: stripHeight),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - TopBar (height: 44 wide / 48 x-wide)

    @Test("TopBar renders wide height (44pt)")
    func topBarWide() {
        assertSnapshot(
            of: topBar(state(), tier: .wide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("TopBar renders x-wide height (48pt)")
    func topBarXWide() {
        assertSnapshot(
            of: topBar(state(), tier: .xWide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    /// Content regression (not tier sizing): with a non-freehand tool active
    /// the pixel-perfect toggle renders disabled (dimmed, no accent) — the
    /// default-state bars above always show it enabled and on.
    @Test("TopBar renders the pixel-perfect toggle disabled for a non-freehand tool")
    func topBarPixelPerfectDisabled() {
        let nonFreehand = state()
        nonFreehand.shared.activeTool = .floodFill
        assertSnapshot(
            of: topBar(nonFreehand, tier: .wide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    // MARK: - StatusBar (height: 28 wide / 32 x-wide)

    @Test("StatusBar renders wide height (28pt)")
    func statusBarWide() {
        assertSnapshot(
            of: StatusBar(workspace: state(), tier: .wide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("StatusBar renders x-wide height (32pt)")
    func statusBarXWide() {
        assertSnapshot(
            of: StatusBar(workspace: state(), tier: .xWide).frame(width: barWidth),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("StatusBar renders the active Marquee readout")
    func statusBarMarqueeReadout() {
        // A committed define drag (3,5 → 14,12): the readout reads
        // "Marquee: 12×8 at (3, 5)" next to the canvas dimensions.
        let workspace = state()
        workspace.shared.activeTool = .selection
        workspace.activeTab.beginStroke(at: ScreenCanvasCoords(x: 3, y: 5))
        workspace.activeTab.continueStroke(to: ScreenCanvasCoords(x: 14, y: 12))
        workspace.activeTab.endStroke()

        assertSnapshot(
            of: StatusBar(workspace: workspace, tier: .wide).frame(width: barWidth),
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
            of: RightPanel(workspace: state(), tier: .wide)
                .frame(height: stripHeight)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("TimelinePanel renders Korean chrome")
    func timelinePanelKoreanLocale() {
        assertSnapshot(
            of: TimelinePanel(tab: state().activeTab)
                .frame(width: barWidth)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("LeftToolbar renders Korean chrome at wide")
    func leftToolbarKoreanLocale() {
        assertSnapshot(
            of: LeftToolbar(workspace: state(), tier: .wide)
                .frame(height: stripHeight)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("TopBar renders Korean chrome at wide")
    func topBarKoreanLocale() {
        assertSnapshot(
            of: topBar(state(), tier: .wide)
                .frame(width: barWidth)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }

    @Test("StatusBar renders Korean chrome at wide")
    func statusBarKoreanLocale() {
        assertSnapshot(
            of: StatusBar(workspace: state(), tier: .wide)
                .frame(width: barWidth)
                .environment(\.locale, Locale(identifier: "ko")),
            as: .image(layout: .sizeThatFits)
        )
    }
}
