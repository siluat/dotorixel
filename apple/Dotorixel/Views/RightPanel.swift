import SwiftUI

/// Right panel: Canvas section (size presets, dimension inputs, Clear),
/// Transform section (whole-canvas flip/rotate), and Color section (FG/BG
/// pair + swap, HSV picker, palette grid, Recent row), divider-separated.
/// Mirrors web `RightPanel.svelte` for cross-shell parity — layers live in
/// the bottom-docked `TimelinePanel`, their home on both shells.
struct RightPanel: View {
    let workspace: Workspace
    let tier: LayoutTier

    private var tab: TabState { workspace.activeTab }
    private var shared: SharedState { workspace.shared }

    @State private var widthInput: String = ""
    @State private var heightInput: String = ""
    @FocusState private var focusedField: Field?

    private enum Field { case width, height }

    /// Shared height for compact controls (preset buttons, size inputs, Clear,
    /// foreground swatch). Matches the web RightPanel's 28px control height.
    private let controlHeight: CGFloat = 28

    /// Palette grid spacing — web RightPanel gap: 3px (raw CSS, not a token).
    private let paletteGridSpacing: CGFloat = 3

    /// Recent swatch extent — web RightPanel `.recent-swatch`: 22px (raw CSS, not a token).
    private let recentSwatchSize: CGFloat = 22

    /// Recent row gap — web RightPanel `.recent-row` gap: 3px (raw CSS, not a token).
    private let recentRowSpacing: CGFloat = 3

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.space5) {
                canvasSection
                sectionDivider
                transformSection
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
        .onChange(of: tab.canvasVersion) { _, _ in syncDimensionInputs() }
        // Publish text focus so keyboard shortcuts pause while the size
        // fields receive typed letters (`KeyboardShortcutHost` guard).
        .onChange(of: focusedField) { _, newValue in
            workspace.setTextInputFocus(owner: .canvasSizeFields, isFocused: newValue != nil)
        }
        // No focus-change closure fires once the panel leaves the hierarchy —
        // release the claim on teardown so shortcuts can't stay suppressed.
        .onDisappear {
            workspace.setTextInputFocus(owner: .canvasSizeFields, isFocused: false)
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
        let isActive = tab.document.width() == size
            && tab.document.height() == size
        return Button {
            tab.resizeCanvas(width: size, height: size)
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
            tab.handleClearCanvas()
        } label: {
            outlineControl {
                Text("Clear")
                    .frame(maxWidth: .infinity)
            }
        }
        .buttonStyle(.plain)
    }

    /// Quiet bordered control surface shared by the Clear and Transform
    /// buttons — the web's `.clear-btn` / `.transform-btn` outline look at
    /// the panel's control height.
    private func outlineControl(@ViewBuilder content: () -> some View) -> some View {
        content()
            .font(.system(size: DesignTokens.fontSizeSm))
            .frame(height: controlHeight)
            .foregroundStyle(DesignTokens.textSecondary)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(DesignTokens.border, lineWidth: 1)
            )
    }

    // MARK: - Transform section

    /// The Canvas Transform tier's buttons (issue 268) — whole-document
    /// flips and rotations, grouped under a section like the web
    /// `RightPanel.svelte` Transform section.
    private var transformSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.space3) {
            sectionTitle("Transform")
            transformButton(
                systemName: "arrow.left.and.right.righttriangle.left.righttriangle.right",
                label: "Flip Canvas Horizontal",
                action: tab.flipCanvasHorizontal
            )
            transformButton(
                systemName: "arrow.up.and.down.righttriangle.up.righttriangle.down",
                label: "Flip Canvas Vertical",
                action: tab.flipCanvasVertical
            )
            transformButton(
                systemName: "rotate.right",
                label: "Rotate Canvas Right",
                action: tab.rotateCanvasCw
            )
            transformButton(
                systemName: "rotate.left",
                label: "Rotate Canvas Left",
                action: tab.rotateCanvasCcw
            )
        }
    }

    /// Icon + label row on the shared outline control surface.
    private func transformButton(
        systemName: String,
        label: LocalizedStringKey,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            outlineControl {
                HStack(spacing: DesignTokens.space2) {
                    Image(systemName: systemName)
                    Text(label)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, DesignTokens.space3)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Color section

    private var colorSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.space3) {
            sectionTitle("Color")
            fgBgRow
            hexRow
            sectionTitle("HSV")
            HsvPickerView(
                selectedColor: shared.foregroundColor,
                onColorChange: { shared.foregroundColor = $0 }
            )
            sectionTitle("Palette")
            paletteGrid
            if !shared.recentColors.isEmpty {
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
            ForEach(shared.recentColors, id: \.self) { color in
                recentSwatch(color: color)
            }
        }
    }

    private func recentSwatch(color: Color) -> some View {
        Button {
            shared.foregroundColor = color
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
            .fill(shared.foregroundColor.swiftUIColor)
            .frame(width: controlHeight, height: controlHeight)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(DesignTokens.accent, lineWidth: 2)
            )
            .accessibilityLabel("Foreground color")
            .accessibilityValue(shared.foregroundColor.hexString)
    }

    private var backgroundSwatch: some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(shared.backgroundColor.swiftUIColor)
            .frame(width: controlHeight, height: controlHeight)
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(DesignTokens.border, lineWidth: 1)
            )
            .accessibilityLabel("Background color")
            .accessibilityValue(shared.backgroundColor.hexString)
    }

    private var swapButton: some View {
        PanelIconButton(
            systemName: "arrow.left.arrow.right",
            accessibilityLabel: "Swap colors",
            tint: DesignTokens.textTertiary,
            action: workspace.swapColors
        )
    }

    /// Read-only hex readout — web RightPanel `.hex-row`: a tertiary `#`
    /// prefix and the foreground's uppercase hex digits on an elevated,
    /// bordered strip. `Color.hexString` produces `#RRGGBB`; the hash is
    /// split off for the two-tone styling.
    private var hexRow: some View {
        HStack(spacing: DesignTokens.space2) {
            Text("#")
                .foregroundStyle(DesignTokens.textTertiary)
            Text(String(shared.foregroundColor.hexString.dropFirst()))
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
            shared.foregroundColor = color
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
        widthInput = String(tab.document.width())
        heightInput = String(tab.document.height())
    }

    private func commitDimensions() {
        guard
            let w = UInt32(widthInput.trimmingCharacters(in: .whitespaces)),
            let h = UInt32(heightInput.trimmingCharacters(in: .whitespaces))
        else {
            syncDimensionInputs()
            return
        }
        tab.resizeCanvas(width: w, height: h)
        syncDimensionInputs()
    }
}
