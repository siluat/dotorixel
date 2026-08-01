import SwiftUI

/// A panel icon button: compact glyph chrome whose tappable area expands to the
/// HIG touch minimum, so an iPad tap lands reliably without the visual growing
/// to 44pt. The web draws these controls at 24px with a hover background;
/// `.plain` keeps the same compact look while `contentShape` claims the full
/// touch box.
///
/// Shared by the Timeline panel's layer controls (add, remove, visibility, the
/// collapse chevron) and the RightPanel's color-swap action. Distinct from
/// `IconButtonStyle`, the TopBar's chrome, which fills the whole 44pt box with
/// an 18pt glyph and a hover/press background.
struct PanelIconButton: View {
    let systemName: String
    let accessibilityLabel: LocalizedStringKey
    var tint: SwiftUI.Color = DesignTokens.textSecondary
    /// A disabled control stays visible but dims — the button is still the
    /// place the action lives, it just isn't available yet.
    var isEnabled: Bool = true
    let action: () -> Void

    /// Glyph extent — the web panel icons (`size={14}`) and the `+` / `✕`
    /// glyphs all render at 14px (raw CSS, not a token).
    private let iconSize: CGFloat = 14

    /// Dimming for a disabled panel icon — web `.remove-btn:disabled`: 0.35.
    /// Remove is the only panel icon that disables today; the web dims its
    /// `.add-btn:disabled` less (0.55), so a second disable-capable button
    /// would turn this into a per-call-site value. Not
    /// `DesignTokens.disabledOpacity` (0.4) — that token mirrors the web's
    /// `.action-btn:disabled`, the TopBar's dimming.
    private let disabledIconOpacity: Double = 0.35

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: iconSize))
                .foregroundStyle(tint)
                .opacity(isEnabled ? 1 : disabledIconOpacity)
                .frame(minWidth: DesignTokens.btnSize, minHeight: DesignTokens.btnSize)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .accessibilityLabel(accessibilityLabel)
    }
}
