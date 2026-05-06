---
title: "Apple native: StatusBar"
status: done
created: 2026-04-06
parent: 014-apple-native-docked-layout.md
---

## What to build

Implement the StatusBar panel, replacing the placeholder from the layout skeleton.

Layout (left to right):
- Left: Canvas dimensions (e.g., "32 × 32")
- Spacer
- Right: Active tool name (e.g., "Pencil")

Both values are derived from EditorState — canvas size from `pixelCanvas` and tool name from `activeTool`. This is a pure display view with no interactive elements.

## Acceptance criteria

- [ ] StatusBar displays canvas dimensions on the left
- [ ] StatusBar displays active tool name on the right
- [ ] Canvas dimensions update when canvas is resized
- [ ] Tool name updates when active tool changes

## Blocked by

- [015 — Design tokens + layout skeleton](015-apple-layout-skeleton.md)

## Scenarios addressed

- Scenario 1: User opens app → sees complete docked layout including status information
- Scenario 3: User selects a tool → StatusBar updates tool name

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Views/StatusBar.swift` | Replaced placeholder with real implementation: `HStack` with canvas dimensions on the left (`Text("\(width) × \(height)")`, `textSecondary`) and active tool label on the right (`Text(activeTool.displayName)`, `textTertiary`), separated by a `Spacer`. Mirrors web `StatusBar.svelte`. Frame stays at 28pt with `bgSurface` background and a 1pt `borderSubtle` top overlay. Reads `editorState.pixelCanvas` and `editorState.activeTool` directly — both are tracked by `@Observable` so no manual version bump is needed. |
| `apple/Dotorixel/Extensions/ToolType+DisplayName.swift` (new) | New `ToolType.displayName` extension returning a static English label per case (`"Pencil"`, `"Eraser"`, `"Line"`, `"Rectangle"`, `"Ellipse"`). Co-located with the existing `Color+SwiftUI.swift` UniFFI-type extension. Doc comment kept caller-agnostic so it survives reuse beyond the StatusBar. |
| `apple/DotorixelTests/ToolTypeTests.swift` (new) | Swift Testing suite `ToolType — displayName` with one parameterized test (`arguments:` over the 5 cases) verifying every `ToolType` maps to a non-empty capitalized English label. |

### Key Decisions

- **Static English labels, not i18n.** Web uses Paraglide.js (`m.tool_pencil()`); Apple has no i18n setup yet. Hardcoding English in the extension is consistent with the rest of the Apple shell, and the extension itself is the natural integration point if/when an Apple i18n mechanism is decided — only the body changes.
- **Extract `ToolType.displayName` instead of inlining `String(describing:)`.** `String(describing: ToolType.pencil)` returns `"pencil"` (lowercase), which would need post-processing. A dedicated extension makes the user-facing contract explicit and unit-testable, and keeps the StatusBar view as a thin composition.
- **No SwiftUI view test for StatusBar.** Same reasoning as #018 — Apple shell has no view-test infrastructure (only `DesignTokensTests` and `EditorStateTests`). Introducing ViewInspector / snapshot-testing / XCUITest is a meta-decision out of scope for this task. TDD effort scoped to the pure mapping function instead.
- **`displayName` not `label`.** Web uses `label` (matches Paraglide message keys); Apple chose `displayName` to match Cocoa convention (`localizedDescription`, `description` family). Cross-shell vocabulary is allowed to diverge where each platform has its own idiom.
- **Inline magic numbers (`16` padding, `28` height, `1` border).** Apple shell has no spacing tokens in `DesignTokens.swift`; sibling views (`RightPanel`, `LeftToolbar`) inline their padding/spacing the same way. Adding a one-off constant in StatusBar would break that consistency. Filing "Apple spacing tokens" as a separate review-backlog item rather than seeding the gap inconsistently.

### Notes

- All 21 Apple unit tests pass (16 prior + 5 in `ToolType — displayName` parameterized test).
- All 4 acceptance criteria manually verified by the user on macOS in the running app. iPadOS smoke test pending reviewer follow-up.
- Apple view-test infrastructure remains unaddressed — review-backlog item added so the trigger (first regression class that demands it) can prompt the meta-decision later.
- This issue completes PRD 014 (docked layout transition); all Phase 1 layout sub-issues (015–019) are now done.
