import SwiftUI

/// Top-right floating panel: Canvas size presets, W×H inputs, Export, Clear.
/// Matches the web's `TopControlsRight` component.
struct TopControlsRight: View {
    @Bindable var editorState: EditorState

    @State private var inputWidth: String = ""
    @State private var inputHeight: String = ""
    @FocusState private var focusedField: Field?

    private let presets: [UInt32] = canvasPresets()

    private enum Field { case width, height }

    var body: some View {
        FloatingPanel {
            HStack(spacing: 8) {
                presetsRow
                separator
                sizeInputs
                actionButtons
            }
        }
        .onAppear {
            inputWidth = String(editorState.pixelCanvas.width())
            inputHeight = String(editorState.pixelCanvas.height())
        }
        // Mirrors the web's onblur commit — when either field loses focus,
        // commit the resize. This also covers iPad's numberPad which has
        // no Return key to trigger .onSubmit.
        .onChange(of: focusedField) { _, newValue in
            if newValue == nil { commitResize() }
        }
    }

    // MARK: - Presets

    private var presetsRow: some View {
        HStack(spacing: 4) {
            ForEach(presets, id: \.self) { size in
                Button {
                    resize(width: size, height: size)
                } label: {
                    Text("\(size)")
                        .font(.system(size: PebbleTokens.fontSize))
                        .foregroundStyle(
                            isCurrentPreset(size) ? .white : PebbleTokens.textSecondary
                        )
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(
                    isCurrentPreset(size) ? PebbleTokens.accent : SwiftUI.Color.clear
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }

    // MARK: - Size Inputs

    private var sizeInputs: some View {
        HStack(spacing: 4) {
            sizeInput(text: $inputWidth, field: .width, title: "Canvas width")
            Text("×")
                .font(.system(size: PebbleTokens.fontSize))
                .foregroundStyle(PebbleTokens.textMuted)
            sizeInput(text: $inputHeight, field: .height, title: "Canvas height")
        }
    }

    private func sizeInput(text: Binding<String>, field: Field, title: String) -> some View {
        TextField("", text: text)
            .font(.system(size: PebbleTokens.fontSize))
            .foregroundStyle(PebbleTokens.textPrimary)
            .multilineTextAlignment(.center)
            .frame(width: 48, height: 32)
            .background(PebbleTokens.btnBg)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(PebbleTokens.panelBorder, lineWidth: 1)
            )
            .textFieldStyle(.plain)
            .focused($focusedField, equals: field)
            .accessibilityLabel(title)
            #if os(iOS)
            .keyboardType(.numberPad)
            #endif
            .onSubmit { commitResize() }
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        HStack(spacing: 8) {
            // Export (disabled — future task)
            Button {} label: {
                Image(systemName: "square.and.arrow.down")
            }
            .buttonStyle(PebbleButtonStyle())
            .disabled(true)
            .opacity(0.4)

            // Clear (disabled — future task)
            Button {} label: {
                Image(systemName: "trash")
            }
            .buttonStyle(PebbleButtonStyle())
            .disabled(true)
            .opacity(0.4)
        }
    }

    private var separator: some View {
        Rectangle()
            .fill(PebbleTokens.panelBorder)
            .frame(width: 1, height: 28)
            .padding(.horizontal, 2)
    }

    // MARK: - Logic

    private func isCurrentPreset(_ size: UInt32) -> Bool {
        editorState.pixelCanvas.width() == size && editorState.pixelCanvas.height() == size
    }

    private func resize(width: UInt32, height: UInt32) {
        guard width != editorState.pixelCanvas.width() || height != editorState.pixelCanvas.height() else { return }
        editorState.pixelCanvas = try! ApplePixelCanvas(width: width, height: height)
        editorState.viewport = AppleViewport.forCanvas(canvasWidth: width, canvasHeight: height)
        editorState.canvasVersion += 1
        inputWidth = String(width)
        inputHeight = String(height)
    }

    private func commitResize() {
        guard let w = UInt32(inputWidth), let h = UInt32(inputHeight),
              canvasIsValidDimension(value: w), canvasIsValidDimension(value: h) else { return }
        resize(width: w, height: h)
    }
}
