import SwiftUI

/// Bottom-docked Timeline panel: a header strip over the reserved transport
/// slot, the frame ruler, and the `[layer row × frame column]` grid beside the
/// layer sidebar. Mirrors web `TimelinePanel.svelte` and the `092 —
/// TimelinePanel Design Spec` / `187 — Frame Ruler` specs for cross-shell
/// parity, with SwiftUI-native controls sized to the HIG touch minimum instead
/// of the web's 32px desktop rows.
///
/// The ruler band is pinned above the scrolling rows, so scrolling a tall layer
/// stack never takes the frame ordinals with it, and an axis wider than the
/// panel scrolls horizontally — the grid carries the scroller and the ruler
/// mirrors its offset, so ordinal N stays over column N at any scroll position.
struct TimelinePanel: View {
    let tab: TabState

    /// The layer reorder drag currently under a handle, or nil while none is.
    /// View-local by nature: it lives and dies with the gesture and never
    /// reaches the document until the drop commits.
    @State private var layerDrag: ReorderDrag?

    /// The frame ruler's press, from touch-down to the release it resolves
    /// into. Separate from `layerDrag` because the two axes are independent
    /// surfaces: a live layer drag must not read as a frame drag's preview.
    /// Unlike the sidebar's bare drag, this one is a state machine — the
    /// header carries two roles, and telling a tap from a drag (and either
    /// from a press whose drag was cancelled) takes more than the drag alone.
    @State private var frameInteraction = FrameReorderInteraction(
        // The column extent and threshold the ruler renders at — `@State`
        // initializers cannot read `frameColumnWidth` / `frameDragThreshold`,
        // which resolve to these same values.
        itemExtent: DesignTokens.btnSize,
        tapThreshold: frameDragThreshold
    )
    @State private var isReferenceImporterPresented = false
    @State private var referenceImportErrorMessage: String?

    /// Controlled draft for the duration editor: it mirrors the active frame's
    /// stored duration but holds the user's raw in-progress text while editing
    /// (web parity). Typing only mutates the draft; the stored value re-seeds
    /// it on frame switch, undo, or the post-commit clamp round-trip — the
    /// paths where the draft would otherwise show a stale number.
    @State private var durationDraft = ""
    @FocusState private var isDurationEditorFocused: Bool

    /// How far the frame grid is scrolled along the axis — zero at rest and
    /// negative once scrolled, the leading edge's position in the scroller's
    /// own space. The pinned ruler band offsets by this to follow the grid.
    @State private var axisScrollOffset: CGFloat = 0

    /// Panel rows and the header strip share the touch-minimum height — the
    /// Apple stand-in for the web's `--row-height`, which drives both there too.
    private let rowHeight = DesignTokens.btnSize

    /// The frame ruler's band height and each frame column's width — the Apple
    /// stand-in for the web's `--ruler-height` / `--frame-col-width`, both of
    /// which derive from its row height. Squaring them at the touch minimum
    /// keeps every ruler header a 44×44 target.
    private let rulerHeight = DesignTokens.btnSize
    private let frameColumnWidth = DesignTokens.btnSize

    /// Reserved band above the ruler where the playback transport lands (issue
    /// 289). Held at the height its controls will need, so filling it never
    /// moves the ruler or the rows beneath.
    private let transportSlotHeight = DesignTokens.btnSize

    /// The occupancy dot marking a content-bearing Cel — web `--cel-dot-size`.
    private let celDotSize: CGFloat = 6

    /// The duration editor field's width — the web's mobile sizing for this
    /// control (64px), whose height the 44pt ruler band already provides.
    private let durationFieldWidth: CGFloat = 64

    /// The photo glyph marking the Reference Layer, drawn on both its sidebar
    /// row and its grid band. Smaller than `DesignTokens.iconSize` on purpose:
    /// it is a kind marker beside a name, not a control.
    private let referenceGlyphSize: CGFloat = 12

    /// Web Timeline sidebar visual references (raw CSS, not tokens): the
    /// active row's leading accent bar is `--ds-border-width-thick` (2px) and
    /// a hidden row's name dims to opacity 0.45.
    private let activeBarWidth: CGFloat = 2
    private let hiddenNameOpacity: Double = 0.45

    /// The lift under a row being dragged — web `.row--dragging`:
    /// `box-shadow: 0 4px 14px rgb(0 0 0 / 0.18)`.
    private let draggedRowShadowOpacity: Double = 0.18
    private let draggedRowShadowRadius: CGFloat = 14
    private let draggedRowShadowOffsetY: CGFloat = 4

    /// Item stacking while a reorder previews — see `dragDepth`.
    private let draggedItemDepth: Double = 2
    private let shiftedItemDepth: Double = 1
    private let restingItemDepth: Double = 0

    /// Travel a ruler header's press must exceed before it reads as a reorder
    /// drag rather than a tap (web parity: `FRAME_DRAG_THRESHOLD_PX`). The
    /// header carries both roles, so below this the press selects the frame and
    /// above it the press moves the frame — a distinction the layer sidebar
    /// does not need, where a dedicated handle owns the drag.
    private static let frameDragThreshold: CGFloat = 4

    /// The panel's separator lines — web `--ds-border-width`: 1px. Named
    /// because `bodyHeight` subtracts it, where a bare `1` would read as
    /// arbitrary rather than as the divider it makes room for.
    private let dividerThickness: CGFloat = 1

