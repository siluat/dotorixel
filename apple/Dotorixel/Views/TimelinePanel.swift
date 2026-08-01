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
    let editorState: EditorState

    /// Panel rows and the header strip share the touch-minimum height — the
    /// Apple stand-in for the web's `--row-height`, which drives both there too.
    private let rowHeight = DesignTokens.btnSize

    /// Web Timeline sidebar visual references (raw CSS, not tokens): the
    /// active row's leading accent bar is `--ds-border-width-thick` (2px) and
    /// a hidden row's name dims to opacity 0.45.
    private let activeBarWidth: CGFloat = 2
    private let hiddenNameOpacity: Double = 0.45

    /// The panel's separator lines — web `--ds-border-width`: 1px. Named
    /// because `bodyHeight` subtracts it, where a bare `1` would read as
    /// arbitrary rather than as the divider it makes room for.
    private let dividerThickness: CGFloat = 1

    /// Height left for the sidebar and frame area once the header strip and
    /// its divider are laid out.
    private var bodyHeight: CGFloat {
        DesignTokens.timelinePanelHeight - rowHeight - dividerThickness
    }

    private var isCollapsed: Bool { editorState.isTimelinePanelCollapsed }

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
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: DesignTokens.space2) {
            if !isCollapsed {
                addLayerButton
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
        } else {
            Text("Layers")
                .font(.system(size: DesignTokens.fontSize, weight: .semibold))
                .foregroundStyle(DesignTokens.textPrimary)
        }
    }

    private var activeLayerName: String {
        editorState.layersInPanelOrder
            .first { $0.id == editorState.activeLayerId }?
            .name ?? ""
    }

    /// The header's add action: a transparent layer lands directly above the
    /// active one and becomes the drawing target (web parity: the Timeline
    /// header's `+`).
    private var addLayerButton: some View {
        PanelIconButton(
            systemName: "plus",
            accessibilityLabel: "Add layer",
            action: editorState.addLayer
        )
    }

    /// Points down while expanded and up while collapsed — "click to expand",
    /// the direction chosen for the web chevron.
    private var collapseToggle: some View {
        PanelIconButton(
            systemName: "chevron.down",
            accessibilityLabel: isCollapsed ? "Expand layers panel" : "Collapse layers panel",
            action: editorState.toggleTimelinePanel
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
    }

    private var layerSidebar: some View {
        VStack(spacing: 0) {
            // Panel order: top of the stack renders at the top.
            ForEach(editorState.layersInPanelOrder, id: \.id) { layer in
                layerRow(layer)
            }
        }
        .frame(width: DesignTokens.timelineSidebarWidth)
    }

    private func layerRow(_ layer: AppleLayerMetadata) -> some View {
        let isActive = editorState.activeLayerId == layer.id
        return HStack(spacing: DesignTokens.space2) {
            visibilityToggle(layer)
            rowSelectButton(layer, isActive: isActive)
            removeLayerButton(layer)
        }
        // Full-height touch-minimum rows keep every target at the HIG minimum.
        .frame(height: rowHeight)
        .background(isActive ? DesignTokens.bgActive : .clear)
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
    }

    /// The row's tap surface: selects the layer as the drawing target.
    /// The name spans the remaining row width so the whole row (minus the
    /// icon buttons) is tappable — web parity: the row itself is the select
    /// target.
    private func rowSelectButton(_ layer: AppleLayerMetadata, isActive: Bool) -> some View {
        Button {
            editorState.setActiveLayer(id: layer.id)
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
            isEnabled: editorState.canRemoveLayer,
            action: { editorState.removeLayer(id: layer.id) }
        )
    }

    private func visibilityToggle(_ layer: AppleLayerMetadata) -> some View {
        PanelIconButton(
            systemName: layer.visible ? "eye" : "eye.slash",
            accessibilityLabel: layer.visible ? "Hide \(layer.name)" : "Show \(layer.name)",
            tint: layer.visible ? DesignTokens.textSecondary : DesignTokens.textTertiary,
            action: { editorState.setLayerVisibility(id: layer.id, visible: !layer.visible) }
        )
    }

    // MARK: - Frame area (placeholder until Phase 6)

    /// One static column of cells — a row per layer — beside an empty axis.
    /// The column reserves the frame ruler's width and pins the row-to-cell
    /// alignment the ruler will inherit; the axis carries the hint that says
    /// why the space is empty.
    private var frameArea: some View {
        // Top-aligned so cell N sits beside sidebar row N — the alignment the
        // frame ruler inherits when it replaces this column.
        HStack(alignment: .top, spacing: 0) {
            VStack(spacing: 0) {
                ForEach(editorState.layersInPanelOrder, id: \.id) { _ in
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
