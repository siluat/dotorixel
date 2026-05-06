# Progress

## Currently Working On

None

## Last Completed

[019 — Apple native: StatusBar](../issues/019-apple-status-bar.md): replaced the placeholder StatusBar with the real implementation — `HStack` with canvas dimensions on the left (`Text("\(width) × \(height)")`, `textSecondary`) and active tool label on the right (`Text(activeTool.displayName)`, `textTertiary`), separated by a `Spacer`. Reads `editorState.pixelCanvas` and `editorState.activeTool` directly; both are tracked by `@Observable` so no manual `canvasVersion` bump is needed. Introduced a new `ToolType.displayName` extension returning a static English label per case (`"Pencil"`, `"Eraser"`, `"Line"`, `"Rectangle"`, `"Ellipse"`) — Apple has no i18n yet, but the extension itself is the natural integration point when an Apple i18n mechanism is decided. New parameterized Swift Testing suite verifies all 5 cases; SwiftUI view tests deferred consistently with #018 (Apple shell has no view-test infra). All 21 Apple tests passing. This issue completes [PRD 014 — Apple native docked layout](../issues/014-apple-native-docked-layout.md); Phase 1 layout sub-issues (015–019) are all done. Two review-backlog items filed: Apple view test infrastructure evaluation, and Apple spacing tokens (sibling views inline `4`/`8`/`12`/`16` literals because `DesignTokens.swift` has no spacing scale).

## Next Up

- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Now that the docked layout is in, the next Apple Phase 1 item. Independent.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
