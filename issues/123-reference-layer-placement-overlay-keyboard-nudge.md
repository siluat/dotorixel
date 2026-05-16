---
title: "Reference Layer: keyboard nudge for placement"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Arrow-key translation of the active Reference Layer's placement. `↑ ↓ ← →` nudge by 1 pixel; `Shift + arrow` nudge by 10 pixels. Each nudge pushes a separate Document snapshot — nudges are **not** coalesced.

Scope:

- Focus rule: active layer must be a Reference Layer, and focus must be on the canvas / overlay (not on the Timeline Panel or other UI).
- Key bindings:
  - `↑ ↓ ← →` — translate placement by 1 pixel in the respective direction.
  - `Shift + ↑ ↓ ← →` — translate by 10 pixels.
- Per-key commit: each fire pushes one snapshot via `set_reference_placement`. Auto-repeat fires multiple snapshots (one per repeat event).
- Does not affect Pixel Layers.
- Does not affect drag-in-progress (no overlap with 121's drag preview).

## Acceptance criteria

- With a Reference Layer active and canvas focused, arrow keys translate placement by 1 pixel per fire.
- With Shift held, arrow keys translate by 10 pixels per fire.
- Each fire pushes a single snapshot (verified with consecutive nudges → undo step count matches the number of nudges).
- With a Pixel Layer active, the arrow keys retain whatever existing behavior they have (no Reference-style translation).
- Focus on a non-canvas / non-overlay element (e.g., a Timeline Panel input) does not trigger the nudge.

## Blocked by

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md)
- [120 — placement overlay shell](120-reference-layer-placement-overlay-shell.md)

## User stories addressed

- #25, #9.
