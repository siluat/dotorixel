---
title: "Apple native: StatusBar"
status: open
created: 2026-04-06
parent: 014-apple-native-docked-layout.md
---

## What to build

Implement the StatusBar panel, replacing the placeholder from the layout skeleton.

Layout (left to right):
- Left: Canvas dimensions (e.g., "32 × 32")
- Spacer
- Right: Active tool name (e.g., "Pencil")

Both values are derived from EditorState — canvas size from `pixelCanvas` and tool name from `activeTool`. This is a pure display view with no interactive elements.

## Acceptance criteria

- [ ] StatusBar displays canvas dimensions on the left
- [ ] StatusBar displays active tool name on the right
- [ ] Canvas dimensions update when canvas is resized
- [ ] Tool name updates when active tool changes

## Blocked by

- [015 — Design tokens + layout skeleton](015-apple-layout-skeleton.md)

## Scenarios addressed

- Scenario 1: User opens app → sees complete docked layout including status information
- Scenario 3: User selects a tool → StatusBar updates tool name
