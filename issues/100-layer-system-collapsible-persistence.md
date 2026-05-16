---
title: "Layer system: persist `timelinePanelCollapsed`"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Wire the `timelinePanelCollapsed` field defined in 090 (V3 schema) and present on the runtime Document (087) to the chevron toggle from 099. After the user collapses or expands, the choice survives page refresh.

Scope:

- On chevron toggle → write the new boolean to `Document.timelinePanelCollapsed`.
- On TabState load → use the persisted value to render the panel in the correct state.
- The migration path from 090 already defaults `timelinePanelCollapsed = false` on V2→V3 upgrade.
- Toggling is **not** undoable (UI panel state, not artwork).

## Acceptance criteria

- Collapsing the panel and refreshing the page restores the collapsed state.
- Expanding the panel and refreshing the page restores the expanded state.
- Per-document state — different documents (tabs) keep their own value.
- V2→V3 migrated documents start expanded (`timelinePanelCollapsed = false`).
- Toggling does not push a history snapshot.

## Blocked by

- [099 — Collapsible chevron (no persistence)](099-layer-system-collapsible-toggle.md)

## Scenarios addressed

- Scenario 10.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | Added `set_timeline_panel_collapsed` setter + inline unit test mirroring the existing getter style |
| `wasm/src/lib.rs` | Added thin `set_timeline_panel_collapsed` binding that delegates to the core method |
| `src/lib/canvas/canvas-model.ts` | Extended the TS `Document` interface; doc comment records the contract (persisted, not undoable) |
| `src/lib/canvas/fake-drawing-ops.ts` | Mirrored the new setter on the `FakeDocument` test double via a closure-held mutable boolean |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Added `setTimelinePanelCollapsed(boolean)`: idempotent no-op guard → write through Document → bump `renderVersion` → `markDirty`. No history snapshot |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Six tests under `setTimelinePanelCollapsed`: writes, markDirty, renderVersion bump, no-op idempotency, no history push, `toSnapshot` reflection |
| `src/lib/ui-editor/TimelinePanel.svelte` | Converted to a controlled component: removed local `$state`, added `collapsed` and `onToggleCollapsed` props |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Rewrote stateful tests for the controlled API; collapsed all duplicated inline prop blocks into a single `defaultProps` spread |
| `src/routes/editor/+page.svelte` | `isTimelinePanelCollapsed` derived from `tab.document.is_timeline_panel_collapsed()` (anchored on `tab.renderVersion`); toggle handler calls `tab.setTimelinePanelCollapsed`; wired into both desktop and mobile `<TimelinePanel>` call sites |

### Key Decisions

- **Controlled `TimelinePanel`**: Lifted state to `+page.svelte` instead of letting the component own a `$state` plus an effect that writes back. The parent already owns `tab` and `editor.workspace`; pushing the persisted value down as a prop keeps the component a pure view of incoming state, which is the project's preferred shape for stateful canvas surfaces.
- **No undo for panel collapse**: Followed the existing layer-visibility precedent — UI panel state is incidental to the artwork. The TabState setter goes through `markDirty` (so persistence picks it up) but never calls `toolRunner.pushSnapshot`.
- **No-op guard at the TabState layer**: Skipping the write when the new value equals the current one keeps `markDirty` / `renderVersion` from firing on redundant calls — same shape as the existing layer mutators.
- **No WASM binding test**: Skipped per the PRD's "Lightly recommended" rule; the round-trip through TabState + the Rust-side core test give enough behavioral coverage for a thin delegating binding.

### Notes

- Browser-verified all five acceptance criteria with `agent-browser`: collapse + refresh, expand + refresh, per-tab independence, default-expanded after V2→V3 migration (existing migration coverage), and no history snapshot.
- Test totals after the change: 966 TS / 281 Rust workspace / 46 `TimelinePanel.svelte.test.ts`; `bun run check` clean.
- Apple shell remains on the single-canvas model — this slice does not affect the ADR-recorded split.
- **Mobile call site forces `collapsed={false}`** — PRD-086 specifies that on mobile the LAYERS tab itself is the toggle, with no separate collapse control. Honoring the persisted desktop flag on the mobile call site would render the panel as header-only with no in-UI path to expand (the chevron is hidden under the `@media (max-width: 1023px)` rule). The mobile call site therefore ignores the persisted flag; the desktop preference is preserved untouched on the document.
