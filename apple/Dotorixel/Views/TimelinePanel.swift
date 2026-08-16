import SwiftUI

/// Bottom-docked Timeline panel: a header strip over the reserved transport
/// slot, the frame ruler, and the `[layer row × frame column]` grid beside the
/// layer sidebar. Mirrors web `TimelinePanel.svelte` and the `092 —
/// TimelinePanel Design Spec` / `187 — Frame Ruler` specs for cross-shell
/// parity, with SwiftUI-native controls sized to the HIG touch minimum instead
/// of the web's 32px desktop rows.
///
/// The ruler band is pinned above the scrolling rows, so scrolling a tall layer
/// stack never takes the frame ordinals with it. Frames wider than the panel
/// clip rather than scroll horizontally — the axis can hold only one frame
/// until issue 285 lands the add/duplicate commands that grow it.
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

    /// Row stacking while a reorder previews — see `rowDepth`.
    private let draggedRowDepth: Double = 2
    private let shiftedRowDepth: Double = 1
    private let restingRowDepth: Double = 0

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

    /// The pinned ruler band and the scrolling rows beneath it. Both take their
    /// sidebar width from one measurement, so the ruler's corner and the layer
    /// sidebar end at the same x and ordinal N stays over column N — two bands
    /// resolving their own flexible widths drift apart wherever the sidebar's
    /// row controls out-measure the empty corner.
    private var rulerAndRows: some View {
        GeometryReader { proxy in
            let sidebarWidth = sidebarWidth(in: proxy.size.width)
            VStack(spacing: 0) {
                rulerBand(sidebarWidth: sidebarWidth)
                panelBody(sidebarWidth: sidebarWidth)
            }
        }
        .frame(height: rulerHeight + bodyHeight)
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
    private func panelBody(sidebarWidth: CGFloat) -> some View {
        ScrollView(.vertical) {
            HStack(alignment: .top, spacing: 0) {
                layerSidebar(width: sidebarWidth)
                verticalDivider
                frameGrid
            }
            // Short layer stacks still fill the panel, so the divider and the
            // frame grid span the body instead of stopping at row one.
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
        let isDragging = reorderDrag?.layerId == layer.id
        let reorderOffset = reorderDrag?.offset(forPanelIndex: panelIndex) ?? 0
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

    /// The band over the scrolling rows: the corner where the active frame's
    /// duration editor lands (issue 287), beside the ruler's ordinal headers.
    private func rulerBand(sidebarWidth: CGFloat) -> some View {
        HStack(alignment: .top, spacing: 0) {
            durationCorner(width: sidebarWidth)
            verticalDivider
            frameRuler
        }
        .frame(height: rulerHeight)
        .background(DesignTokens.bgElevated)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(height: dividerThickness)
        }
    }

    private func durationCorner(width: CGFloat) -> some View {
        SwiftUI.Color.clear
            .frame(width: width, height: rulerHeight)
            .accessibilityHidden(true)
    }

    private var frameRuler: some View {
        HStack(spacing: 0) {
            ForEach(Array(frameColumns.enumerated()), id: \.element.id) { index, frame in
                rulerHeader(frame, ordinal: index + 1)
            }
        }
        .frame(width: frameAxisWidth, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// One frame's ordinal header — the tap target that makes it the Active
    /// Frame. The active column carries two channels so it reads without hue
    /// (web parity, matching the active-layer row): an accent-subtle fill and
    /// a 2pt accent bar on the top edge, whose height is reserved on every
    /// header so activating a column never nudges its ordinal.
    private func rulerHeader(_ frame: FrameColumn, ordinal: Int) -> some View {
        let isActive = frame.id == tab.activeFrameId
        return Button {
            tab.setActiveFrame(id: frame.id)
        } label: {
            Text(verbatim: "\(ordinal)")
                .font(.system(
                    size: DesignTokens.fontSizeSm,
                    weight: isActive ? .bold : .medium
                ))
                .foregroundStyle(isActive ? DesignTokens.accentText : DesignTokens.textTertiary)
                .frame(width: frameColumnWidth, height: rulerHeight)
                .background(isActive ? DesignTokens.accentSubtle : .clear)
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
        }
        .buttonStyle(.plain)
        .accessibilityLabel(selectFrameLabel(ordinal: ordinal))
        .accessibilityAddTraits(isActive ? .isSelected : [])
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
    private var frameGrid: some View {
        VStack(spacing: 0) {
            ForEach(
                Array(tab.layersInPanelOrder.enumerated()),
                id: \.element.id
            ) { panelIndex, layer in
                frameRow(layer, panelIndex: panelIndex)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func frameRow(_ layer: AppleLayerMetadata, panelIndex: Int) -> some View {
        let isDragging = reorderDrag?.layerId == layer.id
        let reorderOffset = reorderDrag?.offset(forPanelIndex: panelIndex) ?? 0
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
                // Cel rows stop at the axis; the Reference band below spans the
                // whole pane, so only this branch takes the axis width.
                .frame(width: frameAxisWidth, alignment: .leading)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .frame(height: rowHeight)
        .offset(y: reorderOffset)
        .zIndex(rowDepth(isDragging: isDragging, reorderOffset: reorderOffset))
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
            .overlay {
                Rectangle()
                    .stroke(
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
