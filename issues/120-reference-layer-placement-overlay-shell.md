---
title: "Reference Layer: placement overlay shell — read-only render"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A viewport overlay that renders the active Reference Layer's placement rectangle and four corner handles. Read-only — no interaction yet. Drag-to-move, drag-to-scale, Shift-snap, and keyboard nudge land in subsequent slices.

Scope:

- New component (Svelte) layered over the canvas viewport.
- Visible only when the active layer is a Reference Layer.
- Renders:
  - Placement rectangle (outline) computed from `Document.layer_placement_at(active_index)` and the source's natural dimensions.
  - Four corner handles at the rectangle's corners.
- **Screen-space sizing.** Handles are a constant pixel size regardless of canvas zoom. Visual size: ~12px (desktop), ~16px (touch). The `pointerType === 'touch'` signal (from existing PointerEvents infrastructure) determines which sizing applies.
- No pointer interaction yet (handles do nothing on click).
- Subscribes to `tab.renderVersion` so the overlay re-renders on Document mutations.
- Edge-midpoint handles are intentionally absent — placement is uniform-scale only.

## Acceptance criteria

- Overlay appears when the active layer is a Reference Layer; disappears when active switches to a Pixel Layer (or no layer is active).
- The overlay rectangle exactly traces the source's projected footprint (matches what `composite()` renders).
- Handles render at the four corners at a constant on-screen pixel size as the user zooms the canvas in and out.
- Desktop pointer renders ~12px handles; touch pointer renders ~16px handles.
- No interaction yet — clicks on the overlay or handles produce no document mutation.

## Blocked by

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [106 — Reference Layer UX detail design](106-reference-layer-ux-design.md)

## User stories addressed

- Visual feedback for #13, #27.
