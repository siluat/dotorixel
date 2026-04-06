---
title: "Apple native: TopBar"
status: open
created: 2026-04-06
parent: 014-apple-native-docked-layout.md
---

## What to build

Implement the TopBar panel with app identity, zoom controls, grid toggle, and export button, replacing the placeholder from the layout skeleton.

Layout (left to right):
- Left: App logo/icon
- Right: Zoom out (−), zoom percentage label, zoom in (+), fit-to-view, grid toggle, Export button (disabled)

Requires a new `IconButtonStyle` ButtonStyle — no background, hover/press state with subtle background (see parent PRD "Button styles" section).

Zoom state and grid toggle are already in EditorState (`zoomPercent`, `showGrid`, `handleZoomIn/Out/Fit`). Export button is rendered but disabled — enabling it is a separate Phase 1 task.

## Acceptance criteria

- [ ] IconButtonStyle implemented with hover/press visual states
- [ ] TopBar displays logo, zoom controls, grid toggle, and Export button
- [ ] Zoom −/+ buttons adjust canvas zoom level
- [ ] Zoom percentage label shows current zoom level
- [ ] Fit-to-view button fits canvas to the available area
- [ ] Grid toggle button toggles pixel grid visibility
- [ ] Export button is visible but disabled

## Blocked by

- [015 — Design tokens + layout skeleton](015-apple-layout-skeleton.md)

## Scenarios addressed

- Scenario 7: User uses zoom controls → canvas zoom changes, percentage updates
- Scenario 8: User toggles grid → pixel grid visibility toggles
- Scenario 9: User taps Export → nothing happens (disabled)
