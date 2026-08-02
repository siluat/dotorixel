import SwiftUI

/// Left toolbar — tool selection (pencil/eraser) and undo/redo controls.
struct LeftToolbar: View {
    let workspace: Workspace

    private var tab: TabState { workspace.activeTab }
    let tier: LayoutTier

    /// Strip edge padding — web LeftToolbar padding: 6px 0 (raw CSS, not a token).
    private let stripEdgePadding: CGFloat = 6

    var body: some View {
        // Strip width tracks the tool-button hit box (44pt wide / 48pt x-wide), so
        // both derive from one tier-dependent value — mirroring the web toolbar.
        let boxSize = DesignTokens.leftToolbarWidth(tier)

        VStack(spacing: DesignTokens.space1) {
            // MARK: - Tool buttons

            ForEach(EditorTool.allCases, id: \.self) { tool in
                let isActive = workspace.shared.activeTool == tool
                // Re-tapping the active constrainable tool toggles the
                // Constrain latch (web parity) — the latch has no separate
                // button; the badge on the active tool shows its state.
                // Shortcut hint rides along with the label (web parity:
                // toolbar tooltip "Pencil (P)"). Resolved eagerly via
                // String(localized:) — follows the system language
                // (Locale.current), not the SwiftUI environment locale.
                let hintedLabel = "\(String(localized: tool.displayName)) (\(String(tool.shortcutKey).uppercased()))"
                Button {
                    workspace.activateTool(tool)
                } label: {
                    Image(systemName: tool.symbolName)
                        .font(.system(size: DesignTokens.iconSize))
                        .accessibilityLabel(hintedLabel)
                }
                .help(hintedLabel)
                .buttonStyle(ToolButtonStyle(
                    isActive: isActive,
                    boxSize: boxSize,
                    showsConstrainBadge: isActive && tool.isConstrainable && workspace.isConstrainLatchOn
                ))
            }

            // MARK: - Separator

            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(width: 28, height: 1)
                .padding(.vertical, DesignTokens.space1)

            // MARK: - Action buttons (undo/redo)

            Button {
                tab.handleUndo()
            } label: {
                Image(systemName: "arrow.uturn.backward")
                    .font(.system(size: 16))
            }
            .buttonStyle(ToolButtonStyle(tint: DesignTokens.textTertiary, boxSize: boxSize))
            .disabled(!tab.canUndo)

            Button {
                tab.handleRedo()
            } label: {
                Image(systemName: "arrow.uturn.forward")
                    .font(.system(size: 16))
            }
            .buttonStyle(ToolButtonStyle(tint: DesignTokens.textTertiary, boxSize: boxSize))
            .disabled(!tab.canRedo)

            Spacer()
        }
        .padding(.vertical, stripEdgePadding)
        .frame(width: boxSize)
        .frame(maxHeight: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .trailing) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(width: 1)
        }
    }
}
