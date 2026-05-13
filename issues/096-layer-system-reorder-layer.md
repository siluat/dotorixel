---
title: "Layer system: layer reorder"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Allow the user to reorder layers — either by drag-and-drop on a row handle or by up/down buttons (final mechanism is whichever the design (092) settles on). The composite reflects the new depth order immediately.

Scope:

- Reorder affordance on each row per the design (092).
- On commit → calls `Document.reorder_layer(layer_id, new_index)`.
- The renderer composites in the new order on the next frame.
- A snapshot is pushed so the action is undoable.

The TimelinePanel already renders front-most layer at the top (established in 094). Drag/up-down operations work in the **panel's visual order**, but the underlying `Document.reorder_layer` API takes a **stack index** — so this slice must translate visual index → stack index (`stack_idx = (count - 1) - visual_idx`). Add a unit test that locks the mapping so future changes don't silently invert it.

## Acceptance criteria

- Layers can be reordered via the affordance from the design.
- The composite reflects the new depth order immediately after the action.
- Reordering does not change the active layer pointer.
- The action is undoable.
- Dragging a row up moves it forward in z; dragging it down moves it backward.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 5.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/canvas-model.ts` | Added `reorder_layer(id, new_index)` to the `Document` interface; `wasm-sync.test.ts` enforces the WASM facade matches |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `TabState.reorderLayer(id, newVisualIndex)` translates visual→stack via `stack_idx = (count - 1) - visual_idx`, pushes a history snapshot, bumps `renderVersion`, marks dirty |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | 7 tests: top↔bottom moves, active-layer pointer preserved across reorder, undoable, `renderVersion`/`markDirty` bumps, no-op idempotency at same visual index, no orphan snapshot on no-op |
| `src/lib/canvas/fake-drawing-ops.ts` | Throwing `reorder_layer` stub on `FakeDocument` for structural-compatibility |
| `src/lib/ui-editor/TimelinePanel.svelte` | Per-row `≡` drag handle: drag-and-drop reorder across rows, ArrowUp/Down keyboard reorder on focused handle. Disabled at single-layer; click/Enter/Space `stopPropagation` so the handle never triggers row activation |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | 11 tests: handle render, disabled/enabled, key/click stopPropagation, ArrowUp/Down at edges (no-op), drag-from-row → drop-on-row reorder |
| `src/routes/editor/+page.svelte` | `handleReorderLayer` wired to `activeTab.reorderLayer`; new `onReorderLayer` prop on `<TimelinePanel>` |
| `messages/{en,ko,ja}.json` | `aria_reorderLayer` with `{name}` interpolation |

### Key Decisions

- **Drag the handle, not the row.** Only the `≡` button is `draggable`, so clicking/keyboard on the row body still activates the layer (preserves the 104 contract).
- **Visual→stack conversion lives in `TabState`.** The `stack_idx = (count - 1) - visual_idx` mapping is the seam where the panel-order convention (front-most at top, locked by 094) meets stack semantics. A dedicated unit test locks the mapping so a future inversion would fail loudly.
- **No-op short-circuit at the TabState boundary.** Reordering to the current visual position skips snapshot / `renderVersion` / `markDirty` — keeps history clean, mirrors the `removeLayer` last-layer guard pattern.
- **Component-local `let draggingId`.** Avoids happy-dom DnD quirks in tests and keeps reorder state local to the panel.

### Notes

- Whole-row drag is intentionally not enabled. The row already has `ondragover`/`ondrop` wired, so promoting it later is a two-line change (`draggable` + `ondragstart`).
- Apple shell stays single-canvas — no Apple work in this slice (ADR `docs/decisions/web-document-layer-apple-preserved.en.md`).
