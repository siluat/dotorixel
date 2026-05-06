---
title: "Layer system: delete-layer button"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the per-row delete affordance. Removes the layer and reassigns the active pointer. The button is disabled when only one layer remains so users cannot empty the stack.

Scope:

- Delete affordance on each layer row, placed per the design (092).
- On click → calls `Document.remove_layer(layer_id)`.
- When the deleted layer was active, an adjacent layer becomes the new active.
- The button is **disabled** when `document.layers.length === 1`. The TS layer never invokes `remove_layer` in that state.
- A snapshot is pushed so the action is undoable.

## Acceptance criteria

- Each row has a delete affordance.
- Clicking delete removes that layer and the panel reflects the new stack immediately.
- Deleting the active layer reassigns active to an adjacent layer.
- When the stack has one layer, the delete affordance is disabled.
- The action is undoable (full stack restored on undo).

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 4.
