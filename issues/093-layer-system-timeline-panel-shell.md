---
title: "Layer system: TimelinePanel shell — desktop, single-layer row"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Mount the TimelinePanel in the desktop layout below the canvas. The panel renders the Document's layer stack as rows but exposes **no actions yet** — no add, delete, reorder, or visibility toggle. Only the active layer's name is shown for each row (a single row in practice, since the Document still starts with one layer).

This slice establishes the structural seat that the subsequent C2–C5 slices fill in.

Scope:

- New file `src/lib/ui-editor/TimelinePanel.svelte` (or equivalent location aligned with the existing layout).
- Mount the panel in the desktop layout below the canvas, matching the placement and dimensions defined by the design (092).
- Read `tabState.document.layers` and render one row per layer with the layer name.
- Highlight the active layer.
- Mobile layout is **not** affected by this slice.

## Acceptance criteria

- TimelinePanel renders below the canvas on desktop.
- Each layer in `document.layers` becomes a row showing the layer name.
- The active layer row has a visual highlight.
- No actions (add/delete/reorder/visibility) are wired yet.
- Mobile layout is unchanged.

## Blocked by

- [091 — TabState switch: `pixelCanvas` → `document`](091-layer-system-tab-state-document-switch.md)
- [092 — TimelinePanel design](092-layer-system-timeline-panel-design.md)

## Scenarios addressed

- Structural seat for Scenarios 3, 4, 5, 7.
