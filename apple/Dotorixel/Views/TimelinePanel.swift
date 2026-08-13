import SwiftUI

/// Bottom-docked Timeline panel: a header strip over the layer sidebar and the
/// frame area. Mirrors web `TimelinePanel.svelte` and the `092 — TimelinePanel
/// Design Spec` for cross-shell parity, with SwiftUI-native controls sized to
/// the HIG touch minimum instead of the web's 32px desktop rows.
///
/// The frame area stays a placeholder — one dim column per layer plus a hint,
/// exactly the spec's M3 treatment — so the frame ruler grows into reserved
/// space when animation arrives (Phase 6). The layer sidebar is the panel's
/// only live content today.
struct TimelinePanel: View {
    let tab: TabState

    /// The reorder drag currently under a handle, or nil while none is.
    /// View-local by nature: it lives and dies with the gesture and never
    /// reaches the document until the drop commits.
    @State private var reorderDrag: LayerReorderDrag?
    @State private var isReferenceImporterPresented = false
    @State private var referenceImportErrorMessage: String?

    /// Panel rows and the header strip share the touch-minimum height — the
    /// Apple stand-in for the web's `--row-height`, which drives both there too.
    private let rowHeight = DesignTokens.btnSize

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

    /// Row stacking while a reorder previews — see `rowDepth`.
    private let draggedRowDepth: Double = 2
    private let shiftedRowDepth: Double = 1
    private let restingRowDepth: Double = 0

    /// The panel's separator lines — web `--ds-border-width`: 1px. Named
    /// because `bodyHeight` subtracts it, where a bare `1` would read as
    /// arbitrary rather than as the divider it makes room for.
    private let dividerThickness: CGFloat = 1

