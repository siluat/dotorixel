# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD published and decomposed into 14 sub-issues (087–100); see `todo.md` for the full list. ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. Starting points without blockers: **087** (Rust core: Document/Layer + composite + add/delete/reorder, AFK) and **092** (TimelinePanel design — Candidate A detail pass, HITL). The two run in parallel.

## Last Completed

[019 — Apple native: StatusBar](../issues/019-apple-status-bar.md): replaced the placeholder StatusBar with the real implementation — `HStack` with canvas dimensions on the left (`Text("\(width) × \(height)")`, `textSecondary`) and active tool label on the right (`Text(activeTool.displayName)`, `textTertiary`), separated by a `Spacer`. Reads `editorState.pixelCanvas` and `editorState.activeTool` directly; both are tracked by `@Observable` so no manual `canvasVersion` bump is needed. Introduced a new `ToolType.displayName` extension returning a static English label per case (`"Pencil"`, `"Eraser"`, `"Line"`, `"Rectangle"`, `"Ellipse"`) — Apple has no i18n yet, but the extension itself is the natural integration point when an Apple i18n mechanism is decided. New parameterized Swift Testing suite verifies all 5 cases; SwiftUI view tests deferred consistently with #018 (Apple shell has no view-test infra). All 21 Apple tests passing. This issue completes [PRD 014 — Apple native docked layout](../issues/014-apple-native-docked-layout.md); Phase 1 layout sub-issues (015–019) are all done. Two review-backlog items filed: Apple view test infrastructure evaluation, and Apple spacing tokens (sibling views inline `4`/`8`/`12`/`16` literals because `DesignTokens.swift` has no spacing scale).

## Next Up

- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Now that the docked layout is in, the next Apple Phase 1 item. Independent.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
