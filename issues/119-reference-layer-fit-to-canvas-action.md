---
title: "Reference Layer: Fit to canvas inline action"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A single-click action on the active Reference Layer that aspect-fits the viewport-underlay placement inside the current canvas and centers it. The action is undoable.

Scope:

- Inline action wired to `ReferencePlacement::fit_to_canvas(canvas_width, canvas_height, natural_width, natural_height)` -> `Document.set_reference_placement(id, new_placement)`.
- The fit allows upscaling smaller sources; the action means "fit this reference to the canvas", not "only shrink oversized references".
- Pushes a single Document snapshot through `HistoryManager`.
- After a canvas resize, the action uses the current post-resize canvas dimensions.
- Visible only when the active layer is the singleton Reference Layer.
- The Reference row remains fixed at the bottom of the Timeline Panel; this action does not imply reorderability.
- Wording and a11y label via Paraglide.

## Acceptance Criteria

- Single click sets `scale = min(canvas_width / natural_width, canvas_height / natural_height)` and centers the projected source footprint in the current canvas.
- Smaller sources are enlarged when needed to fit the canvas.
- The viewport underlay and placement overlay update together.
- Action is visible only when the Reference Layer is active.
- Pushes a single Document snapshot; the change is undoable and redoable.
- After resizing the canvas, the action fits to the new canvas dimensions.
- Pixel Layer rows do not show the action.

## Blocked By

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md)
- [106 — Reference Layer UX detail design](106-reference-layer-ux-design.md) must be read with the 2026-05-22 amendment.

## User Stories Addressed

- #12, #13.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/reference_placement.rs` | Replaced the prior natural-size reset builder with `fit_to_canvas`, which computes an aspect-preserving centered placement and allows upscaling. |
| `wasm/src/lib.rs` | Exposed the fit calculation through the WASM facade for the web shell. |
| `src/lib/canvas/wasm-backend.ts` | Added the web adapter helper that returns a structural `ReferencePlacement` from the WASM fit calculation. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Added the undoable Reference Layer fit action using the current document dimensions and source dimensions. |
| `src/lib/ui-editor/TimelinePanel.svelte` | Added the active Reference row fit-to-canvas icon action and wired it through the editor page. |
| `messages/en.json`, `messages/ko.json`, `messages/ja.json` | Added localized a11y labels for the row action. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts`, `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Covered fitting behavior, undo/redo, resize-aware dimensions, visibility gating, and row-click isolation. |

### Key Decisions

- Replaced the lower-value "Restore original size" action with "Fit to canvas" because fitting to the current canvas is the more useful recovery baseline for Reference Layer placement.
- Kept initial import placement capped at natural size for small sources, while the explicit row action allows upscaling to fill the canvas.

### Notes

- Placement overlay work remains in the next slice; this action updates the viewport underlay placement now and will share the same placement state with the overlay once it lands.