    /// Height left for the sidebar and frame area once the header strip and
    /// its divider are laid out.
    private var bodyHeight: CGFloat {
        DesignTokens.timelinePanelHeight - rowHeight - dividerThickness
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
                panelBody
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
            guard reorderDrag != nil else { return }
            reorderDrag = nil
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

    // MARK: - Header

    private var header: some View {
        HStack(spacing: DesignTokens.space2) {
            if !isCollapsed {
                addLayerButton
                addReferenceButton
            }
            headerLabel
            Spacer(minLength: 0)
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

    /// Sidebar and frame area scroll as one unit so each layer row stays
    /// aligned with its frame column cell once the rows outgrow the panel
    /// (the alignment web `TimelinePanel` had to fix after splitting them).
    private var panelBody: some View {
        ScrollView(.vertical) {
            HStack(alignment: .top, spacing: 0) {
                layerSidebar
                verticalDivider
                frameArea
            }
            // Short layer stacks still fill the panel, so the divider and the
            // frame placeholder span the body instead of stopping at row one.
            .frame(minHeight: bodyHeight, alignment: .top)
        }
        .frame(height: bodyHeight)
        // A reorder drag travels along the same axis this scrolls. The handle's
        // gesture claims the press on touch-down (`minimumDistance: 0`), so the
        // lock lands before any travel could be read as a scroll instead.
        .scrollDisabled(reorderDrag != nil)
        // Collapsing mid-drag removes the rows and tears their gestures down
        // without `onEnded` — drop the drag with the body so no preview offsets
        // or scroll lock survive into the next expand.
        .onDisappear { reorderDrag = nil }
    }

    /// Holds the spec width wherever the canvas column can seat it, and yields
    /// below that — a hard `width` would push the header's add and collapse
    /// controls outside the panel once the column drops under 256pt, which the
    /// macOS window's 480pt floor reaches (480 − 44 toolbar − 200 right panel).
    /// The web narrows its sidebar at the mobile tier for the same reason.
    private var layerSidebar: some View {
        VStack(spacing: 0) {
            // Panel order: top of the stack renders at the top.
            ForEach(
                Array(tab.layersInPanelOrder.enumerated()),
                id: \.element.id
            ) { panelIndex, layer in
                layerRow(layer, panelIndex: panelIndex)
            }
        }
        .frame(maxWidth: DesignTokens.timelineSidebarWidth)
    }

    private func layerRow(_ layer: AppleLayerMetadata, panelIndex: Int) -> some View {
        let isActive = tab.activeLayerId == layer.id
        let isDragging = reorderDrag?.layerId == layer.id
        let reorderOffset = reorderDrag?.offset(forPanelIndex: panelIndex) ?? 0
        return HStack(spacing: DesignTokens.space2) {
            visibilityToggle(layer)
            if layer.kind == .reference {
                referenceKindIcon
            }
            rowSelectButton(layer, isActive: isActive)
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
        .zIndex(rowDepth(isDragging: isDragging, reorderOffset: reorderOffset))
    }

    /// Which rows draw over which while a reorder previews: the travelling row
    /// over everything, a shifted row over the ones still at rest.
    /// Web parity: `.row--dragging` z-index 2, `.row--drag-shifted` 1.
    private func rowDepth(isDragging: Bool, reorderOffset: CGFloat) -> Double {
        if isDragging { return draggedRowDepth }
        return reorderOffset == 0 ? restingRowDepth : shiftedRowDepth
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
        .gesture(reorderGesture(layer, panelIndex: panelIndex))
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
    private func reorderGesture(_ layer: AppleLayerMetadata, panelIndex: Int) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if reorderDrag?.layerId == layer.id {
                    reorderDrag?.translation = value.translation.height
                } else if reorderDrag == nil {
                    reorderDrag = LayerReorderDrag(
                        layerId: layer.id,
                        baseIndex: panelIndex,
                        rowCount: tab.pixelLayersInPanelOrder.count,
                        rowHeight: rowHeight,
                        translation: value.translation.height
                    )
                }
                // A handle pressed while another row's drag is live falls
                // through both branches: only the initiating pointer drives a
                // drag (web parity), and `onEnded`'s id guard below keeps that
                // second pointer from committing or clearing it.
            }
            .onEnded { value in
                guard var drag = reorderDrag, drag.layerId == layer.id else { return }
                drag.translation = value.translation.height
                reorderDrag = nil
                tab.reorderLayer(id: layer.id, toPanelIndex: drag.targetPanelIndex)
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
        .accessibilityAddTraits(isActive ? .isSelected : [])
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
            .font(.system(size: 12))
            .foregroundStyle(DesignTokens.textTertiary)
            .frame(width: 14, height: 14)
            .accessibilityHidden(true)
    }

    // MARK: - Frame area (placeholder until Phase 6)

    /// One static column of cells — a row per layer — beside an empty axis.
    /// The column reserves the frame ruler's width and pins the row-to-cell
    /// alignment the ruler will inherit; the axis carries the hint that says
    /// why the space is empty.
    ///
    /// The cells hold still during a reorder drag, where the web shifts its
    /// frame rows with the sidebar: these placeholders are identical and carry
    /// no layer identity, so shifting them would render no visible difference.
    /// The ruler that replaces them (Phase 6) does carry per-layer content and
    /// will need the row offsets.
    private var frameArea: some View {
        // Top-aligned so cell N sits beside sidebar row N — the alignment the
        // frame ruler inherits when it replaces this column.
        HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 0) {
                ForEach(tab.layersInPanelOrder, id: \.id) { _ in
                    placeholderFrameCell
                }
            }
            emptyAxis
        }
    }

    private var placeholderFrameCell: some View {
        Rectangle()
            .fill(DesignTokens.bgBase)
            .frame(width: rowHeight, height: rowHeight)
            .overlay(
                Rectangle()
                    .stroke(DesignTokens.borderSubtle, lineWidth: dividerThickness)
            )
    }

    private var emptyAxis: some View {
        Text("Frames arrive with animation support")
            .font(.system(size: DesignTokens.fontSizeSm))
            .italic()
            .foregroundStyle(DesignTokens.textTertiary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, DesignTokens.space5)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
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
