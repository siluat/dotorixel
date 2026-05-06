---
title: "Layer system: mobile Timeline tab"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Surface the layer interface on mobile via a 4th BottomTabs entry labeled "Timeline". The tab itself is the toggle — there is no separate collapse control on mobile. Switching to another tab implicitly hides the panel.

Scope:

- Add a 4th tab "Timeline" to the mobile BottomTabs alongside the existing tabs.
- When active, the tab shows the mobile TimelinePanel variant from the design (092).
- The mobile variant exposes the same per-row controls (visibility, delete, reorder) wired in C2–C5, plus the add-layer affordance from C2.
- Paraglide message for the tab label in en/ko/ja.

## Acceptance criteria

- BottomTabs on mobile shows a 4th "Timeline" tab.
- Tapping the tab opens the mobile TimelinePanel variant.
- Tapping another tab implicitly hides the panel.
- All layer actions wired in C2–C5 work in the mobile variant.
- Tab label is localized in en/ko/ja.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Scenario 11.
