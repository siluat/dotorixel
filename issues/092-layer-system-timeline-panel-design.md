---
title: "Layer system: TimelinePanel design — Candidate A detail pass"
status: ready-for-human
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Detail Candidate A (unified Layer × Frame timeline panel docked below the canvas) into a full pixel-level design in the project's `.pen` file. This slice is **HITL** — run the `/ui-design` flow.

Scope:

- Reference the existing comparison area in `docs/pencil-dotorixel.pen` (container ID `sTEPj`, position `x=-430, y=28063`) for context.
- Produce desktop expanded state (h=180) and collapsed state (h=32) — left-side layer sidebar (each row: visibility toggle + name + delete + reorder handle) and right-side frame area (one column or hidden in M3).
- Produce mobile variant (entered via the 4th BottomTabs tab "Timeline").
- All design tokens come from the existing token system; do not introduce new tokens unless required and approved during the design flow.
- M3 frame axis: render a single column placeholder or hide it altogether — pick one in the design and document the choice.
- Output: a finalized design block in `docs/pencil-dotorixel.pen` that downstream UI slices (C1–C5, D, E1–E2) can implement against.

## Acceptance criteria

- Desktop expanded state finalized (layer sidebar + frame area + chevron).
- Desktop collapsed state finalized (h=32 strip with chevron).
- Mobile variant finalized (entered via Timeline tab).
- Layer row controls finalized: visibility toggle, name area, delete affordance, reorder affordance.
- M3 frame-axis treatment chosen and documented in the `.pen`.
- Design uses existing tokens only (or new tokens are agreed during the flow).

## Blocked by

None — can start immediately, parallel to the A series.

## Scenarios addressed

- Visual specification for Scenarios 3, 4, 5, 7, 10, 11.
