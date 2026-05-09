---
title: "Layer system: add-layer button"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the "+" button to the TimelinePanel that creates a new layer above the active one and selects it. Add Paraglide messages for the default layer name pattern in en/ko/ja.

Scope:

- "+" affordance in TimelinePanel, placed per the design (092).
- On click → calls `Document.add_layer`.
- The new layer's default name uses Paraglide messages: `Layer N` (en), `레이어 N` (ko), `レイヤー N` (ja). N comes from `nextLayerNumber`.
- The new layer becomes the active layer and gets a row in the panel.
- A snapshot is pushed so the action is undoable.
- **TimelinePanel renders front-most (z-top) layer at the top row** — matching the Aseprite/Photoshop convention. The core stack is bottom-to-top (`layers[0]` = z-bottom, `layers[N-1]` = z-top); the panel iterates in reverse so the canvas z-order and the panel order are visually consistent from the first layer onward.

## Acceptance criteria

- Clicking "+" inserts a new layer directly above the previously active layer in z-order, which means it appears **immediately above the active row in the panel**.
- The new layer becomes the active one (row highlighted).
- The new layer's default name follows `Layer N` / `레이어 N` / `レイヤー N` per current locale.
- `nextLayerNumber` increments on each add and never reuses numbers after a delete.
- The action is undoable.
- The TimelinePanel's top-to-bottom row order reflects canvas z-order from front to back (top row = front-most layer).

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 3.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | New `addLayer(name: string)` method: pushes a snapshot, calls `document.add_layer(crypto.randomUUID(), name)`, bumps `renderVersion`, and marks the doc dirty. UUID generation stays on the TS side per the project's identifier policy |
| `src/lib/canvas/canvas-model.ts` | `Document` structural interface gains `add_layer(new_id, name)` with a doc comment describing the throw conditions (invalid UUID / duplicate id) — keeps the compile-time `expectTypeOf<WasmDocument>().toMatchTypeOf<Document>()` check honest |
| `src/lib/ui-editor/TimelinePanel.svelte` | Header gains a `+` button (24×24, `data-add-layer` test seam, `aria-label` from Paraglide). Existing `header-label`'s redundant horizontal padding removed in favor of the header's `gap: --ds-space-2`. New `.add-btn` styles use only `--ds-*` tokens (`--ds-bg-hover`, `--ds-accent`, `--ds-radius-sm`, `--ds-text-secondary/primary`, `--ds-border-width-thick`). Component now takes `onAddLayer: () => void` callback prop |
| `src/routes/editor/+page.svelte` | `activeLayerId` and `layers` deriveds now read `tab.renderVersion` so they re-run on Document mutations (Document is a WASM handle and doesn't trigger Svelte reactivity on its own — comment added on the first use). `layers` now iterates the stack in reverse (`count-1 → 0`) so the panel's top row is z-top, matching Aseprite/Photoshop. New `handleAddLayer()` reads `next_layer_number()` from the doc, formats the localized default name via `m.layer_default_name({ n })`, and dispatches to `tab.addLayer(...)`. Wired onto `<TimelinePanel onAddLayer={handleAddLayer} />` |
| `messages/{en,ko,ja}.json` | New i18n keys: `layer_default_name` (`Layer {n}` / `레이어 {n}` / `レイヤー {n}`), `layer_panel_title` (`Layers` / `레이어` / `レイヤー`), `aria_addLayer` (camelCase under the existing `aria_*` family). The previous hard-coded `"Layers"` aria-label and header label both consume `m.layer_panel_title()` now |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Six Vitest cases pin `addLayer`'s contract: layer count delta, active pointer change, name passed through, monotonic `next_layer_number` across two adds, undoability (count + active restored), and `renderVersion`/`markDirty` bump |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Two new component cases: `+` button is rendered as a `<button>` with `data-add-layer`; clicking it invokes `onAddLayer`. Existing tests updated to pass the new required prop via a `noopAddLayer` stub |
| `e2e/editor/layers.test.ts` | New Playwright spec (3 scenarios): add appends an active row at the panel's top with the localized name; counter advances monotonically (`Layer 4 / 3 / 2 / 1` after three clicks); add is undoable + redoable through the existing history fixture |
| `issues/094-layer-system-add-layer-button.md` | Scope and acceptance criteria amended to lock the panel-order-vs-stack-order convention (panel top = z-top, core stack `[0]` = z-bottom) before 094 ships, so future slices don't have to re-litigate it |
| `issues/096-layer-system-reorder-layer.md` | Added a note that reorder must translate visual index → stack index (`stack_idx = (count - 1) - visual_idx`) and asserted "drag up = forward in z" as an acceptance criterion, so the upcoming reorder slice picks up the convention 094 established |

### Key Decisions

- **Panel order reversal landed in 094, not deferred to 096.** First proposal was to defer panel-order convention (top row = z-top) to 096. User overrode: convention should be correct from the first slice that surfaces multi-layer order. Net cost was small (a single reverse loop in `+page.svelte`'s `layers` derived) and protects 095/096/097 from inheriting the wrong convention.
- **UUID generated TS-side via `crypto.randomUUID()`.** Matches PRD 086's identifier policy ("Layer IDs are UUID v4 generated on the TS side ... avoids adding a UUID-generation dependency to the Rust core"). `addLayer` accepts only the display name; the id is an implementation detail.
- **Default name formatting at the call site, not inside `addLayer`.** `+page.svelte:handleAddLayer()` reads `next_layer_number()` and formats via Paraglide before calling `tab.addLayer(name)`. Keeps `tab-state` free of i18n imports — same separation `addTab` and other mutators already follow.
- **Renderer subscription via `void tab.renderVersion`.** Document is a WASM handle, so Svelte reactivity doesn't see its method calls. The page-level deriveds touch `tab.renderVersion` (bumped inside `addLayer`) to force a re-run on internal mutations. One comment on the first occurrence; second occurrence omits the redundant note.
- **Pre-existing `header-label` horizontal padding removed.** With the `+` button claiming the header's left side, the label's `padding: 0 --ds-space-3` would have stacked redundantly with the new `header { gap: --ds-space-2 }`. Removed the inner padding so the header relies solely on its own gap/padding tokens.

### Notes

- **Persistence still on V2 schema** — adding a layer mutates the in-memory Document only; new layers are not yet round-tripped through IndexedDB. Issue 091's notes already flagged "switching the on-disk format to V3 is a future task." No PRD-086 sub-issue currently owns multi-layer pixel persistence (only 100 owns the `timelinePanelCollapsed` flag); a follow-up issue is needed before shipping.
- **PRD 086 stays open.** Remaining sub-issues: 095 (delete), 096 (reorder), 097 (visibility), 098 (mobile tab), 099 (collapsible chevron), 100 (collapsed-flag persistence). 094 unblocks 095/096/097 (they all need a panel with multiple layers to be useful).
- **Tests**: full `bun run test` and `bun run check` green; Playwright spec verified against the running dev server at `/en/editor`.
