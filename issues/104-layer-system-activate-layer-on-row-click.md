---
title: "Layer system: activate layer on row click"
status: done
created: 2026-05-13
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Wire user-driven active-layer selection in the TimelinePanel. Clicking a non-active row makes that layer the active one; subsequent drawing tool actions apply to it. Without this slice, users can only draw on whichever layer is left active by automatic transitions (add / delete), which is a usability blocker once the stack has more than one layer.

The Rust core (`Document.set_active_layer`) and the WASM facade (`wasm/src/lib.rs` `set_active_layer`) already exist from 087/089. This slice only adds the TS and UI wiring.

Scope:

- TimelinePanel exposes a per-row activation affordance per the design (092). The whole row body (outside of nested per-row controls like delete / visibility / reorder) is the click target.
- On click of a non-active row → calls `TabState.setActiveLayer(layer_id)`, which delegates to `Document.set_active_layer`, bumps `renderVersion`, and marks the doc dirty.
- Clicking the already-active row is a **no-op** (no method call, no `renderVersion` bump, no `markDirty`).
- The action is **not undoable** — selection is a UI/cursor state, not artwork. Follows the same convention as the collapse toggle (099/100) and matches Photoshop / Aseprite. The active-layer pointer still travels through history snapshots that are pushed by *other* operations (add / delete / reorder / draw), so undo restores the active layer that was correct at the time of the snapshot.
- Keyboard accessibility: the row is focusable and `Space` / `Enter` activate it. Implement with a `<button>` (or `role="button"` + `tabindex="0"` + key handler) — pick the minimum that gives accessible click + keyboard for free without breaking the upcoming nested per-row buttons in 095 / 097.
- Visual feedback: the existing active-row treatment (surface fill + 2px accent bar) from 093 / 094 is reused — no new tokens.
- Mobile: the same wiring applies via the shared TimelinePanel component used by 098.

## Acceptance criteria

- Clicking a non-active row makes that layer the active one (visual active state updates immediately).
- Clicking the already-active row is a no-op (no snapshot pushed, no `markDirty` call, no `renderVersion` bump).
- After activating layer B, a draw action applies to B (verified at the TabState integration level).
- Keyboard: focusing a row and pressing Space or Enter activates it.
- The action is **not** undoable — pressing undo after an activation does not restore the previous active layer (it restores the most recent *content* snapshot).
- Active-row visual treatment (fill + accent bar) is unchanged from 093 / 094 — this slice does not introduce new tokens or new visual states.
- The wiring is reused on mobile (no separate component path).

## Blocked by

None — the Rust core and WASM facade already expose `set_active_layer` (087, 089). 094 established the TimelinePanel multi-row layout. Build before 095 / 096 / 097 so the row-click handler exists when those slices add nested per-row buttons that must `stopPropagation` to avoid triggering activation.

## Scenarios addressed

- New Scenario 12 in PRD-086 (added in the same task batch).

## Out of scope

- Per-row keyboard navigation with `↑ / ↓` between rows — defer to a future a11y pass once delete / reorder / visibility are all in place (those slices introduce their own focusable controls and the full keyboard map is best designed together).
- Hover preview / drag-to-activate / right-click context menu — not in M3 scope.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/canvas-model.ts` | Added `set_active_layer(id)` to the `Document` interface with a doc comment describing the throws-on-unknown-id contract. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Added `setActiveLayer(id)` — early-returns on the same id (owns the no-op contract), otherwise calls `document.set_active_layer`, bumps `renderVersion`, and marks the doc dirty. Not undoable. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | 4 new tests: state mutation + `renderVersion` + `markDirty`, no-op on same id, not undoable, draw applies to newly active layer. |
| `src/lib/canvas/fake-drawing-ops.ts` | Throwing stub for `set_active_layer` to satisfy the `Document` interface in test fakes. |
| `src/lib/ui-editor/TimelinePanel.svelte` | Added `activeLayerId` and `onActivateLayer` props; row uses `role="button"` + `tabindex="0"` + `onclick`/`onkeydown` for Space/Enter activation; `:focus-visible` outline matches the existing `.add-btn` pattern (no new tokens). |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | 2 new tests: `onActivateLayer` invoked with the layer id on row click, Enter/Space keyboard activation. Existing tests updated for the new required prop. |
| `src/routes/editor/+page.svelte` | Wired `handleActivateLayer` → `editor.workspace.activeTab.setActiveLayer` and passed it to `TimelinePanel`. |
| `e2e/editor/layers.test.ts` | New E2E test: clicking a non-active row activates it, and undo afterward does not restore the previous active layer (selection is not in history). |

### Key Decisions

- **Idempotency owner is TabState, not the component.** The "click on the already-active row is a no-op" contract lives in `TabState.setActiveLayer` (early-return). The component always emits `onActivateLayer(id)`. This keeps the contract enforced even for programmatic callers (future shortcuts, command palette).
- **`role="button"` over `<button>`.** Upcoming sub-issues 095 (delete) and 097 (visibility) will add nested per-row controls; nested `<button>` is invalid HTML. The row uses `role="button"` + `tabindex="0"` + key handler instead.
- **Not undoable.** Matches Photoshop / Aseprite convention and the project's collapse-toggle precedent (099 / 100). The active-layer pointer still travels through history snapshots pushed by *other* operations (add / delete / reorder / draw), so undo restores the active layer that was correct at the time of the snapshot.

### Notes

- `:focus-visible` outline and `cursor: pointer` on `.row` are new visual states the keyboard-activation AC requires, but they reuse the existing `.add-btn:focus-visible` pattern and `--ds-*` tokens — no new design tokens. The active-row treatment (fill + accent bar) from 093 / 094 is unchanged.
- 095 / 097 will need to `stopPropagation` on nested per-row buttons (delete, visibility chevron) so they don't accidentally trigger row activation.
