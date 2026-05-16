---
title: "Reference Layer: Restore original size inline action"
status: needs-triage
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

A single-click action on the active Reference Layer that resets the placement to the source's natural pixel dimensions (`scale = 1.0`) while preserving the current center point. The action is undoable. Placement (on row vs. near placement overlay) is whatever the 106 design decided.

Scope:

- Inline action wired to `placement.restore_to_natural(natural_width, natural_height)` → `Document.set_reference_placement(id, new_placement)`.
- Pushes a single Document snapshot through `HistoryManager` (undoable / redoable).
- After a canvas resize: the action re-centers at the **current** canvas center (consistent with "center preserved" — the placement field already encodes the current center after the resize transform from 111).
- Visible only when the active layer is a Reference Layer.
- Wording and a11y label via Paraglide.

## Acceptance criteria

- Single click resets `scale = 1.0` while preserving the current center point.
- Action is visible only when the active layer is Reference.
- Pushes a single Document snapshot; the change is undoable and redoable.
- After resizing the canvas (which transforms the Reference Layer's placement per the 9-anchor rule) the action still recenters at the current canvas center.
- Pixel Layer rows do not show the action.

## Blocked by

- [113 — WASM facade + TS canvas-model interface](113-reference-layer-wasm-facade-and-ts-interface.md)
- [117 — Timeline Panel kind icons](117-reference-layer-timeline-panel-kind-icons.md)
- [106 — Reference Layer UX detail design](106-reference-layer-ux-design.md)

## User stories addressed

- #8, #9.
