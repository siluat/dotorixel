import SwiftUI

/// Right panel: Canvas section (size presets, dimension inputs, Clear) and
/// Color section (FG/BG pair + swap, palette grid, ColorPicker), separated
/// by a divider. Mirrors web `RightPanel.svelte` for cross-shell parity.
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.space5) {
                canvasSection
                Rectangle()
                    .fill(DesignTokens.borderSubtle)
                    .frame(height: 1)
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
        let isActive = editorState.pixelCanvas.width() == size
            && editorState.pixelCanvas.height() == size
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
        .accessibilityLabel("\(size) by \(size)")
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

    // MARK: - Color section

    private var colorSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.space3) {
            sectionTitle("Color")
            fgBgRow
            sectionTitle("Palette")
            paletteGrid
            ColorPicker(
                "Color picker",
                selection: foregroundBinding,
                supportsOpacity: false
            )
            .labelsHidden()
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

    private func sectionTitle(_ text: LocalizedStringKey) -> some View {
        Text(text)
            .font(.system(size: DesignTokens.fontSizeSm, weight: .semibold))
            .foregroundStyle(DesignTokens.textSecondary)
    }

    /// Bridges UniFFI `Color` ↔ `SwiftUI.Color` so SwiftUI's `ColorPicker`
    /// can drive `editorState.foregroundColor` directly.
    private var foregroundBinding: Binding<SwiftUI.Color> {
        Binding(
            get: { editorState.foregroundColor.swiftUIColor },
            set: { newColor in
                editorState.foregroundColor = Color(
                    resolved: newColor.resolve(in: .init())
                )
            }
        )
    }

    private func syncDimensionInputs() {
        widthInput = String(editorState.pixelCanvas.width())
        heightInput = String(editorState.pixelCanvas.height())
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
