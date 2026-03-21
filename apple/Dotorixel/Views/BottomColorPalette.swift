import SwiftUI

/// Bottom-center color palette: Active swatch + 2×9 preset grid + color picker.
/// Matches the web's `BottomColorPalette` component.
struct BottomColorPalette: View {
    @Bindable var editorState: EditorState

    var body: some View {
        FloatingPanel(horizontalPadding: 16, verticalPadding: 10) {
            HStack(spacing: 8) {
                // Active color swatch (large)
                PebbleSwatch(
                    color: editorState.foregroundColor,
                    isSelected: true,
                    size: .lg
                )

                separator

                // 2×9 preset grid
                paletteGrid

                separator

                // Native color picker
                colorPickerBinding
            }
            .frame(height: 48)
        }
    }

    private var paletteGrid: some View {
        VStack(spacing: 8) {
            ForEach(Array(PebblePalette.rows.enumerated()), id: \.offset) { _, row in
                HStack(spacing: 8) {
                    ForEach(Array(row.enumerated()), id: \.offset) { _, color in
                        PebbleSwatch(
                            color: color,
                            isSelected: color == editorState.foregroundColor,
                            size: .sm
                        ) {
                            editorState.foregroundColor = color
                        }
                    }
                }
            }
        }
    }

    private var colorPickerBinding: some View {
        let binding = Binding<SwiftUI.Color>(
            get: { editorState.foregroundColor.swiftUIColor },
            set: { newColor in
                editorState.foregroundColor = Color(resolved: newColor.resolve(in: EnvironmentValues()))
            }
        )
        return ColorPicker("Foreground color", selection: binding)
            .labelsHidden()
            .frame(width: 32, height: 32)
    }

    private var separator: some View {
        Rectangle()
            .fill(PebbleTokens.panelBorder)
            .frame(width: 1, height: 44)
            .padding(.horizontal, 4)
    }
}
