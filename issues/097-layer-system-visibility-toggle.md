---
title: "Layer system: visibility toggle"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the per-row visibility toggle. When toggled off, the composite excludes that layer; when toggled on again, it reappears.

Scope:

- Visibility icon on each row per the design (092).
- On click → flips `Layer.visible` on the targeted layer.
- The composite skips layers with `visible === false`.
- The toggled state visually distinguishes hidden vs visible rows (per the design).
- Toggling is undoable.

## Acceptance criteria

- Each row has a visibility toggle.
- Toggling off hides that layer from the composite immediately.
- Toggling on restores it.
- Hidden vs visible rows are visually distinguishable in the panel.
- The action is undoable.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 7.