    /// Height left for the scrolling rows once the header strip, its divider,
    /// and the two pinned bands above the rows are laid out.
    private var bodyHeight: CGFloat {
        DesignTokens.timelinePanelHeight
            - rowHeight
            - dividerThickness
            - transportSlotHeight
            - rulerHeight
    }

    private var isCollapsed: Bool { tab.isTimelinePanelCollapsed }

    var body: some View {
        VStack(spacing: 0) {
            header
            // Collapsed is a read-only summary strip (web parity): the body and
            // the add action leave the hierarchy entirely, so no row control
            // stays focusable behind a closed panel.
            if !isCollapsed {
                divider
                transportSlot
                rulerAndRows
            }
        }
        .frame(height: isCollapsed ? rowHeight : DesignTokens.timelinePanelHeight)
        .frame(maxWidth: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(height: dividerThickness)
        }
        // A structural change mid-drag — a second finger adding or removing a
        // layer, ⌘Z restoring another stack — invalidates the drag's captured
        // geometry, so cancel the preview rather than commit against rows that
        // no longer exist. Removing the dragged row itself also lands here: its
        // gesture is torn down without `onEnded`, and this is what clears the
        // state it leaves behind. The drop's own commit is exempt — it clears
        // the drag before mutating, so this fires with nothing to cancel.
        .onChange(of: layerIdsInPanelOrder) {
            guard layerDrag != nil else { return }
            layerDrag = nil
        }
        // The frame axis's own version of the same guard: a frame added or
        // removed mid-drag — by a second finger, or by ⌘Z restoring another
        // axis — invalidates the drag's captured column geometry.
        .onChange(of: frameIdsInAxisOrder) {
            frameInteraction.axisChanged(to: frameIdsInAxisOrder)
        }
        .fileImporter(
            isPresented: $isReferenceImporterPresented,
            allowedContentTypes: ReferenceImageImporter.supportedContentTypes
        ) { result in
            importReference(from: result)
        }
        .alert(
            "Reference import failed",
            isPresented: Binding(
                get: { referenceImportErrorMessage != nil },
                set: { if !$0 { referenceImportErrorMessage = nil } }
            )
        ) {
            Button("OK", role: .cancel) {
                referenceImportErrorMessage = nil
            }
        } message: {
            Text(referenceImportErrorMessage ?? "")
        }
    }

    /// The stack's identity in panel order — what a live reorder drag's
    /// geometry is captured against, watched to cancel the drag when it
    /// changes. Visibility flips keep the same ids, so they don't cancel.
    private var layerIdsInPanelOrder: [String] {
        tab.layersInPanelOrder.map(\.id)
    }

    /// The axis's identity in column order — the frame-axis mirror of
    /// `layerIdsInPanelOrder`. A duration edit keeps the same ids, so it
    /// doesn't cancel a live drag.
    private var frameIdsInAxisOrder: [String] {
        frameColumns.map(\.id)
    }

