import SwiftUI

/// View-facing projection of whether the selected tool can act on the canvas.
///
/// The state boundary remains authoritative for edit safety. This projection
/// gives pointer and touch users the same explanation before they attempt an
/// edit, without teaching the views about Layer kinds.
enum CanvasInteractionPresentation: Equatable {
    case available
    case editBlocked

    static func resolve(
        isActiveLayerEditable: Bool,
        tool: EditorTool
    ) -> CanvasInteractionPresentation {
        !isActiveLayerEditable && tool.requiresEditableLayer
            ? .editBlocked
            : .available
    }
}

/// Non-interactive touch affordance shown while a mutation tool targets the
/// Reference Layer. It leaves viewport gestures available and points users at
/// the action that re-enables editing.
struct CanvasInteractionNotice: View {
    let presentation: CanvasInteractionPresentation

    var body: some View {
        if presentation == .editBlocked {
            Label("Select a Pixel Layer to edit", systemImage: "nosign")
                .font(.system(size: DesignTokens.fontSize, weight: .medium))
                .foregroundStyle(DesignTokens.textPrimary)
                .padding(.horizontal, DesignTokens.space4)
                .frame(minHeight: DesignTokens.btnSize)
                .background(DesignTokens.bgElevated.opacity(0.94), in: Capsule())
                .overlay {
                    Capsule().stroke(DesignTokens.border, lineWidth: 1)
                }
                .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
                .padding(DesignTokens.space4)
                .allowsHitTesting(false)
                .accessibilityElement(children: .combine)
        }
    }
}
