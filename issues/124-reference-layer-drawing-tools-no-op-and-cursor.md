---
title: "Reference Layer: drawing tools silently no-op + `not-allowed` cursor"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

When the active layer is a Reference Layer and a drawing tool (pencil, brush, eraser, bucket, shape, move) is selected, the tool runner silently no-ops at the tool layer, and the canvas cursor switches to `not-allowed` (⊘). No toast, no dimmed tool buttons.

Scope:

- TS tool runner translates the `LayerKindMismatch` (or "no pixels mutated") response from the WASM Document into a silent no-op. No error toast, no console error, no stray pixel.
- Canvas cursor switches to `not-allowed` while a drawing tool is selected AND the active layer is Reference.
- Tool buttons remain immediately usable (no disabled state) — the user can switch active to a Pixel Layer at any moment and the tool button just works.
- Mobile / touch: no cursor feedback. The active Reference Layer's overlay (always visible from 120) plus the kind icon in the Timeline Panel (from 117) serve as the indicator.
- Non-drawing tools (eyedropper, sampling) are governed by 125 (different path).

## Acceptance criteria

- With a Reference Layer active, clicking-and-dragging any drawing tool over the canvas produces no pixel mutation and no error toast.
- The canvas cursor reads as `not-allowed` while a drawing tool is selected and the active layer is Reference.
- Switching active back to a Pixel Layer immediately restores the tool's normal cursor and normal behavior on the next pointer event.
- Tool buttons (toolbar) are not dimmed or disabled.
- Mobile devices: cursor feedback is absent (no cursor on touch), but the overlay + kind icon are still visible.
- TS Vitest on `tool-runner` (or equivalent) asserts: with a Reference Layer active, no pixel mutation occurs and no error is surfaced.

## Blocked by

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md)

## User stories addressed

- #13, #27.