    /// Whether either axis is previewing a reorder — what both scrollers lock
    /// on, so the content cannot travel under a drag that captured its geometry
    /// at press time.
    private var isReorderPreviewing: Bool {
        layerDrag != nil || frameInteraction.drag != nil
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: DesignTokens.space2) {
            if !isCollapsed {
                addLayerButton
                addReferenceButton
            }
            headerLabel
            Spacer(minLength: 0)
            if !isCollapsed {
                // Sized before the flexible label and spacer, so a narrow panel
                // truncates "Layers" rather than starving the frame commands.
                frameActions.layoutPriority(1)
            }
            collapseToggle
        }
        // The expanded header's inset comes from the add button's touch box;
        // collapsed, the label sits flush, so it takes the spec's own padding.
        .padding(.horizontal, isCollapsed ? DesignTokens.space4 : DesignTokens.space2)
        .frame(height: rowHeight)
    }

    /// Expanded, the header names the panel; collapsed, it summarizes what the
    /// closed panel hides — the active layer (web parity:
    /// `layer_panel_collapsed_label`).
    @ViewBuilder
    private var headerLabel: some View {
        if isCollapsed {
            Text("Layers · \(activeLayerName)")
                .font(.system(size: DesignTokens.fontSize, weight: .medium))
                .foregroundStyle(DesignTokens.textSecondary)
                // Same one-line truncation the row names take, so a long
                // active-layer name can't wrap inside the fixed-height strip
                // or squeeze the collapse chevron.
                .lineLimit(1)
                .truncationMode(.tail)
        } else {
            Text("Layers")
                .font(.system(size: DesignTokens.fontSize, weight: .semibold))
                .foregroundStyle(DesignTokens.textPrimary)
                // The frame group is sized first, so this is the label that
                // gives way on a narrow panel — truncating rather than wrapping
                // out of the fixed-height strip.
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    private var activeLayerName: String {
        tab.layersInPanelOrder
            .first { $0.id == tab.activeLayerId }?
            .name ?? ""
    }

    /// The header's add action: a transparent layer lands directly above the
    /// active one and becomes the drawing target (web parity: the Timeline
    /// header's `+`).
    private var addLayerButton: some View {
        PanelIconButton(
            systemName: "plus",
            accessibilityLabel: "Add layer",
            action: tab.addLayer
        )
    }

    /// Native file-picker entry point for the singleton tracing underlay.
    /// Selecting another image replaces the current Reference in one Edit.
    private var addReferenceButton: some View {
        PanelIconButton(
            systemName: "photo.badge.plus",
            accessibilityLabel: "Add reference image",
            action: { isReferenceImporterPresented = true }
        )
    }

    // MARK: - Frame actions

    /// The header's frame commands, all acting on the Active Frame (web parity:
    /// the header's right-hand `Frames` group).
    ///
    /// Three touch-minimum targets need room the panel does not always have —
    /// at the narrowest supported canvas column six of them overflow the header
    /// — so the same three commands collapse into one menu button when the row
    /// cannot fit. The `Frames` label disambiguates the two `+` actions: the
    /// left one adds a layer, this one adds a frame.
    private var frameActions: some View {
        ViewThatFits(in: .horizontal) {
            frameActionRow
            frameActionMenu
        }
    }

    private var frameActionRow: some View {
        HStack(spacing: DesignTokens.space2) {
            Text("Frames")
                .font(.system(size: DesignTokens.fontSize, weight: .semibold))
                .foregroundStyle(DesignTokens.textPrimary)
            PanelIconButton(
                systemName: Self.addFrameSymbol,
                accessibilityLabel: "Add frame",
                action: tab.addFrame
            )
            PanelIconButton(
                systemName: Self.duplicateFrameSymbol,
                accessibilityLabel: "Duplicate frame",
                action: tab.duplicateFrame
            )
            PanelIconButton(
                systemName: Self.deleteFrameSymbol,
                accessibilityLabel: "Delete frame",
                tint: DesignTokens.textTertiary,
                isEnabled: tab.canRemoveFrame,
                action: removeActiveFrame
            )
        }
        // Reports the row's uncompressed width, so `ViewThatFits` measures what
        // the row actually needs instead of the width its label can shrink to.
        .fixedSize(horizontal: true, vertical: false)
    }

    /// The narrow-panel form of the group: one target carrying the same three
    /// commands, each a full-width menu row.
    private var frameActionMenu: some View {
        Menu {
            Button("Add frame", systemImage: Self.addFrameSymbol, action: tab.addFrame)
            Button(
                "Duplicate frame",
                systemImage: Self.duplicateFrameSymbol,
                action: tab.duplicateFrame
            )
            Button(
                "Delete frame",
                systemImage: Self.deleteFrameSymbol,
                role: .destructive,
                action: removeActiveFrame
            )
            .disabled(!tab.canRemoveFrame)
        } label: {
            PanelIconGlyph(systemName: "film")
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .accessibilityLabel("Frames")
    }

    /// Delete targets the Active Frame, and the last remaining frame is never
    /// removable — a document always carries at least one (the command refuses
    /// it too; the disabled affordance just keeps the dead action out of reach).
    private func removeActiveFrame() {
        tab.removeFrame(id: tab.activeFrameId)
    }

    private static let addFrameSymbol = "plus"
    private static let duplicateFrameSymbol = "plus.square.on.square"
    private static let deleteFrameSymbol = "trash"

    private func importReference(from result: Result<URL, Error>) {
        switch result {
        case let .success(url):
            do {
                try tab.importReference(at: url)
            } catch {
                referenceImportErrorMessage = error.localizedDescription
            }
        case let .failure(error):
            referenceImportErrorMessage = error.localizedDescription
        }
    }

    /// Points down while expanded and up while collapsed — "click to expand",
    /// the direction chosen for the web chevron.
    private var collapseToggle: some View {
        PanelIconButton(
            systemName: "chevron.down",
            accessibilityLabel: isCollapsed ? "Expand layers panel" : "Collapse layers panel",
            action: tab.toggleTimelinePanel
        )
        .rotationEffect(.degrees(isCollapsed ? 180 : 0))
    }

    // MARK: - Body

    /// The pinned ruler band and the scrolling rows beneath it. Both take their
    /// sidebar width from one measurement, so the ruler's corner and the layer
    /// sidebar end at the same x and ordinal N stays over column N — two bands
    /// resolving their own flexible widths drift apart wherever the sidebar's
    /// row controls out-measure the empty corner.
    private var rulerAndRows: some View {
        GeometryReader { proxy in
            let sidebarWidth = sidebarWidth(in: proxy.size.width)
            let paneWidth = max(0, proxy.size.width - sidebarWidth - dividerThickness)
            VStack(spacing: 0) {
                rulerBand(sidebarWidth: sidebarWidth, paneWidth: paneWidth)
                panelBody(sidebarWidth: sidebarWidth, paneWidth: paneWidth)
            }
        }
        .frame(height: rulerHeight + bodyHeight)
        // Collapsing mid-drag takes the ruler with it, tearing the header's
        // gesture down without `onEnded` — the frame-axis twin of the body's
        // own guard below. The cancel flag goes with it: no release is coming
        // to consume it.
        .onDisappear { frameInteraction.reset() }
    }

    /// The sidebar holds its spec width wherever the canvas column can seat it
    /// and yields below that, always leaving room for the first frame column —
    /// a hard `width` would push the header's add and collapse controls outside
    /// the panel once the column drops under 256pt, which the macOS window's
    /// 480pt floor reaches (480 − 44 toolbar − 200 right panel). The web
    /// narrows its sidebar at the mobile tier for the same reason.
    ///
    /// Only the first column is reserved, not the whole axis: the sidebar must
    /// not shrink every time a frame is added.
    private func sidebarWidth(in availableWidth: CGFloat) -> CGFloat {
        let seatable = availableWidth - dividerThickness - frameColumnWidth
        return min(DesignTokens.timelineSidebarWidth, max(0, seatable))
    }

    /// Sidebar and frame grid scroll as one unit so each layer row stays
    /// aligned with its frame column cell once the rows outgrow the panel
    /// (the alignment web `TimelinePanel` had to fix after splitting them).
    private func panelBody(sidebarWidth: CGFloat, paneWidth: CGFloat) -> some View {
        ScrollView(.vertical) {
            HStack(alignment: .top, spacing: 0) {
                layerSidebar(width: sidebarWidth)
                verticalDivider
                frameGridScroller(paneWidth: paneWidth)
            }
            // Short layer stacks still fill the panel, so the divider and the
            // frame grid span the body instead of stopping at row one.
            .frame(minHeight: bodyHeight, alignment: .top)
        }
        .frame(height: bodyHeight)
        // A layer reorder drag travels along the same axis this scrolls. The
        // handle's gesture claims the press on touch-down (`minimumDistance:
        // 0`), so the lock lands before any travel could be read as a scroll
        // instead.
        .scrollDisabled(isReorderPreviewing)
        // Collapsing mid-drag removes the rows and tears their gestures down
        // without `onEnded` — drop the drag with the body so no preview offsets
        // or scroll lock survive into the next expand.
        .onDisappear { layerDrag = nil }
    }

    private func layerSidebar(width: CGFloat) -> some View {
        VStack(spacing: 0) {
            // Panel order: top of the stack renders at the top.
            ForEach(
                Array(tab.layersInPanelOrder.enumerated()),
                id: \.element.id
            ) { panelIndex, layer in
                layerRow(layer, panelIndex: panelIndex)
            }
        }
        .frame(width: width)
    }

    private func layerRow(_ layer: AppleLayerMetadata, panelIndex: Int) -> some View {
        let isActive = tab.activeLayerId == layer.id
        let isDragging = layerDrag?.itemId == layer.id
        let reorderOffset = layerDrag?.offset(forIndex: panelIndex) ?? 0
        return HStack(spacing: DesignTokens.space2) {
            visibilityToggle(layer)
            if layer.kind == .reference {
                referenceKindIcon
            }
            rowSelectButton(layer, isActive: isActive)
            if layer.kind == .reference, isActive {
                fitReferenceToCanvasButton(layer)
            }
            removeLayerButton(layer)
            if layer.kind == .pixel {
                reorderHandle(layer, panelIndex: panelIndex)
            }
        }
        // Full-height touch-minimum rows keep every target at the HIG minimum.
        .frame(height: rowHeight)
        // The dragged row needs an opaque fill of its own: rows are otherwise
        // transparent, and it travels across the ones it passes.
        .background(isActive || isDragging ? DesignTokens.bgActive : .clear)
        .overlay(alignment: .leading) {
            if isActive {
                Rectangle()
                    .fill(DesignTokens.accent)
                    .frame(width: activeBarWidth)
                    // Decoration only — it overlaps the eye's leading edge
                    // and must never swallow those taps.
                    .allowsHitTesting(false)
            }
        }
        .shadow(
            color: isDragging ? .black.opacity(draggedRowShadowOpacity) : .clear,
            radius: draggedRowShadowRadius,
            y: draggedRowShadowOffsetY
        )
        .offset(y: reorderOffset)
        .zIndex(dragDepth(isDragging: isDragging, reorderOffset: reorderOffset))
    }

    /// Which items draw over which while a reorder previews: the travelling one
    /// over everything, a shifted one over those still at rest. Shared by both
    /// axes — layer rows and ruler columns stack the same way. Web parity:
    /// `.row--dragging` / `.frame-ruler-cell--dragging` z-index 2, their
    /// `--drag-shifted` siblings 1.
    private func dragDepth(isDragging: Bool, reorderOffset: CGFloat) -> Double {
        if isDragging { return draggedItemDepth }
        return reorderOffset == 0 ? restingItemDepth : shiftedItemDepth
    }

    /// The row's reorder affordance: a drag-only handle at the trailing edge
    /// (web parity: the row's `≡`), disabled while a sole layer has nowhere
    /// to move to. Drag-only by design — a tap resolves to the row's own
    /// position, which the drop treats as a no-op.
    private func reorderHandle(_ layer: AppleLayerMetadata, panelIndex: Int) -> some View {
        PanelIconGlyph(
            systemName: "line.3.horizontal",
            tint: DesignTokens.textTertiary,
            isEnabled: tab.canReorderLayer(id: layer.id)
        )
        .gesture(layerReorderGesture(layer, panelIndex: panelIndex))
        .disabled(!tab.canReorderLayer(id: layer.id))
        .accessibilityLabel("Reorder \(layer.name)")
        // The pointer-free path to the same command: VoiceOver's adjust
        // gesture (and the rotor) steps the row through the stack.
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment:
                tab.reorderLayer(id: layer.id, toPanelIndex: panelIndex + 1)
            case .decrement:
                tab.reorderLayer(id: layer.id, toPanelIndex: panelIndex - 1)
            @unknown default:
                break
            }
        }
    }

    /// `minimumDistance: 0` so the handle claims the press immediately rather
    /// than after a travel threshold — the row underneath is a select target,
    /// and a handoff mid-press would select instead of drag.
    private func layerReorderGesture(_ layer: AppleLayerMetadata, panelIndex: Int) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if layerDrag?.itemId == layer.id {
                    layerDrag?.translation = value.translation.height
                } else if layerDrag == nil {
                    layerDrag = ReorderDrag(
                        itemId: layer.id,
                        baseIndex: panelIndex,
                        itemCount: tab.pixelLayersInPanelOrder.count,
                        itemExtent: rowHeight,
                        translation: value.translation.height
                    )
                }
                // A handle pressed while another row's drag is live falls
                // through both branches: only the initiating pointer drives a
                // drag (web parity), and `onEnded`'s id guard below keeps that
                // second pointer from committing or clearing it.
            }
            .onEnded { value in
                guard var drag = layerDrag, drag.itemId == layer.id else { return }
                drag.translation = value.translation.height
                layerDrag = nil
                tab.reorderLayer(id: layer.id, toPanelIndex: drag.targetIndex)
            }
    }

    /// The row's tap surface: selects the layer as the drawing target.
    /// The name spans the remaining row width so the whole row (minus the
    /// icon buttons) is tappable — web parity: the row itself is the select
    /// target.
    private func rowSelectButton(_ layer: AppleLayerMetadata, isActive: Bool) -> some View {
        Button {
            tab.setActiveLayer(id: layer.id)
        } label: {
            Text(verbatim: layer.name)
                .font(.system(
                    size: DesignTokens.fontSize,
                    weight: isActive ? .medium : .regular
                ))
                .foregroundStyle(DesignTokens.textPrimary)
                .opacity(layer.visible ? 1 : hiddenNameOpacity)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(height: rowHeight)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: layer.name))
        .accessibilityValue(layer.kind == .reference ? Text("Reference image") : Text(verbatim: ""))
        .accessibilityAddTraits(isActive ? .isSelected : [])
    }

    /// The active Reference row's fit action: re-centers and re-fits the
    /// placement to the canvas in one undoable step. Shown only on the active
    /// row (web parity: `.fit-canvas-btn`), where the placement overlay is
    /// live and the reset has a visible effect.
    private func fitReferenceToCanvasButton(_ layer: AppleLayerMetadata) -> some View {
        PanelIconButton(
            systemName: "arrow.up.left.and.arrow.down.right",
            accessibilityLabel: "Fit \(layer.name) to canvas",
            tint: DesignTokens.textTertiary,
            action: { tab.fitReferenceLayerToCanvas() }
        )
    }

    /// The row's remove action. Disabled at the sole-layer guard — a
    /// document always keeps at least one layer — mirroring the web's
    /// disabled `✕` affordance.
    private func removeLayerButton(_ layer: AppleLayerMetadata) -> some View {
        PanelIconButton(
            systemName: "xmark",
            accessibilityLabel: "Delete \(layer.name)",
            tint: DesignTokens.textTertiary,
            isEnabled: tab.canRemoveLayer(id: layer.id),
            action: { tab.removeLayer(id: layer.id) }
        )
    }

    private func visibilityToggle(_ layer: AppleLayerMetadata) -> some View {
        PanelIconButton(
            systemName: layer.visible ? "eye" : "eye.slash",
            accessibilityLabel: layer.visible ? "Hide \(layer.name)" : "Show \(layer.name)",
            tint: layer.visible ? DesignTokens.textSecondary : DesignTokens.textTertiary,
            action: { tab.setLayerVisibility(id: layer.id, visible: !layer.visible) }
        )
    }

    /// Non-interactive kind marker. The photo glyph makes the Reference row's
    /// fixed underlay role distinct without narrowing ordinary Pixel names.
    private var referenceKindIcon: some View {
        Image(systemName: "photo")
            .font(.system(size: referenceGlyphSize))
            .foregroundStyle(DesignTokens.textTertiary)
            .frame(width: 14, height: 14)
            .accessibilityHidden(true)
    }

    // MARK: - Transport slot (reserved for issue 289)

    /// The band the playback transport will occupy. Empty and dim on purpose:
    /// it holds the space so 289's controls arrive without moving the ruler,
    /// and it carries nothing for VoiceOver to announce until they do.
    private var transportSlot: some View {
        Rectangle()
            .fill(DesignTokens.bgSurface)
            .frame(height: transportSlotHeight)
            .overlay(alignment: .bottom) {
                Rectangle()
                    .fill(DesignTokens.borderSubtle)
                    .frame(height: dividerThickness)
            }
            .accessibilityHidden(true)
    }

    // MARK: - Frame ruler

    private var frameColumns: [FrameColumn] { tab.frameColumns }

    /// Total width of the frame axis — what the ruler's headers and the grid's
    /// cel rows are both pinned to, so ordinal N sits over column N.
    private var frameAxisWidth: CGFloat {
        frameColumnWidth * CGFloat(frameColumns.count)
    }

    /// The band over the scrolling rows: the active frame's duration editor
    /// in the corner, beside the ruler's ordinal headers.
    private func rulerBand(sidebarWidth: CGFloat, paneWidth: CGFloat) -> some View {
        HStack(alignment: .top, spacing: 0) {
            durationCorner(width: sidebarWidth)
            verticalDivider
            frameRuler(paneWidth: paneWidth)
        }
        .frame(height: rulerHeight)
        .background(DesignTokens.bgElevated)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(height: dividerThickness)
        }
    }

    /// The active frame's stored duration — the truth the editor's draft
    /// mirrors and every commit resolves against.
    private var activeFrameDurationMs: UInt32 {
        frameColumns.first(where: { $0.id == tab.activeFrameId })?.durationMs ?? 0
    }

    /// Read-only fps helper derived from the duration (1000 / ms) — display
    /// only, never an input; per-frame ms stays the single source of truth
    /// (web parity). Guarded so the 0 fallback never divides.
    private var activeFrameFps: Int {
        activeFrameDurationMs > 0 ? Int((1000 / Double(activeFrameDurationMs)).rounded()) : 0
    }

    /// Commits the draft on submit / focus loss: a resolved value dispatches
    /// one undoable retime, and the field reconciles to the stored truth
    /// either way — reverting an invalid or unchanged entry, snapping a
    /// clamped one to the bound it landed on.
    ///
    /// `frameId` names the frame the edit belongs to and defaults to the
    /// active one; the mid-edit frame switch passes the frame being left,
    /// because by the time it can commit the switch has already happened (on
    /// the web the field blurs *before* the click switches frames, so its
    /// commit lands on the old frame for free).
    private func commitDurationDraft(to frameId: String? = nil) {
        let targetId = frameId ?? tab.activeFrameId
        // A vanished target (its frame undone away mid-edit) resolves against
        // 0 and dispatches; the binding refuses the unknown id and records
        // nothing, so the commit degrades to the revert below.
        let stored = frameColumns.first(where: { $0.id == targetId })?.durationMs ?? 0
        if let value = FrameDurationDraft.resolveCommit(draft: durationDraft, current: stored) {
            tab.setFrameDuration(id: targetId, durationMs: value)
        }
        durationDraft = String(activeFrameDurationMs)
    }

    /// The top-left corner doubles as the active frame's duration editor (194
    /// design, issue 287): aligned with the ruler, it edits whichever frame is
    /// active, beside the read-only fps helper. The field spans the ruler's
    /// 44pt band, so its tap target meets the touch minimum (the web's mobile
    /// sizing for this same control).
    private func durationCorner(width: CGFloat) -> some View {
        HStack(spacing: DesignTokens.space2) {
            durationField
            Text(verbatim: "ms")
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textSecondary)
                .accessibilityHidden(true)
            Spacer(minLength: 0)
            Text(verbatim: "\(activeFrameFps) fps")
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textTertiary)
                .accessibilityHidden(true)
        }
        .padding(.horizontal, DesignTokens.space3)
        .frame(width: width, height: rulerHeight)
    }

    /// What the duration editor's sync observes as one value: the active
    /// frame and its stored duration. See the `onChange` on `durationField`.
    private struct DurationEditorSyncKey: Equatable {
        let frameId: String
        let storedMs: UInt32
    }

    private var durationField: some View {
        TextField("", text: $durationDraft)
            .textFieldStyle(.plain)
            .multilineTextAlignment(.center)
            .font(.system(size: DesignTokens.fontSizeSm))
            .foregroundStyle(DesignTokens.textPrimary)
            .frame(width: durationFieldWidth)
            .frame(maxHeight: .infinity)
            .background(DesignTokens.bgSurface)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
            .overlay {
                RoundedRectangle(cornerRadius: DesignTokens.radiusSm)
                    .strokeBorder(
                        isDurationEditorFocused ? DesignTokens.accent : DesignTokens.borderSubtle
                    )
            }
            .focused($isDurationEditorFocused)
            #if os(iOS)
            .keyboardType(.numberPad)
            #endif
            .accessibilityLabel(Text("Frame duration in milliseconds"))
            // Submit commits in place (web parity: Enter never forces a blur,
            // which would fire a second, stale commit); Escape discards the
            // in-progress edit and restores the stored value.
            .onSubmit { commitDurationDraft() }
            .onKeyPress(.escape) {
                durationDraft = String(activeFrameDurationMs)
                isDurationEditorFocused = false
                return .handled
            }
            .onChange(of: isDurationEditorFocused) { _, isFocused in
                if !isFocused { commitDurationDraft() }
            }
            // One observation sees the frame switch and the same-frame store
            // change together, so the two are told apart without relying on
            // the ordering of separate `onChange` modifiers.
            .onChange(of: DurationEditorSyncKey(
                frameId: tab.activeFrameId,
                storedMs: activeFrameDurationMs
            )) { previous, current in
                if current.frameId != previous.frameId {
                    // A ruler tap switches frames without resigning the
                    // field's focus (SwiftUI taps outside a TextField don't),
                    // so a mid-edit switch commits the in-progress edit to the
                    // frame it was typed for — the frame being left — rather
                    // than leaking it onto the new frame or losing it. (The
                    // web gets this for free: its field blurs before the
                    // click switches frames.)
                    if isDurationEditorFocused {
                        commitDurationDraft(to: previous.frameId)
                    }
                    durationDraft = String(activeFrameDurationMs)
                } else {
                    // Same frame, stored value changed — undo, redo, or the
                    // post-commit clamp round-trip: re-sync the draft.
                    durationDraft = String(current.storedMs)
                }
            }
            .onAppear { durationDraft = String(activeFrameDurationMs) }
    }

    /// The ordinal headers, pinned vertically and scrolled horizontally by the
    /// grid below: the band carries no scroller of its own, it re-renders at
    /// the grid's offset. One scroller drives both, so the ordinal and its
    /// column can never drift apart the way two independent scrollers would.
    private func frameRuler(paneWidth: CGFloat) -> some View {
        HStack(spacing: 0) {
            ForEach(Array(frameColumns.enumerated()), id: \.element.id) { index, frame in
                rulerHeader(frame, axisIndex: index)
            }
        }
        .frame(width: frameAxisWidth, alignment: .leading)
        .offset(x: axisScrollOffset)
        .frame(width: paneWidth, alignment: .leading)
        // `frame` sizes but does not clip, and the scrolled-in headers on both
        // sides of the pane would otherwise draw over the sidebar and over the
        // canvas beside the panel.
        .clipped()
    }

    /// One frame's ordinal header — the target that makes it the Active Frame,
    /// and the surface its reorder drag travels on. The active column carries
    /// two channels so it reads without hue (web parity, matching the
    /// active-layer row): an accent-subtle fill and a 2pt accent bar on the top
    /// edge, whose height is reserved on every header so activating a column
    /// never nudges its ordinal.
    ///
    /// One gesture serves both roles, so no `Button` sits underneath: a
    /// `Button` would fire its select action on the release that ends a drag,
    /// which is the trailing-click the web has to suppress. Losing it costs the
    /// header its focus ring — a gap the Timeline shares with the layer rows'
    /// handles, and the keyboard path the deferred roving-focus work will
    /// close — so the pointer-free routes are spelled out below instead.
    private func rulerHeader(_ frame: FrameColumn, axisIndex: Int) -> some View {
        let ordinal = axisIndex + 1
        let isActive = frame.id == tab.activeFrameId
        let isDragging = frameInteraction.drag?.itemId == frame.id
        let dragOffset = frameInteraction.drag?.offset(forIndex: axisIndex) ?? 0
        return Text(verbatim: "\(ordinal)")
            .font(.system(
                size: DesignTokens.fontSizeSm,
                weight: isActive ? .bold : .medium
            ))
            .foregroundStyle(isActive ? DesignTokens.accentText : DesignTokens.textTertiary)
            .frame(width: frameColumnWidth, height: rulerHeight)
            // The travelling header needs an opaque fill of its own: an
            // inactive column is otherwise transparent, and it crosses the
            // columns it passes (web parity: `.frame-ruler-cell--dragging`).
            .background(headerBackground(isActive: isActive, isDragging: isDragging))
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(isActive ? DesignTokens.accent : .clear)
                    .frame(height: activeBarWidth)
            }
            .overlay(alignment: .trailing) {
                Rectangle()
                    .fill(DesignTokens.borderSubtle)
                    .frame(width: dividerThickness)
            }
            .contentShape(Rectangle())
            .offset(x: dragOffset)
            .zIndex(dragDepth(isDragging: isDragging, reorderOffset: dragOffset))
            .gesture(frameReorderGesture(frame, axisIndex: axisIndex))
            .accessibilityElement()
            .accessibilityLabel(selectFrameLabel(ordinal: ordinal))
            .accessibilityAddTraits(isActive ? [.isButton, .isSelected] : .isButton)
            .accessibilityAction { tab.setActiveFrame(id: frame.id) }
            // The pointer-free path to the reorder, mirroring the layer row's
            // handle: VoiceOver's adjust gesture (and the rotor) steps the
            // column along the axis.
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment:
                    tab.reorderFrame(id: frame.id, toIndex: axisIndex + 1)
                case .decrement:
                    tab.reorderFrame(id: frame.id, toIndex: axisIndex - 1)
                @unknown default:
                    break
                }
            }
    }

    private func headerBackground(isActive: Bool, isDragging: Bool) -> SwiftUI.Color {
        if isDragging { return DesignTokens.bgActive }
        return isActive ? DesignTokens.accentSubtle : .clear
    }

    /// `minimumDistance: 0` so the press is tracked from touch-down: the header
    /// is its own tap target, and the travel that separates a tap from a drag is
    /// measured by the interaction rather than delegated to the gesture's own
    /// threshold, which would swallow the presses below it.
    private func frameReorderGesture(_ frame: FrameColumn, axisIndex: Int) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                frameInteraction.track(
                    itemId: frame.id,
                    axisIndex: axisIndex,
                    travel: value.translation.width,
                    axisCount: frameColumns.count
                )
            }
            .onEnded { value in
                switch frameInteraction.release(
                    itemId: frame.id,
                    travel: value.translation.width
                ) {
                case let .reorder(toIndex):
                    tab.reorderFrame(id: frame.id, toIndex: toIndex)
                case .select:
                    tab.setActiveFrame(id: frame.id)
                case .ignore:
                    break
                }
            }
    }

    /// Web parity: `aria_selectFrame`. Int-cast so the catalog key stays a
    /// stable "Select frame %lld".
    private func selectFrameLabel(ordinal: Int) -> LocalizedStringResource {
        "Select frame \(ordinal)"
    }

    // MARK: - Frame grid

    /// The `[layer row × frame column]` cells, one row per sidebar row and in
    /// the same panel order, so row N of the grid sits beside sidebar row N.
    /// Rows follow the reorder drag's preview offsets — unlike the placeholder
    /// column they replaced, these cells carry per-layer content, so holding
    /// them still would break the pairing mid-drag.
    private func frameGrid(paneWidth: CGFloat) -> some View {
        VStack(spacing: 0) {
            ForEach(
                Array(tab.layersInPanelOrder.enumerated()),
                id: \.element.id
            ) { panelIndex, layer in
                frameRow(layer, panelIndex: panelIndex, paneWidth: paneWidth)
            }
        }
    }

    /// The frame pane's scroller — the one place the axis position lives. It
    /// publishes its offset so the pinned ruler above can follow, and locks
    /// while a layer reorder previews, like the vertical scroll around it.
    private func frameGridScroller(paneWidth: CGFloat) -> some View {
        ScrollView(.horizontal) {
            frameGrid(paneWidth: paneWidth)
                .background(alignment: .leading) {
                    GeometryReader { geo in
                        SwiftUI.Color.clear.preference(
                            key: FrameAxisOffsetKey.self,
                            value: geo.frame(in: .named(Self.frameAxisSpace)).minX
                        )
                    }
                }
        }
        .coordinateSpace(name: Self.frameAxisSpace)
        .onPreferenceChange(FrameAxisOffsetKey.self) { offset in
            axisScrollOffset = offset
        }
        .scrollDisabled(isReorderPreviewing)
        .frame(width: paneWidth)
    }

    /// Names the scroller's own space, so the content's leading edge reads as
    /// the scroll offset rather than a position on screen.
    private static let frameAxisSpace = "timelineFrameAxis"

    @ViewBuilder
    private func frameRow(
        _ layer: AppleLayerMetadata,
        panelIndex: Int,
        paneWidth: CGFloat
    ) -> some View {
        let isDragging = layerDrag?.itemId == layer.id
        let reorderOffset = layerDrag?.offset(forIndex: panelIndex) ?? 0
        Group {
            if layer.kind == .reference {
                referenceSpan
            } else {
                HStack(spacing: 0) {
                    ForEach(Array(frameColumns.enumerated()), id: \.element.id) { index, frame in
                        frameCell(frame, layer: layer, ordinal: index + 1)
                    }
                }
                // The active layer's tint spans the grid row too, so the active
                // row reads continuously across both panes (web parity).
                .background(tab.activeLayerId == layer.id ? DesignTokens.bgActive : .clear)
            }
        }
        // An axis narrower than the pane still fills it, so the Reference band
        // spans the panel instead of stopping at the last column; a wider one
        // sets the scroller's content width.
        .frame(width: max(frameAxisWidth, paneWidth), alignment: .leading)
        .frame(height: rowHeight)
        .offset(y: reorderOffset)
        .zIndex(dragDepth(isDragging: isDragging, reorderOffset: reorderOffset))
    }

    /// A Reference Layer is frame-independent and holds no Cels, so its grid
    /// row is one continuous muted band rather than a divided cel strip (web
    /// parity: `.frame-reference-span`).
    private var referenceSpan: some View {
        HStack(spacing: DesignTokens.space3) {
            Image(systemName: "photo")
                .font(.system(size: referenceGlyphSize))
                .foregroundStyle(DesignTokens.accentText)
            Text("underlay — same under every frame")
                .font(.system(size: DesignTokens.fontSizeSm, weight: .medium))
                .foregroundStyle(DesignTokens.textTertiary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .padding(.horizontal, DesignTokens.space3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: rowHeight)
        .background(DesignTokens.bgHover)
    }

    /// One Cel's occupied/empty indicator. Non-interactive in this slice — the
    /// ruler header above it is the Active Frame's tap target — so it is an
    /// accessibility element that reads its own occupancy rather than a button.
    private func frameCell(
        _ frame: FrameColumn,
        layer: AppleLayerMetadata,
        ordinal: Int
    ) -> some View {
        let isActiveFrame = frame.id == tab.activeFrameId
        let isActiveCel = isActiveFrame && layer.id == tab.activeLayerId
        let isOccupied = frame.occupiedLayerIds.contains(layer.id)
        return Circle()
            .fill(isActiveCel ? DesignTokens.accent : DesignTokens.textSecondary)
            .frame(width: celDotSize, height: celDotSize)
            .opacity(isOccupied ? 1 : 0)
            .frame(width: frameColumnWidth, height: rowHeight)
            .background(isActiveFrame ? DesignTokens.accentSubtle : .clear)
            // The active Cel (active layer ∩ active frame) adds an accent
            // outline over the column's fill — the drawing target, marked at
            // the crossing rather than by the column alone.
            // `strokeBorder` keeps the line wholly inside the cell — a centered
            // `stroke` would hang half its width past the axis, where the pane's
            // clip now cuts it. Web parity too: the active Cel's outline is an
            // `inset` box-shadow there.
            .overlay {
                Rectangle()
                    .strokeBorder(
                        isActiveCel ? DesignTokens.accent : DesignTokens.borderSubtle,
                        lineWidth: dividerThickness
                    )
            }
            .accessibilityElement()
            .accessibilityLabel(celLabel(layer: layer, ordinal: ordinal))
            .accessibilityValue(isOccupied ? Text("Has content") : Text("Empty"))
    }

    /// Web parity: `aria_selectCel`, without the "Select" verb — the cell is an
    /// indicator here, not a command.
    private func celLabel(layer: AppleLayerMetadata, ordinal: Int) -> LocalizedStringResource {
        "\(layer.name), frame \(ordinal)"
    }

    // MARK: - Helpers

    private var divider: some View {
        Rectangle()
            .fill(DesignTokens.borderSubtle)
            .frame(height: dividerThickness)
    }

    private var verticalDivider: some View {
        Rectangle()
            .fill(DesignTokens.borderSubtle)
            .frame(width: dividerThickness)
            .frame(maxHeight: .infinity)
    }
}

/// Carries the frame grid's scroll offset up to the pinned ruler band.
private struct FrameAxisOffsetKey: PreferenceKey {
    static let defaultValue: CGFloat = 0

    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}
