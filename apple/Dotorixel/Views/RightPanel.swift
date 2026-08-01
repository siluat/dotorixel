import SwiftUI

/// Right panel: Canvas section (size presets, dimension inputs, Clear),
/// Layers section (rows with active selection and visibility toggles), and
/// Color section (FG/BG pair + swap, HSV picker, palette grid, Recent row),
/// separated by dividers. Mirrors web `RightPanel.svelte` for cross-shell
/// parity; the Layers section adapts the web Timeline's layer sidebar (the
/// web keeps layers in the Timeline panel, which the Apple shell doesn't
/// have yet — Phase 6).
struct RightPanel: View {
    let editorState: EditorState
    let tier: LayoutTier

    @State private var widthInput: String = ""
    @State private var heightInput: String = ""
    @FocusState private var focusedField: Field?

    private enum Field { case width, height }

    /// Shared height for compact controls (preset buttons, size inputs, Clear,
    /// foreground swatch). Matches the web RightPanel's 28px control height.
    private let controlHeight: CGFloat = 28

    /// Palette grid spacing — web RightPanel gap: 3px (raw CSS, not a token).
    private let paletteGridSpacing: CGFloat = 3

    /// Swap button extent — web RightPanel `.swap-btn`: 24px (raw CSS, not a token).
    private let swapButtonSize: CGFloat = 24

    /// Swap icon size — web RightPanel `ArrowLeftRight size={14}` (raw, not a token).
    private let swapIconSize: CGFloat = 14

    /// Recent swatch extent — web RightPanel `.recent-swatch`: 22px (raw CSS, not a token).
    private let recentSwatchSize: CGFloat = 22

    /// Recent row gap — web RightPanel `.recent-row` gap: 3px (raw CSS, not a token).
    private let recentRowSpacing: CGFloat = 3

