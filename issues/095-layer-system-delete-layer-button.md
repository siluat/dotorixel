---
title: "Layer system: delete-layer button"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the per-row delete affordance. Removes the layer and reassigns the active pointer. The button is disabled when only one layer remains so users cannot empty the stack.

Scope:

- Delete affordance on each layer row, placed per the design (092).
- On click → calls `Document.remove_layer(layer_id)`.
- When the deleted layer was active, an adjacent layer becomes the new active.
- The button is **disabled** when `document.layers.length === 1`. The TS layer never invokes `remove_layer` in that state.
- A snapshot is pushed so the action is undoable.

## Acceptance criteria

- Each row has a delete affordance.
- Clicking delete removes that layer and the panel reflects the new stack immediately.
- Deleting the active layer reassigns active to an adjacent layer.
- When the stack has one layer, the delete affordance is disabled.
- The action is undoable (full stack restored on undo).

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 4.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | New `removeLayer(id: string)` method. Mirrors `addLayer` but with a last-layer guard at the TS boundary: when `layer_count === 1`, returns early before pushing a snapshot — keeps the UI's disabled-button contract honest from non-UI call paths (future keyboard shortcuts, programmatic calls) and avoids orphan undo snapshots. Core's `RemoveLastLayer` error remains the safety net below |
| `src/lib/canvas/canvas-model.ts` | `Document` structural interface gains `remove_layer(id)` with a doc comment describing throw conditions (layer not found / last-layer) and the active-pointer relocation behavior — keeps the compile-time WasmDocument compatibility check honest |
| `src/lib/canvas/fake-drawing-ops.ts` | `remove_layer` stub on the test fake (throws if invoked) so `Document` structural conformance holds even though no current consumer of the fake calls it |
| `src/lib/ui-editor/TimelinePanel.svelte` | Per-row `✕` remove button placed after the name (`.remove-btn`, `data-remove-layer` test seam, `aria-label` from Paraglide with name interpolation). `disabled` when `layers.length === 1`. **`stopPropagation` on click** so the button doesn't trigger row activation (104). Component now takes `onRemoveLayer: (id) => void`. Styles reuse the same `--ds-*` token set as `.add-btn` (24×24, `--ds-bg-hover`, `--ds-radius-sm`, etc.) — no new tokens |
| `src/routes/editor/+page.svelte` | New `handleRemoveLayer(id)` delegates to `tab.removeLayer(id)`. Wired onto `<TimelinePanel onRemoveLayer={handleRemoveLayer} />` |
| `messages/{en,ko,ja}.json` | New i18n key `aria_removeLayer` with `{name}` interpolation. Copy uses the UX-idiomatic verb in each language (`Delete {name}` / `{name} 삭제` / `{name}を削除`) — the key→copy verb split is deliberate; see Key Decisions |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Seven Vitest cases pin `removeLayer`'s contract: count delta, active pointer relocation on active-layer removal, active pointer unchanged on non-active removal, undoability (count + active restored), `renderVersion`/`markDirty` bump, last-layer no-op (count/active/renderVersion/markDirty all untouched), and that the last-layer no-op leaves the undo stack untouched (drawing → no-op remove → undo still reverts the draw) |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Four new component cases: remove affordance renders on every row; click invokes `onRemoveLayer(id)`; click does not also activate the row (stopPropagation contract); disabled at 1 layer / enabled at 2+. Existing tests updated to pass the new required prop via a `noopRemoveLayer` stub. One existing assertion changed from `row.textContent` to `row.querySelector('.name')?.textContent` because the row now contains the remove-button text |
| `e2e/editor/layers.test.ts` | Five new Playwright scenarios: disabled at 1 layer, removing the middle row leaves a clean stack, removing the active layer reassigns active to an adjacent row, clicking the remove button does NOT activate the row underneath (stopPropagation end-to-end), and undoable/redoable |

### Key Decisions

- **Last-layer guard lives in `TabState.removeLayer`, not in the component alone.** The component's `disabled` attribute already prevents the click, but adding the guard in `TabState` keeps the idempotency contract at the same boundary that 104 chose for `setActiveLayer` ("no-op when id === active"). It also protects non-UI call paths (future keyboard shortcut, programmatic call) from leaving an orphan snapshot on the undo stack — `pushSnapshot()` runs first in the non-guarded path, so a downstream throw would have left a single phantom undo step.
- **Developer surface uses `remove`, user-facing copy uses `Delete`/`삭제`/`削除`.** The codebase's `add_layer` pattern keeps one verb across all 4 layers (WASM → TabState → prop → handler → aria copy). The `remove` side initially had `onDeleteLayer`/`handleDeleteLayer`/`data-delete-layer`/`aria_deleteLayer` while TabState was `removeLayer`, which violated CLAUDE.md's "consistent domain vocabulary." Normalized all developer-facing identifiers to `remove` (function/prop/handler/seam/CSS class/i18n key). The aria copy stayed as the UX-idiomatic verb because Aseprite/Photoshop/GIMP all use "Delete Layer" and Korean/Japanese UI consistently uses 삭제/削除, not 제거/除去. The i18n key↔copy verb split is intentional.
- **No new design tokens.** Disabled-state opacity is a single-use `0.35` inline literal — promoting to a global `--ds-opacity-disabled` token is deferred until reuse is confirmed across components (per CLAUDE.md).

### Notes

- **Test description verb tracks the developer-side verb.** Following 094's precedent ("add-layer button" in test names), all 095 test descriptions say "remove button" / "remove affordance" rather than mirroring the user-facing "Delete" — keeps internal naming consistent within the test file.
- **PRD 086 stays open.** After 095, remaining sub-issues: 096 (reorder), 097 (visibility), 098 (mobile tab), 099 (collapsible chevron), 100 (collapsed-flag persistence). 095 unblocks all of them in the sense that the multi-layer panel + per-row affordance pattern is now established; 097's per-row visibility chevron must follow the same `stopPropagation` rule that 095 locked in.
- **Tests**: full `bun run vitest run` (909 passed), `bun run check` (0/0), and `bunx playwright test e2e/editor/layers.test.ts` (9/9) all green.
