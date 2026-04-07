import SwiftUI

/// Top bar — app identity (left), zoom controls, grid toggle, and export (right).
/// Layout and styling matches the web editor's TopBar.svelte.
struct TopBar: View {
    let editorState: EditorState

    /// TopBar-specific sizes matching web CSS values (not global design tokens).
    private let controlHeight: CGFloat = 32
    private let smallIconSize: CGFloat = 14
    private let radiusXs: CGFloat = 4

    var body: some View {
        HStack(spacing: 0) {
            // MARK: - App identity

            Image(.logo)
                .resizable()
                .frame(width: 24, height: 24)
                .clipShape(RoundedRectangle(cornerRadius: radiusXs))
                .frame(width: DesignTokens.btnSize, height: DesignTokens.btnSize)

            Spacer()

            // MARK: - Actions

            HStack(spacing: 12) {
                // MARK: Zoom controls group
                HStack(spacing: 0) {
                    zoomButton(systemName: "minus", action: editorState.handleZoomOut)

                    Button {
                        editorState.handleZoomReset()
                    } label: {
                        Text("\(editorState.zoomPercent)%")
                            .font(.system(size: DesignTokens.fontSizeSm))
                            .foregroundStyle(DesignTokens.textPrimary)
                            .padding(.horizontal, 4)
                    }
                    .buttonStyle(.plain)

                    zoomButton(systemName: "plus", action: editorState.handleZoomIn)
                    zoomButton(
                        systemName: "arrow.up.left.and.arrow.down.right",
                        action: editorState.handleFit
                    )
                }
                .padding(.horizontal, 4)
                .frame(height: controlHeight)
                .background(DesignTokens.bgHover)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))

                // MARK: Grid toggle
                gridToggleButton

                // MARK: Export
                exportButton
            }
        }
        .padding(.horizontal, 6)
        .frame(height: 44)
        .frame(maxWidth: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(height: 1)
        }
    }

    // MARK: - Zoom button

    private func zoomButton(systemName: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: smallIconSize))
                .frame(width: 28, height: 28)
                .foregroundStyle(DesignTokens.textSecondary)
                .contentShape(Rectangle())
        }
        .buttonStyle(ZoomButtonStyle(cornerRadius: radiusXs))
    }

    // MARK: - Grid toggle

    private var gridToggleButton: some View {
        Button {
            editorState.showGrid.toggle()
        } label: {
            Image(systemName: "grid")
                .font(.system(size: 16))
                .frame(width: controlHeight, height: controlHeight)
                .foregroundStyle(
                    editorState.showGrid ? DesignTokens.accent : DesignTokens.textSecondary
                )
                .contentShape(Rectangle())
        }
        .buttonStyle(GridToggleButtonStyle())
    }

    // MARK: - Export

    private var exportButton: some View {
        Button {
            // Export — disabled for now, enabled in a separate Phase 1 task
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "arrow.down.to.line")
                    .font(.system(size: smallIconSize))
                Text("Export")
                    .font(.system(size: DesignTokens.fontSizeSm, weight: .medium))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .frame(height: controlHeight)
            .background(DesignTokens.accent)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
        }
        .buttonStyle(.plain)
        .disabled(true)
        .opacity(DesignTokens.disabledOpacity)
    }
}

// MARK: - TopBar-specific button styles

/// Small button inside the zoom controls group — no background, hover/press states.
private struct ZoomButtonStyle: ButtonStyle {
    let cornerRadius: CGFloat

    func makeBody(configuration: Configuration) -> some View {
        ZoomButtonBody(configuration: configuration, cornerRadius: cornerRadius)
    }
}

private struct ZoomButtonBody: View {
    let configuration: ButtonStyleConfiguration
    let cornerRadius: CGFloat
    @State private var isHovered = false

    var body: some View {
        configuration.label
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
            .onHover { isHovered = $0 }
    }

    private var background: SwiftUI.Color {
        if configuration.isPressed { return DesignTokens.bgActive }
        if isHovered { return DesignTokens.bgActive }
        return .clear
    }
}

/// Grid toggle button — bgHover background by default, hover/press states.
private struct GridToggleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        GridToggleButtonBody(configuration: configuration)
    }
}

private struct GridToggleButtonBody: View {
    let configuration: ButtonStyleConfiguration
    @State private var isHovered = false

    var body: some View {
        configuration.label
            .background(background)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
            .onHover { isHovered = $0 }
    }

    private var background: SwiftUI.Color {
        if configuration.isPressed { return DesignTokens.bgActive }
        if isHovered { return DesignTokens.bgActive }
        return DesignTokens.bgHover
    }
}
