---
title: "Reference Layer: Restore original size inline action"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A single-click action on the active Reference Layer that resets the viewport-underlay placement to the source image's natural pixel dimensions (`scale = 1.0`) while preserving the current center point. The action is undoable.

Scope:

- Inline action wired to `placement.restore_to_natural(natural_width, natural_height)` -> `Document.set_reference_placement(id, new_placement)`.
- Pushes a single Document snapshot through `HistoryManager`.
- After a canvas resize, the action preserves the current placement center after the resize transform from 111.
- Visible only when the active layer is the singleton Reference Layer.
- The Reference row remains fixed at the bottom of the Timeline Panel; this action does not imply reorderability.
- Wording and a11y label via Paraglide.

## Acceptance Criteria

- Single click resets `scale = 1.0` while preserving the current center point.
- The viewport underlay and placement overlay update together.
- Action is visible only when the Reference Layer is active.
- Pushes a single Document snapshot; the change is undoable and redoable.
- After resizing the canvas, the action still preserves the current post-resize center.
- Pixel Layer rows do not show the action.

## Blocked By

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md)
- [106 — Reference Layer UX detail design](106-reference-layer-ux-design.md) must be read with the 2026-05-22 amendment.

## User Stories Addressed

- #12, #13.
