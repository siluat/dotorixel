---
title: "Layer system: visibility toggle"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the per-row visibility toggle. When toggled off, the composite excludes that layer; when toggled on again, it reappears.

Scope:

- Visibility icon on each row per the design (092).
- On click → flips `Layer.visible` on the targeted layer.
- The composite skips layers with `visible === false`.
- The toggled state visually distinguishes hidden vs visible rows (per the design).
- Toggling is undoable.

## Acceptance criteria

- Each row has a visibility toggle.
- Toggling off hides that layer from the composite immediately.
- Toggling on restores it.
- Hidden vs visible rows are visually distinguishable in the panel.
- The action is undoable.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 7.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | Add `set_layer_visibility(id, visible)` mutator + 2 unit tests (flip flag, unknown id → `LayerError::LayerNotFound`). Active-layer pointer preserved. |
| `wasm/src/lib.rs` | Bind `Document::set_layer_visibility(id: String, visible: bool)` through the WASM facade. |
| `src/lib/canvas/canvas-model.ts` | Add `set_layer_visibility` to the `DocumentLike` interface. |
| `src/lib/canvas/fake-drawing-ops.ts` | Stub `set_layer_visibility` on the fake document so unrelated tests fail loudly if they accidentally invoke it. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Add `setLayerVisibility(id, visible)` method: pushes snapshot, mutates Document, bumps `renderVersion`, marks dirty. No-op idempotency guard (matches `setActiveLayer` pattern) — same `visible` value → no snapshot, no version bump, no dirty mark. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | 7 new tests covering flip, restore, isolation, render/dirty signal, undoability, and both idempotency paths. |
| `src/lib/ui-editor/TimelinePanel.svelte` | Extend `LayerSummary` with optional `visible`. Add `onToggleLayerVisibility` prop. Per-row toggle button (`◉`/`◎`) with `stopPropagation` on click and Enter/Space, `aria-pressed` + dynamic `aria-label`. Hidden rows get `.row--hidden` styling (italic name, 0.45 opacity). |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | 6 new tests: render toggle per row, click→callback in both directions, `stopPropagation` on click + keyboard, `aria-pressed` reflects state, `.row--hidden` class applied. |
| `src/routes/editor/+page.svelte` | Surface `visible` in the `layers` derived list; wire `onToggleLayerVisibility` → `tab.setLayerVisibility`. |
| `messages/{en,ko,ja}.json` | New keys `aria_hideLayer` / `aria_showLayer` with `{name}` placeholder. |

### Key Decisions

- **Setter, not toggler.** Chose `setLayerVisibility(id, visible)` over `toggleLayerVisibility(id)` so the call site declares the desired state. This (a) lets the no-op guard compare current vs. requested without re-reading, (b) parallels the existing `setActiveLayer` API shape, and (c) makes the WASM contract testable without round-tripping through the current state.
- **No-op idempotency at the TabState boundary.** Reapplying the current `visible` value short-circuits before `pushSnapshot` / `renderVersion++` / `markDirty`. Locked in by the dedicated "no orphan snapshot" test, mirrors `setActiveLayer`'s pattern from 104.
- **Unicode glyphs `◉`/`◎`.** Match the existing per-row glyph language (`+` / `✕` / `≡`) — no new icon dependency, no new sprite sheet.
- **`visible` made optional on `LayerSummary`.** Avoids churning ~50 inline layer-shape objects in existing tests; the panel falls back to `visible ?? true`.

### Notes

- The 092 design spec does not yet specify the hidden-row style. Italic name + `opacity: 0.45` is an interim choice that visually distinguishes the row without changing layout; revisit when the design pass lands.
- The 24×24 toggle button matches the existing `remove-btn` / `reorder-handle` touch target — still below the `web-styling.md` ≥44px rule. This is a panel-wide concern (every per-row button), not a regression introduced here; flag for a follow-up pass on TimelinePanel row affordances.
- End-to-end verified via agent-browser: drew on Layer 2, toggled hide → composite delta of 2313 pixels confirmed, undo restored visibility and toggle glyph. `aria-pressed` and `aria-label` swap as expected; `row--hidden` class applies on hidden rows.
