import SwiftUI

/// Right panel — canvas size controls (top) and color palette (bottom).
struct RightPanel: View {
    let editorState: EditorState

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                canvasSection
                divider
                colorSection
            }
            .padding(.vertical, 12)
        }
        .frame(width: DesignTokens.rightPanelWidth)
        .frame(maxHeight: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .leading) {
            Rectangle()
                .fill(DesignTokens.border)
                .frame(width: 1)
        }
    }

    // MARK: - Canvas Section

    private var canvasSection: some View {
        VStack(spacing: 12) {
            sectionHeader("Canvas")
            presetButtons
            dimensionInputs
            clearButton
        }
        .padding(.horizontal, 12)
    }

    private var presetButtons: some View {
        HStack(spacing: 6) {
            ForEach(canvasPresets(), id: \.self) { size in
                Button {
                    editorState.handleResize(width: size, height: size)
                } label: {
                    Text("\(size)")
                        .font(.system(size: DesignTokens.fontSizeSm, weight: .medium))
                        .frame(maxWidth: .infinity)
                        .frame(height: 28)
                        .foregroundStyle(isActivePreset(size) ? DesignTokens.accentText : DesignTokens.textPrimary)
                        .background(isActivePreset(size) ? DesignTokens.accentSubtle : DesignTokens.bgHover)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func isActivePreset(_ size: UInt32) -> Bool {
        editorState.pixelCanvas.width() == size && editorState.pixelCanvas.height() == size
    }

    private var dimensionInputs: some View {
        HStack(spacing: 8) {
            DimensionField(
                label: "W",
                value: editorState.pixelCanvas.width(),
                onCommit: { newWidth in
                    editorState.handleResize(width: newWidth, height: editorState.pixelCanvas.height())
                }
            )
            DimensionField(
                label: "H",
                value: editorState.pixelCanvas.height(),
                onCommit: { newHeight in
                    editorState.handleResize(width: editorState.pixelCanvas.width(), height: newHeight)
                }
            )
        }
    }

    private var clearButton: some View {
        Button {
            // Clear — disabled for now, enabled in a separate Phase 1 task
        } label: {
            HStack(spacing: 4) {
                Image(systemName: "trash")
                    .font(.system(size: 12))
                Text("Clear")
                    .font(.system(size: DesignTokens.fontSizeSm, weight: .medium))
            }
            .foregroundStyle(DesignTokens.textSecondary)
            .frame(maxWidth: .infinity)
            .frame(height: 28)
            .background(DesignTokens.bgHover)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
        }
        .buttonStyle(.plain)
        .disabled(true)
        .opacity(DesignTokens.disabledOpacity)
    }

    // MARK: - Divider

    private var divider: some View {
        Rectangle()
            .fill(DesignTokens.borderSubtle)
            .frame(height: 1)
            .padding(.vertical, 12)
            .padding(.horizontal, 12)
    }

    // MARK: - Color Section

    private var colorSection: some View {
        VStack(spacing: 12) {
            sectionHeader("Color")
            foregroundSwatch
            paletteGrid
            colorPicker
        }
        .padding(.horizontal, 12)
    }

    private var foregroundSwatch: some View {
        HStack(spacing: 8) {
            RoundedRectangle(cornerRadius: DesignTokens.radiusSm)
                .fill(editorState.foregroundColor.swiftUIColor)
                .frame(width: 32, height: 32)
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.radiusSm)
                        .stroke(DesignTokens.border, lineWidth: 1)
                )
            Text(editorState.foregroundColor.hexString)
                .font(.system(size: DesignTokens.fontSizeSm, design: .monospaced))
                .foregroundStyle(DesignTokens.textSecondary)
            Spacer()
        }
    }

    private var paletteGrid: some View {
        VStack(spacing: 4) {
            ForEach(Array(PebblePalette.rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 4) {
                    ForEach(Array(row.enumerated()), id: \.offset) { _, color in
                        Button {
                            editorState.handleSelectColor(color)
                        } label: {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(color.swiftUIColor)
                                .frame(maxWidth: .infinity)
                                .aspectRatio(1, contentMode: .fit)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 3)
                                        .stroke(
                                            isSelectedColor(color) ? DesignTokens.accent : DesignTokens.border,
                                            lineWidth: isSelectedColor(color) ? 2 : 0.5
                                        )
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(color.hexString)
                        .accessibilityValue(isSelectedColor(color) ? "Selected" : "Not selected")
                        .accessibilityAddTraits(isSelectedColor(color) ? .isSelected : [])
                    }
                }
            }
        }
    }

    private func isSelectedColor(_ color: Color) -> Bool {
        editorState.foregroundColor.r == color.r
            && editorState.foregroundColor.g == color.g
            && editorState.foregroundColor.b == color.b
            && editorState.foregroundColor.a == color.a
    }

    private var colorPicker: some View {
        HStack {
            ColorPicker(
                "Custom",
                selection: Binding(
                    get: { editorState.foregroundColor.swiftUIColor },
                    set: { editorState.handleSelectSwiftUIColor($0) }
                )
            )
            .font(.system(size: DesignTokens.fontSizeSm))
            .foregroundStyle(DesignTokens.textSecondary)
        }
    }

    // MARK: - Helpers

    private func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title)
                .font(.system(size: DesignTokens.fontSizeSm, weight: .semibold))
                .foregroundStyle(DesignTokens.textSecondary)
                .textCase(.uppercase)
            Spacer()
        }
    }
}

// MARK: - Dimension Input Field

/// Text field for entering canvas width or height, with validation.
private struct DimensionField: View {
    let label: String
    let value: UInt32
    let onCommit: (UInt32) -> Void

    @State private var text: String = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: DesignTokens.fontSizeSm, weight: .medium))
                .foregroundStyle(DesignTokens.textTertiary)
            TextField("", text: $text)
                .font(.system(size: DesignTokens.fontSizeSm, design: .monospaced))
                .textFieldStyle(.plain)
                .frame(height: 28)
                .padding(.horizontal, 6)
                .background(DesignTokens.bgElevated)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.radiusSm)
                        .stroke(DesignTokens.borderSubtle, lineWidth: 1)
                )
                .focused($isFocused)
                .onSubmit { commitValue() }
                .onChange(of: isFocused) { _, focused in
                    if !focused { commitValue() }
                }
                .accessibilityLabel(label == "W" ? "Width" : "Height")
        }
        .onAppear { text = "\(value)" }
        .onChange(of: value) { _, newValue in
            if !isFocused { text = "\(newValue)" }
        }
    }

    private func commitValue() {
        guard let parsed = UInt32(text),
              canvasIsValidDimension(value: parsed),
              parsed != value else {
            text = "\(value)"
            return
        }
        onCommit(parsed)
    }
}
