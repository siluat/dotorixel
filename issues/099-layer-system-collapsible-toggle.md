---
title: "Layer system: collapsible chevron (no persistence)"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the desktop chevron that toggles the TimelinePanel between expanded (h=180) and collapsed (h=32). State lives in the runtime only — a page refresh resets to the default (expanded). Persistence is added in the next slice (E2).

Scope:

- Chevron control in the panel's top-right per the design (092).
- Click toggles the panel height between expanded and collapsed states.
- Collapsed state visually summarizes the panel without exposing per-row controls.
- Mobile is not affected — the mobile entry remains the BottomTabs Timeline tab from D.

## Acceptance criteria

- Chevron toggles between expanded (h=180) and collapsed (h=32).
- Default state on first load is expanded.
- Page refresh resets to expanded (no persistence yet).
- The chevron icon orientation reflects the current state.
- Mobile layout is unaffected.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Partial coverage of Scenario 10 (toggle works; persistence in E2).
