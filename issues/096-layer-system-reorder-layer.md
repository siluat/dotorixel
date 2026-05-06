---
title: "Layer system: layer reorder"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Allow the user to reorder layers — either by drag-and-drop on a row handle or by up/down buttons (final mechanism is whichever the design (092) settles on). The composite reflects the new depth order immediately.

Scope:

- Reorder affordance on each row per the design (092).
- On commit → calls `Document.reorder_layer(layer_id, new_index)`.
- The renderer composites in the new order on the next frame.
- A snapshot is pushed so the action is undoable.

## Acceptance criteria

- Layers can be reordered via the affordance from the design.
- The composite reflects the new depth order immediately after the action.
- Reordering does not change the active layer pointer.
- The action is undoable.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 5.
