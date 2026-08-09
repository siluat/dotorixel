import SwiftUI

/// The Marquee readout for the status bar — dimensions + origin when a
/// Marquee exists, `nil` when none does (web parity: `status_marquee` in
/// `StatusBar.svelte`). Returns the unresolved resource so `Text` can
/// resolve it through the SwiftUI environment locale.
func marqueeStatusText(region: AppleMarqueeRegion?) -> LocalizedStringResource? {
    guard let region else { return nil }
    // Int-cast so the catalog key is a stable "%lld …" — the region's mixed
    // Int32/UInt32 fields would otherwise split the key by specifier.
    return "Marquee: \(Int(region.width))×\(Int(region.height)) at (\(Int(region.x)), \(Int(region.y)))"
}

/// Status bar — canvas dimensions on the left, active tool name on the right.
/// Pure display view; mirrors web `StatusBar.svelte`.
struct StatusBar: View {
    let workspace: Workspace
    let tier: LayoutTier

    private var tab: TabState { workspace.activeTab }

    var body: some View {
        HStack(spacing: DesignTokens.space5) {
            Text("\(tab.document.width()) × \(tab.document.height())")
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(DesignTokens.textSecondary)
            if let marqueeText = marqueeStatusText(region: tab.marquee) {
                Text(marqueeText)
                    .font(.system(size: DesignTokens.fontSizeSm))
                    .foregroundStyle(DesignTokens.textSecondary)
                    // Web parity: `.status-marquee` is `white-space: nowrap`.
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
