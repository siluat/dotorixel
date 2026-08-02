import SwiftUI

/// Status bar — canvas dimensions on the left, active tool name on the right.
/// Pure display view; mirrors web `StatusBar.svelte`.
struct StatusBar: View {
    let workspace: Workspace
    let tier: LayoutTier

    private var tab: TabState { workspace.activeTab }

    var body: some View {
        HStack {
            Text("\(tab.document.width()) × \(tab.document.height())")
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textSecondary)
            Spacer()
            Text(workspace.shared.activeTool.displayName)
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textTertiary)
        }
        .padding(.horizontal, DesignTokens.space5)
        .frame(height: DesignTokens.statusBarHeight(tier))
        .frame(maxWidth: .infinity)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(height: 1)
        }
    }
}
