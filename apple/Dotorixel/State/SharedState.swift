import SwiftUI

/// Workspace-shared editor state — everything every tab sees by reference
/// (web parity: `SharedState` in `shared-state.svelte.ts`). Mutating it is
/// immediately visible to every tab.
@Observable
final class SharedState {
    /// Fired on every persistable mutation of a shared slot. The view layer
    /// assigns these slots directly (color wells, the pixel-perfect toggle),
    /// so dirty marking hooks the setters rather than workspace methods.
    /// Wired by the owning `Workspace`; assignment inside `init` never fires
    /// it (Swift observers are inert during initialization), so hydration
    /// marks nothing.
    @ObservationIgnored var onPersistableChange: (() -> Void)?

    var activeTool: EditorTool = .pencil {
        didSet { onPersistableChange?() }
    }
    var foregroundColor: Color {
        didSet { onPersistableChange?() }
    }
    var backgroundColor: Color {
        didSet { onPersistableChange?() }
    }
    /// Pixel-perfect freehand mode (web default: on). Strokes snapshot the
    /// flag at begin, so toggling mid-stroke only affects the next stroke.
    var pixelPerfect: Bool = true {
        didSet { onPersistableChange?() }
    }

    /// Colors recently *used* to draw or sampled by the eyedropper —
    /// most-recent first. Persisted in the workspace snapshot (web parity).
    private(set) var recentColors: [Color] = []

    init() {
        // Web-matching defaults (shared-state.svelte.ts): foreground black, background white.
        self.foregroundColor = Color(r: 0x00, g: 0x00, b: 0x00, a: 0xFF)
        self.backgroundColor = Color(r: 0xFF, g: 0xFF, b: 0xFF, a: 0xFF)
    }

    /// Rebuilds the shared slots from their persistence record. Hydration is
    /// not a user mutation — it just assigns state, marking nothing dirty.
    init(restoring snapshot: SharedStateSnapshot) {
        self.activeTool = snapshot.activeTool
        self.foregroundColor = snapshot.foregroundColor
        self.backgroundColor = snapshot.backgroundColor
        // The store is an external input: capping here preserves the live
        // `maxRecentColors` invariant against an oversized stored list.
        self.recentColors = Array(snapshot.recentColors.prefix(Self.maxRecentColors))
        self.pixelPerfect = snapshot.pixelPerfect
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
        onPersistableChange?()
    }
}
