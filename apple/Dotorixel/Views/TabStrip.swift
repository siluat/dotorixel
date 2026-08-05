import SwiftUI

/// Tab strip — one tab per open document, docked below the TopBar (web
/// parity: `TabStrip.svelte`). The active tab reads elevated with an accent
/// underline; each tab carries a close affordance (disabled at the sole-tab
/// guard) and the trailing + opens a fresh document.
struct TabStrip: View {
    let workspace: Workspace
    /// Routes close taps: saved and blank documents close immediately,
    /// anything else waits on the save dialog the flow presents.
    let saveFlow: SaveFlow

    /// Web `.close-btn` / `.new-tab-btn` sizes (raw CSS values, not tokens).
    private let closeButtonSize: CGFloat = 16
    private let closeIconSize: CGFloat = 10
    private let newTabButtonSize: CGFloat = 28
    private let newTabIconSize: CGFloat = 14
    /// Web `.tab.active` underline thickness.
    private let activeUnderlineHeight: CGFloat = 2

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(Array(workspace.tabs.enumerated()), id: \.element.documentId) { index, tab in
                        tabItem(tab, at: index)
                            .id(tab.documentId)
                    }
                    newTabButton
                }
            }
            // Web parity: activation scrolls the active tab into view
            // (`scrollIntoView` effect in `TabStrip.svelte`).
            .onChange(of: workspace.activeTab.documentId) { _, activeId in
                withAnimation { proxy.scrollTo(activeId) }
            }
        }
        .frame(height: DesignTokens.tabStripHeight)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(DesignTokens.bgSurface)
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(DesignTokens.borderSubtle)
                .frame(height: 1)
        }
    }

    // MARK: - Tab item

    private func tabItem(_ tab: TabState, at index: Int) -> some View {
        let isActive = workspace.activeTab === tab
        return HStack(spacing: DesignTokens.space2) {
            selectTabButton(tab, at: index, isActive: isActive)
            closeButton(for: tab)
        }
        .padding(.trailing, DesignTokens.space3)
        .frame(maxHeight: .infinity)
        .background(isActive ? DesignTokens.bgElevated : .clear)
        .overlay(alignment: .bottom) {
            if isActive {
                Rectangle()
                    .fill(DesignTokens.accent)
                    .frame(height: activeUnderlineHeight)
            }
        }
    }

    /// The tab's tap surface: activates the tab. A real `Button` — not a
    /// tap gesture — so VoiceOver exposes the activation (the TimelinePanel
    /// row-select idiom); the name area spans the tab minus the close
    /// button, web parity for the `.tab` click target.
    private func selectTabButton(_ tab: TabState, at index: Int, isActive: Bool) -> some View {
        Button {
            workspace.setActiveTab(index)
        } label: {
            Text(verbatim: tab.name)
                .font(.system(size: DesignTokens.fontSizeSm))
                .foregroundStyle(isActive ? DesignTokens.textPrimary : DesignTokens.textSecondary)
                .padding(.leading, DesignTokens.space4)
                .frame(maxHeight: .infinity)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(verbatim: tab.name))
        .accessibilityAddTraits(isActive ? [.isSelected] : [])
    }

    // The close request carries the document's identity, not its position:
    // the flow's awaits can outlive any index (a second close tap shifts
    // the strip), and a stale index would close the wrong tab.
    private func closeButton(for tab: TabState) -> some View {
        Button {
            Task { await saveFlow.requestCloseTab(documentId: tab.documentId) }
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: closeIconSize, weight: .medium))
                .foregroundStyle(DesignTokens.textTertiary)
                .frame(width: closeButtonSize, height: closeButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!workspace.canCloseTab)
        .opacity(workspace.canCloseTab ? 1 : DesignTokens.disabledOpacity)
        .accessibilityLabel("Close \(tab.name)")
    }

    // MARK: - New tab

    private var newTabButton: some View {
        Button {
            workspace.addTab()
        } label: {
            Image(systemName: "plus")
                .font(.system(size: newTabIconSize))
                .foregroundStyle(DesignTokens.textTertiary)
                .frame(width: newTabButtonSize, height: newTabButtonSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.leading, DesignTokens.space2)
        .accessibilityLabel("New tab")
    }
}
