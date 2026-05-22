---
title: "Reference Layer: keyboard nudge for placement"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Arrow-key translation of the active singleton Reference Layer's placement. `Up/Down/Left/Right` nudge by 1 pixel; `Shift + arrow` nudge by 10 pixels. Each nudge pushes a separate Document snapshot; nudges are not coalesced.

Scope:

- Focus rule: active layer must be Reference, and focus must be on the canvas / overlay, not the Timeline Panel or another UI control.
- Key bindings:
  - `Up/Down/Left/Right`: translate placement by 1 pixel.
  - `Shift + Up/Down/Left/Right`: translate by 10 pixels.
- Per-key commit: each fire pushes one snapshot via `set_reference_placement`.
- Auto-repeat fires multiple snapshots, one per repeat event.
- Does not affect Pixel Layers.
- Does not affect drag-in-progress from 121.
- Updates the viewport underlay and overlay together.

## Acceptance Criteria

- With Reference active and canvas focused, arrow keys translate placement by 1 pixel per fire.
- With Shift held, arrow keys translate by 10 pixels per fire.
- Each fire pushes one snapshot; undo step count matches the number of nudges.
- With a Pixel Layer active, arrow keys retain existing behavior and do not translate Reference.
- Focus on a non-canvas / non-overlay element does not trigger the nudge.
- The Reference underlay and overlay remain aligned after each nudge.

## Blocked By

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md)
- [120 — placement overlay shell](120-reference-layer-placement-overlay-shell.md)

## User Stories Addressed

- #20, #13.