    /// Web Timeline sidebar visual references (raw CSS, not tokens): the
    /// active row's leading accent bar is `--ds-border-width-thick` (2px);
    /// a hidden row's name dims to opacity 0.45; the eye icon is 14px; the
    /// add/remove glyphs are 14px text ("+" / "✕"); a disabled control dims
    /// to opacity 0.55.
    private let activeBarWidth: CGFloat = 2
    private let hiddenNameOpacity: Double = 0.45
    private let eyeIconSize: CGFloat = 14
    private let layerActionIconSize: CGFloat = 14
    private let disabledControlOpacity: Double = 0.55

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.space5) {
                canvasSection
                sectionDivider
                layersSection
                sectionDivider
                colorSection
            }
            .padding(DesignTokens.space4)
        }
        .frame(width: DesignTokens.rightPanelWidth(tier))
        .frame(maxHeight: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(DesignTokens.border)
                .frame(width: 1)
        }
        .onAppear { syncDimensionInputs() }
        .onChange(of: editorState.canvasVersion) { _, _ in syncDimensionInputs() }
        // Publish text focus so keyboard shortcuts pause while the size
        // fields receive typed letters (`KeyboardShortcutHost` guard).
        .onChange(of: focusedField) { _, newValue in
            editorState.isTextInputFocused = newValue != nil
        }
        // The size fields are the only inputs feeding the flag, and no
        // focus-change closure fires once the panel leaves the hierarchy —
        // clear it on teardown so shortcuts can't stay suppressed.
        .onDisappear {
            editorState.isTextInputFocused = false
        }
    }

    // MARK: - Canvas section

    private var canvasSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.space3) {
            sectionTitle("Canvas")
            presetRow
            sizeRow
            clearButton
        }
    }

    private var presetRow: some View {
        HStack(spacing: DesignTokens.space2) {
            ForEach(canvasPresets(), id: \.self) { size in
                presetButton(size: size)
            }
        }
    }

    private func presetButton(size: UInt32) -> some View {
        let isActive = editorState.document.width() == size
            && editorState.document.height() == size
        return Button {
            editorState.resizeCanvas(width: size, height: size)
        } label: {
            Text("\(size)")
                .font(.system(size: DesignTokens.fontSizeSm))
                .frame(maxWidth: .infinity)
                .frame(height: controlHeight)
                .foregroundStyle(isActive ? .white : DesignTokens.textPrimary)
                .background(isActive ? DesignTokens.accent : DesignTokens.bgHover)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
        // Int-cast so the catalog key is a stable "%lld by %lld" — UInt32
        // interpolation would generate a different format specifier.
        .accessibilityLabel("\(Int(size)) by \(Int(size))")
    }

    private var sizeRow: some View {
        HStack(spacing: DesignTokens.space3) {
            sizeInput(text: $widthInput, field: .width, accessibilityLabel: "Width")
            Text("×")
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textTertiary)
            sizeInput(text: $heightInput, field: .height, accessibilityLabel: "Height")
        }
    }

    private func sizeInput(
        text: Binding<String>,
        field: Field,
        accessibilityLabel: LocalizedStringKey
    ) -> some View {
        TextField("", text: text)
            .textFieldStyle(.roundedBorder)
            .multilineTextAlignment(.center)
            .font(.system(size: DesignTokens.fontSizeSm))
            .frame(height: controlHeight)
            .focused($focusedField, equals: field)
            .accessibilityLabel(accessibilityLabel)
            .onSubmit { commitDimensions() }
            .onChange(of: focusedField) { oldValue, _ in
                if oldValue == field { commitDimensions() }
            }
    }

    private var clearButton: some View {
        Button {
            editorState.handleClearCanvas()
        } label: {
            Text("Clear")
                .font(.system(size: DesignTokens.fontSizeSm))
                .frame(maxWidth: .infinity)
                .frame(height: controlHeight)
                .foregroundStyle(DesignTokens.textSecondary)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(DesignTokens.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Layers section

    private var layersSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.space3) {
            HStack(spacing: DesignTokens.space2) {
                sectionTitle("Layers")
                Spacer(minLength: 0)
                addLayerButton
            }
            VStack(spacing: 0) {
                // Panel order: top of the stack renders at the top.
                ForEach(editorState.layersInPanelOrder, id: \.id) { layer in
                    layerRow(layer)
                }
            }
        }
    }

    /// The section header's add action: a transparent layer lands directly
    /// above the active one and becomes the drawing target (web parity: the
    /// Timeline header's `+`).
    private var addLayerButton: some View {
        Button {
            editorState.addLayer()
        } label: {
            Image(systemName: "plus")
                .font(.system(size: layerActionIconSize))
                .foregroundStyle(DesignTokens.textSecondary)
                // Visual chrome stays compact; the tappable area expands to
                // the HIG minimum (same idiom as the swap button).
                .frame(minWidth: DesignTokens.btnSize, minHeight: DesignTokens.btnSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Add layer")
    }

    private func layerRow(_ layer: AppleLayerMetadata) -> some View {
        let isActive = editorState.activeLayerId == layer.id
        return HStack(spacing: DesignTokens.space2) {
            visibilityToggle(layer)
            rowSelectButton(layer, isActive: isActive)
            removeLayerButton(layer)
        }
        // Full-height 44pt rows keep both targets at the HIG touch minimum.
        .frame(minHeight: DesignTokens.btnSize)
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
    /// eye) is tappable — web parity: the row itself is the select target.
    private func rowSelectButton(_ layer: AppleLayerMetadata, isActive: Bool) -> some View {
        Button {
            editorState.setActiveLayer(id: layer.id)
        } label: {
            Text(verbatim: layer.name)
                .font(.system(
                    size: DesignTokens.fontSizeSm,
                    weight: isActive ? .medium : .regular
                ))
                .foregroundStyle(DesignTokens.textPrimary)
                .opacity(layer.visible ? 1 : hiddenNameOpacity)
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(minHeight: DesignTokens.btnSize)
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
        Button {
            editorState.removeLayer(id: layer.id)
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: layerActionIconSize))
                .foregroundStyle(DesignTokens.textTertiary)
                .opacity(editorState.canRemoveLayer ? 1 : disabledControlOpacity)
                // Visual chrome stays compact; the tappable area expands to
                // the HIG minimum (same idiom as the swap button).
                .frame(minWidth: DesignTokens.btnSize, minHeight: DesignTokens.btnSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!editorState.canRemoveLayer)
        .accessibilityLabel("Delete \(layer.name)")
    }

    private func visibilityToggle(_ layer: AppleLayerMetadata) -> some View {
        Button {
            editorState.setLayerVisibility(id: layer.id, visible: !layer.visible)
        } label: {
            Image(systemName: layer.visible ? "eye" : "eye.slash")
                .font(.system(size: eyeIconSize))
                .foregroundStyle(
                    layer.visible ? DesignTokens.textSecondary : DesignTokens.textTertiary
                )
                // Visual chrome stays compact; the tappable area expands to
                // the HIG minimum (same idiom as the swap button).
                .frame(minWidth: DesignTokens.btnSize, minHeight: DesignTokens.btnSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(
            layer.visible ? "Hide \(layer.name)" : "Show \(layer.name)"
        )
    }

    // MARK: - Color section

    private var colorSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.space3) {
            sectionTitle("Color")
            fgBgRow
            hexRow
            sectionTitle("HSV")
            HsvPickerView(
                selectedColor: editorState.foregroundColor,
                onColorChange: { editorState.foregroundColor = $0 }
            )
            sectionTitle("Palette")
            paletteGrid
            if !editorState.recentColors.isEmpty {
                recentLabel
                recentRow
            }
        }
    }

    // Web `.recent-label`: sm/tertiary — quieter than a section title.
    private var recentLabel: some View {
        Text("Recent")
            .font(.system(size: DesignTokens.fontSizeSm))
            .foregroundStyle(DesignTokens.textTertiary)
    }

    /// Recent swatches, most-recent first. The web squeezes all twelve into
    /// one flex row; here the grid wraps instead so swatches keep their
    /// 22pt extent inside the fixed panel width.
    private var recentRow: some View {
        LazyVGrid(
            columns: [GridItem(
                .adaptive(minimum: recentSwatchSize, maximum: recentSwatchSize),
                spacing: recentRowSpacing
            )],
            alignment: .leading,
            spacing: recentRowSpacing
        ) {
            // Dedupe guarantees uniqueness, so the color value is its own
            // stable row identity.
            ForEach(editorState.recentColors, id: \.self) { color in
                recentSwatch(color: color)
            }
        }
    }

    private func recentSwatch(color: Color) -> some View {
        Button {
            editorState.foregroundColor = color
        } label: {
            RoundedRectangle(cornerRadius: 3)
                .fill(color.swiftUIColor)
                .frame(width: recentSwatchSize, height: recentSwatchSize)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Recent color \(color.hexString)")
    }

    /// FG/BG pair + swap — web RightPanel `.fgbg-row`: the foreground swatch
    /// is visually primary (accent border), the background secondary.
    private var fgBgRow: some View {
        HStack(spacing: DesignTokens.space3) {
            foregroundSwatch
            backgroundSwatch
            swapButton
        }
    }

    private var foregroundSwatch: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(editorState.foregroundColor.swiftUIColor)
            .frame(width: controlHeight, height: controlHeight)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(DesignTokens.accent, lineWidth: 2)
            )
            .accessibilityLabel("Foreground color")
            .accessibilityValue(editorState.foregroundColor.hexString)
    }

    private var backgroundSwatch: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(editorState.backgroundColor.swiftUIColor)
            .frame(width: controlHeight, height: controlHeight)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(DesignTokens.border, lineWidth: 1)
            )
            .accessibilityLabel("Background color")
            .accessibilityValue(editorState.backgroundColor.hexString)
    }

    private var swapButton: some View {
        Button {
            editorState.swapColors()
        } label: {
            Image(systemName: "arrow.left.arrow.right")
                .font(.system(size: swapIconSize))
                .foregroundStyle(DesignTokens.textTertiary)
                .frame(width: swapButtonSize, height: swapButtonSize)
                // Visual chrome stays 24pt (web RightPanel parity); the
                // tappable area expands to the HIG minimum for iPad touch.
                .frame(minWidth: DesignTokens.btnSize, minHeight: DesignTokens.btnSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Swap colors")
    }

    /// Read-only hex readout — web RightPanel `.hex-row`: a tertiary `#`
    /// prefix and the foreground's uppercase hex digits on an elevated,
    /// bordered strip. `Color.hexString` produces `#RRGGBB`; the hash is
    /// split off for the two-tone styling.
    private var hexRow: some View {
        HStack(spacing: DesignTokens.space2) {
            Text("#")
                .foregroundStyle(DesignTokens.textTertiary)
            Text(String(editorState.foregroundColor.hexString.dropFirst()))
                .foregroundStyle(DesignTokens.textPrimary)
            Spacer(minLength: 0)
        }
        .font(.system(size: DesignTokens.fontSizeSm))
        .padding(.horizontal, DesignTokens.space3)
        .frame(height: controlHeight)
        .background(DesignTokens.bgElevated)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(
            RoundedRectangle(cornerRadius: 4)
                .stroke(DesignTokens.border, lineWidth: 1)
        )
        // One VoiceOver element ("# FF8A65"), not two swipe stops — the
        // two-tone split is visual styling, not semantic structure.
        .accessibilityElement(children: .combine)
    }

    private var paletteGrid: some View {
        let colors = DefaultPalette.rows.flatMap { $0 }
        let columns = Array(
            repeating: GridItem(.flexible(), spacing: paletteGridSpacing),
            count: DefaultPalette.columnCount
        )
        return LazyVGrid(columns: columns, spacing: paletteGridSpacing) {
            ForEach(colors.indices, id: \.self) { idx in
                paletteSwatch(color: colors[idx])
            }
        }
    }

    private func paletteSwatch(color: Color) -> some View {
        Button {
            editorState.foregroundColor = color
        } label: {
            RoundedRectangle(cornerRadius: 3)
                .fill(color.swiftUIColor)
                .frame(height: 18)
                .overlay(
                    RoundedRectangle(cornerRadius: 3)
                        .stroke(DesignTokens.borderSubtle, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Palette color \(color.hexString)")
    }

    // MARK: - Helpers

    private var sectionDivider: some View {
        Rectangle()
            .fill(DesignTokens.borderSubtle)
            .frame(height: 1)
    }

    private func sectionTitle(_ text: LocalizedStringKey) -> some View {
        Text(text)
            .font(.system(size: DesignTokens.fontSizeSm, weight: .semibold))
            .foregroundStyle(DesignTokens.textSecondary)
    }

    private func syncDimensionInputs() {
        widthInput = String(editorState.document.width())
        heightInput = String(editorState.document.height())
    }

    private func commitDimensions() {
        guard
            let w = UInt32(widthInput.trimmingCharacters(in: .whitespaces)),
            let h = UInt32(heightInput.trimmingCharacters(in: .whitespaces))
        else {
            syncDimensionInputs()
            return
        }
        editorState.resizeCanvas(width: w, height: h)
        syncDimensionInputs()
    }
}
