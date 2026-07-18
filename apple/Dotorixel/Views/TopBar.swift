import SwiftUI

/// Top bar — app identity (left), zoom controls, grid toggle, and export (right).
/// Layout and styling matches the web editor's TopBar.svelte.
struct TopBar: View {
    let editorState: EditorState
    let tier: LayoutTier

    @State private var exportDocument: PngExportDocument?
    @State private var isExportPresented = false
    @State private var isExportErrorPresented = false
    @State private var exportErrorDescription = ""

    /// TopBar-specific sizes matching web CSS values (not global design tokens).
    private let controlHeight: CGFloat = 32
    private let smallIconSize: CGFloat = 14
    private let radiusXs: CGFloat = 4
    /// Export button icon–text gap — web `.export-btn` gap: 6px (raw CSS, not a token).
    private let exportLabelSpacing: CGFloat = 6
    /// Bar edge padding — not a spacing token: the 44pt logo hit box supplies
    /// most of the optical margin the web gets from `--ds-space-5`.
    private let barEdgePadding: CGFloat = 6
    /// Web `.toolbar-btn.is-disabled` opacity.
    private let disabledToggleOpacity: CGFloat = 0.4

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

            HStack(spacing: DesignTokens.space4) {
                // MARK: Zoom controls group
                HStack(spacing: 0) {
                    zoomButton(
                        systemName: "minus",
                        accessibilityLabel: "Zoom out",
                        action: editorState.handleZoomOut
                    )

                    Button {
                        editorState.handleZoomReset()
                    } label: {
                        Text("\(editorState.zoomPercent)%")
                            .font(.system(size: DesignTokens.fontSizeSm))
                            .foregroundStyle(DesignTokens.textPrimary)
                            .padding(.horizontal, DesignTokens.space2)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Reset zoom")
                    .accessibilityValue("\(editorState.zoomPercent)%")

                    zoomButton(
                        systemName: "plus",
                        accessibilityLabel: "Zoom in",
                        action: editorState.handleZoomIn
                    )
                    zoomButton(
                        systemName: "arrow.up.left.and.arrow.down.right",
                        accessibilityLabel: "Fit to view",
                        action: editorState.handleFit
                    )
                }
                .padding(.horizontal, DesignTokens.space2)
                .frame(height: controlHeight)
                .background(DesignTokens.bgHover)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))

                // MARK: Pixel-perfect toggle
                pixelPerfectToggleButton

                // MARK: Grid toggle
                gridToggleButton

                // MARK: Export
                exportButton
            }
        }
        .padding(.horizontal, barEdgePadding)
        .frame(height: DesignTokens.topBarHeight(tier))
        .frame(maxWidth: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(height: 1)
        }
    }

    // MARK: - Zoom button

    private func zoomButton(
        systemName: String,
        accessibilityLabel: LocalizedStringKey,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: smallIconSize))
                .frame(width: 28, height: 28)
                .foregroundStyle(DesignTokens.textSecondary)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(accessibilityLabel)
        .buttonStyle(ZoomButtonStyle(cornerRadius: radiusXs))
    }

    // MARK: - Pixel-perfect toggle

    /// Web parity: disabled (dimmed, inert) whenever the active tool's
    /// strokes bypass the L-corner filter; the on-state accent only shows
    /// while the toggle is actionable.
    private var pixelPerfectToggleButton: some View {
        let isDisabled = !editorState.activeTool.supportsPixelPerfect
        return Button {
            editorState.pixelPerfect.toggle()
        } label: {
            PixelPerfectIcon()
                .fill(
                    editorState.pixelPerfect && !isDisabled
                        ? DesignTokens.accent : DesignTokens.textSecondary
                )
                .frame(width: 16, height: 16)
                .frame(width: controlHeight, height: controlHeight)
                .contentShape(Rectangle())
        }
        .disabled(isDisabled)
        .opacity(isDisabled ? disabledToggleOpacity : 1)
        .accessibilityLabel("Toggle pixel perfect")
        .accessibilityValue(editorState.pixelPerfect ? "On" : "Off")
        .buttonStyle(BarToggleButtonStyle())
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
        .accessibilityLabel("Toggle grid")
        .accessibilityValue(editorState.showGrid ? "On" : "Off")
        .buttonStyle(BarToggleButtonStyle())
    }

    // MARK: - Export

    private var exportButton: some View {
        Button {
            do {
                exportDocument = try editorState.makePngExportDocument()
                isExportPresented = true
            } catch {
                presentExportError(error)
            }
        } label: {
            HStack(spacing: exportLabelSpacing) {
                Image(systemName: "arrow.down.to.line")
                    .font(.system(size: smallIconSize))
                Text("Export")
                    .font(.system(size: DesignTokens.fontSizeSm, weight: .medium))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, DesignTokens.space4)
            .frame(height: controlHeight)
            .background(DesignTokens.accent)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.radiusSm))
        }
        .buttonStyle(.plain)
        .fileExporter(
            isPresented: $isExportPresented,
            document: exportDocument,
            contentType: .png,
            defaultFilename: editorState.defaultExportFilename
        ) { result in
            if case .failure(let error) = result {
                presentExportError(error)
            }
        }
        .alert("Export Failed", isPresented: $isExportErrorPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(exportErrorDescription)
        }
    }

    private func presentExportError(_ error: Error) {
        exportErrorDescription = error.localizedDescription
        isExportErrorPresented = true
    }
}

// MARK: - Pixel-perfect icon

/// Four-square diagonal staircase — mirrors the web `PixelPerfectIcon.svelte`
/// SVG (16×16 viewBox, 4×4 squares stepping down-right).
private struct PixelPerfectIcon: Shape {
    func path(in rect: CGRect) -> Path {
        let step = rect.width / 4
        var path = Path()
        for i in 0..<4 {
            path.addRect(CGRect(
                x: rect.minX + CGFloat(i) * step,
                y: rect.minY + CGFloat(i) * step,
                width: step,
                height: step
            ))
        }
        return path
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

/// Bar toggle button (grid, pixel-perfect) — bgHover background by default,
/// hover/press states.
private struct BarToggleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        BarToggleButtonBody(configuration: configuration)
    }
}

private struct BarToggleButtonBody: View {
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
