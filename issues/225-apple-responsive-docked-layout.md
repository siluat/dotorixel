---
title: Apple native — size-adaptive docked layout (iPad regular / Mac)
status: done
created: 2026-07-09
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 1: Layout
finish. This slice delivers the "Responsive tiers" item for the two regular-width
contexts. iPad-compact is deliberately deferred (see below).

## What to build

The Apple shell's docked editor layout currently renders at a **single fixed size**
(LeftToolbar 44pt, RightPanel 220pt, TopBar 44pt, StatusBar 28pt). Make it
**size-adaptive** so it matches the web editor's docked-tier sizing across the two
regular-width contexts the native app targets in Phase 1: full-screen iPad (≈ web
`wide`) and Mac (≈ web `x-wide`).

Derive the tier from the **available width** plus the **horizontal size class**, and
drive the panel/bar dimensions from that tier instead of from fixed constants. The
tier decision must be a pure, unit-testable function of `(availableWidth,
horizontalSizeClass)` so the mapping is verifiable without rendering — mirroring the
web's `createLayoutMode` breakpoints. On native, `horizontalSizeClass == .regular`
means "docked" (the web's `≥1024px` threshold is expressed by the size class); within
regular, the **1440pt** boundary selects wide vs. x-wide sizing, matching the web.

**Sizing parity target** (mirrors `src/styles/design-tokens.css` + the editor grid in
`src/routes/editor/+page.svelte`):

| Element                | regular / "wide" (< 1440pt) | expanded / "x-wide" (≥ 1440pt) |
|------------------------|-----------------------------|--------------------------------|
| RightPanel width       | 200pt                       | 240pt                          |
| TopBar height          | 44pt                        | 48pt                           |
| LeftToolbar button box | 44pt                        | 48pt                           |
| StatusBar height       | 28pt                        | 32pt                           |

This supersedes the current 220pt RightPanel compromise, bringing the shared-token
parity with the web back into alignment.

**Out of scope — iPad compact (deferred).** When `horizontalSizeClass == .compact`
(iPad Split View / Slide Over), a *proper* compact experience is the web's tab/mobile
paradigm, which depends on features not yet on native (layer panel = Phase 3, the
settings-tab transforms = Phase 5). Phase 1 only guarantees the docked layout
**degrades gracefully** at compact widths — it must clamp without overflow, clipped
controls, or canvas overlap. The full compact adaptation is a later-phase task.

## Acceptance criteria

- A pure function maps `(availableWidth, horizontalSizeClass)` → layout tier, covered
  by unit tests at and around the 1440pt boundary and for the compact size class.
- On Mac with a window **≥ 1440pt** wide, the docked layout uses x-wide sizing
  (RightPanel 240 / TopBar 48 / LeftToolbar 48 / StatusBar 32); a narrower window uses
  wide sizing (200 / 44 / 44 / 28). Resizing across the boundary updates live.
- On a **full-screen iPad** (regular width), the docked layout renders with wide-tier
  sizing and stays usable across supported iPad sizes and orientation changes
  (including narrow full-screen iPads that are still regular-width).
- At **compact** widths (iPad Split View / Slide Over) the docked layout does not
  overflow, clip controls, or overlap the canvas — it clamps gracefully. (Full compact
  UX is out of scope; see Parent RFC.)
- Tier-dependent sizing is defined in / derived from `DesignTokens`, preserving the
  cross-shell token parity with the web; `DesignTokensTests` is extended to cover both
  tiers.
- No change to the `EditorState` shape or any persisted state — the layout tier is a
  view-derived value, never stored — consistent with the RFC's "no state redesign" for
  Phase 1.
- Existing editor behavior (drawing, zoom/pan, undo/redo, canvas fit) is unaffected at
  both tiers.

## Blocked by

- None — can start immediately.

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Style/LayoutTier.swift` | New. Pure tier `{ compact, wide, xWide }` + `resolve(availableWidth:horizontalSizeClass:)` (1440pt boundary) + `docked(wide:xWide:)` variant picker |
| `apple/Dotorixel/Style/DesignTokens.swift` | Fixed 220/44 constants → tier accessors: rightPanelWidth 200/240, leftToolbarWidth 44/48, topBarHeight 44/48, statusBarHeight 28/32 |
| `apple/Dotorixel/Style/ToolButtonStyle.swift` | Added `boxSize` param (default 44) so LeftToolbar grows hit boxes to 48 on x-wide |
| `apple/Dotorixel/ContentView.swift` | Root `GeometryReader` width + `@Environment(\.horizontalSizeClass)` → tier, passed to the four region views |
| `apple/Dotorixel/Views/{TopBar,LeftToolbar,RightPanel,StatusBar}.swift` | Each takes `tier` and sizes from the accessors |
| `apple/DotorixelTests/LayoutTierTests.swift` | New. 5 tests: resolve mapping (1440 boundary, compact, nil=macOS) + docked policy |
| `apple/DotorixelTests/DesignTokensTests.swift` | Replaced fixed 220/44 assertions with a tier-sizing suite |

### Key Decisions

- **iPad-compact deferred.** A real compact experience is the web's tab/mobile paradigm (blocked on Phase 3+ features); Phase 1 only clamps the docked layout gracefully. Compact reuses `.wide` sizing.
- **Tier vocabulary mirrors the web.** Named `{ compact, wide, xWide }` to match the web's docked breakpoints (`wide`/`x-wide`); only `compact` keeps the SwiftUI size-class term.
- **220 → 200/240 is a parity fix** — the Apple panel now matches the web's wide/x-wide values.
- **LeftToolbar hit box scales 44/48** on x-wide (web parity) via a `boxSize` param on the shared `ToolButtonStyle`.

### Notes

- **View-layer runtime AC not automatically verified.** The `GeometryReader → tier → size` chain is covered by unit tests (`resolve` + token values) and a clean compile; the *rendered* result (live resize across 1440, compact clamp) is not snapshot-tested — the project has no view-test infra. A macOS visual smoke check was attempted but blocked by this session's TCC (screen-recording) permission. Follow-up: **issue 226** (Apple view snapshot testing) covers the rendered layout.
- **macOS window floored at 480×400** (`DotorixelApp`, `.windowResizability(.contentMinSize)`) so a narrowly-resized Mac window can't squeeze the docked chrome (44pt toolbar + 200pt panel) past the canvas; iPad's compact context is ≥320pt natively. Closes the compact-clamp edge cubic flagged in PR review.
- `EditorState` and persisted state unchanged — tier is a view-derived value.
- `Dotorixel.xcodeproj` is gitignored (xcodegen-generated); adding files needs `xcodegen generate` before `xcodebuild`.
- 28 tests pass via `xcodebuild test -scheme Dotorixel -destination 'platform=macOS'`.
