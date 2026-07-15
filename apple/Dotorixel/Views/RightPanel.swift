import SwiftUI

/// Right panel: Canvas section (size presets, dimension inputs, Clear) and
/// Color section (foreground swatch, palette grid, ColorPicker), separated
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
            foregroundSwatch
            sectionTitle("Palette")
            paletteGrid
            ColorPicker(
                "Color picker",
                selection: foregroundBinding,
                supportsOpacity: false
            )
            .labelsHidden()
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
