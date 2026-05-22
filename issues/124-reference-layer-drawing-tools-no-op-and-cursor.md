---
title: "Reference Layer: drawing tools silently no-op + `not-allowed` cursor"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

When the singleton Reference Layer is active and a drawing tool (pencil, brush, eraser, bucket, shape, move) is selected, the tool runner silently no-ops at the tool layer, and the canvas cursor switches to `not-allowed` on desktop. No toast, no dimmed tool buttons.

The Reference Layer is a viewport underlay, not a drawing surface. Pixel mutation APIs must continue to target Pixel Layers only.

Scope:

- TS tool runner translates the `LayerKindMismatch` or "no pixels mutated" response from the Document into a silent no-op.
- No error toast, no console error, no stray pixel.
- Canvas cursor switches to `not-allowed` while a drawing tool is selected and the active layer is Reference.
- Tool buttons remain enabled; switching active back to a Pixel Layer makes the selected tool immediately usable.
- Mobile/touch: no cursor feedback. The active Reference overlay plus Timeline kind icon are the indicators.
- Non-drawing tools are governed by 125.

## Acceptance Criteria

- With Reference active, clicking/dragging any drawing tool over the canvas produces no pixel mutation and no error toast.
- The canvas cursor is `not-allowed` while a drawing tool is selected and Reference is active.
- Switching active back to a Pixel Layer restores the normal cursor and normal behavior on the next pointer event.
- Tool buttons are not dimmed or disabled.
- Mobile devices show no cursor-specific behavior, but overlay + kind icon remain visible.
- TS Vitest on `tool-runner` or equivalent asserts Reference-active drawing produces no pixel mutation and no surfaced error.

## Blocked By

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md)
- [120 — placement overlay shell](120-reference-layer-placement-overlay-shell.md)

## User Stories Addressed

- #16.
