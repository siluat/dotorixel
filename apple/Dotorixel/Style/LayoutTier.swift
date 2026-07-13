import SwiftUI

/// Width- and size-class-driven layout tier for the docked editor layout.
///
/// Mirrors the web editor's docked breakpoints (`layout-mode.svelte.ts`):
/// - `.wide` — docked layout below 1440pt (all full-screen iPads); web `wide`.
/// - `.xWide` — docked layout at/above 1440pt (a typical Mac window); web `x-wide`.
/// - `.compact` — the horizontal-compact context (iPad Split View / Slide Over). A
///   full compact experience is the web's tab/mobile paradigm and is deferred (see the
///   issue 013 RFC); Phase 1 only clamps the docked layout gracefully here, reusing
///   `.wide` sizing.
enum LayoutTier {
    case compact
    case wide
    case xWide

    /// Width (pt) at/above which the docked layout uses `.xWide` sizing.
    /// Matches the web's 1440px x-wide breakpoint.
    static let xWideMinWidth: CGFloat = 1440

    /// Resolves the layout tier from the available width and horizontal size class.
    ///
    /// A `.compact` horizontal size class always yields `.compact`, regardless of
    /// width. Otherwise — a `.regular` or unspecified (`nil`, e.g. macOS) size class —
    /// the width selects `.wide` (< 1440pt) vs `.xWide` (≥ 1440pt).
    static func resolve(
        availableWidth: CGFloat,
        horizontalSizeClass: UserInterfaceSizeClass?
    ) -> LayoutTier {
        if horizontalSizeClass == .compact { return .compact }
        return availableWidth >= xWideMinWidth ? .xWide : .wide
    }

    /// Picks the docked-sizing variant for this tier. `.xWide` takes `xWide`; `.wide`
    /// and `.compact` take `wide` — compact reuses the wide sizing while a full compact
    /// layout is deferred (issue 013 RFC).
    func docked<Value>(wide: Value, xWide: Value) -> Value {
        self == .xWide ? xWide : wide
    }
}
