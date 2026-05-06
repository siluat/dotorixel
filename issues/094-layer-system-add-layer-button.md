---
title: "Layer system: add-layer button"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the "+" button to the TimelinePanel that creates a new layer above the active one and selects it. Add Paraglide messages for the default layer name pattern in en/ko/ja.

Scope:

- "+" affordance in TimelinePanel, placed per the design (092).
- On click → calls `Document.add_layer`.
- The new layer's default name uses Paraglide messages: `Layer N` (en), `레이어 N` (ko), `レイヤー N` (ja). N comes from `nextLayerNumber`.
- The new layer becomes the active layer and gets a row in the panel.
- A snapshot is pushed so the action is undoable.

## Acceptance criteria

- Clicking "+" inserts a new layer directly above the previously active layer.
- The new layer becomes the active one (row highlighted).
- The new layer's default name follows `Layer N` / `레이어 N` / `レイヤー N` per current locale.
- `nextLayerNumber` increments on each add and never reuses numbers after a delete.
- The action is undoable.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 3.
