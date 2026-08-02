import SwiftUI

/// Workspace-shared editor state — everything every tab sees by reference
/// (web parity: `SharedState` in `shared-state.svelte.ts`). Mutating it is
/// immediately visible to every tab.
@Observable
final class SharedState {
    var activeTool: EditorTool = .pencil
    var foregroundColor: Color
    var backgroundColor: Color
    /// Pixel-perfect freehand mode (web default: on). Strokes snapshot the
    /// flag at begin, so toggling mid-stroke only affects the next stroke.
    var pixelPerfect: Bool = true

    /// Colors recently *used* to draw or sampled by the eyedropper —
    /// most-recent first. In-memory only for now; persistence arrives with
    /// the session auto-save slice (the web keeps this in the workspace
    /// snapshot).
    private(set) var recentColors: [Color] = []

    init() {
        // Web-matching defaults (shared-state.svelte.ts): foreground black, background white.
        self.foregroundColor = Color(r: 0x00, g: 0x00, b: 0x00, a: 0xFF)
        self.backgroundColor = Color(r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF)
    }

    /// Maximum entries in `recentColors` — web parity (`addRecentColor` in
    /// `src/lib/canvas/color.ts`).
    private static let maxRecentColors = 12

    /// Folds a used color into `recentColors`, most-recent first. Re-using a
    /// listed color moves it to the front instead of duplicating it; the
    /// list caps at `maxRecentColors`, dropping the oldest.
    func recordRecentColor(_ color: Color) {
        recentColors.removeAll { $0 == color }
        recentColors.insert(color, at: 0)
        if recentColors.count > Self.maxRecentColors {
            recentColors.removeLast(recentColors.count - Self.maxRecentColors)
        }
    }
}
