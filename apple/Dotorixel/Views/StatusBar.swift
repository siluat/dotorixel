import SwiftUI

/// Status bar — canvas dimensions and the committed Marquee on the left,
/// active tool name on the right. Pure display view; mirrors web
/// `StatusBar.svelte`.
struct StatusBar: View {
    let workspace: Workspace
    let tier: LayoutTier

    private var tab: TabState { workspace.activeTab }

    var body: some View {
        HStack {
            Text("\(tab.document.width()) × \(tab.document.height())")
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textSecondary)
            if let marquee = tab.committedMarquee {
                // String arguments keep the catalog placeholders as `%@`;
                // integer interpolation generates a different key and would
                // silently fall back to English in translated locales.
                Text(
                    "Marquee: \(String(marquee.width))×\(String(marquee.height)) at (\(String(marquee.x)), \(String(marquee.y)))"
                )
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textSecondary)
                .lineLimit(1)
            }
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
