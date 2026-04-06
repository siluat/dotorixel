---
title: "Apple native: design tokens + layout skeleton"
status: open
created: 2026-04-06
parent: 014-apple-native-docked-layout.md
---

## What to build

Replace the Pebble UI floating panel structure with a docked layout skeleton. This is the tracer bullet for the entire layout transition — it proves the new VStack+HStack structure works and the app launches with the correct visual foundation.

Three things happen in this slice:

1. **Design tokens**: Replace `PebbleTokens` with a new token set mirroring the web's `design-tokens.css` (see parent PRD "Design tokens" section).
2. **Layout skeleton**: Restructure ContentView from ZStack (floating panels) to VStack+HStack (docked regions). TopBar, LeftToolbar, RightPanel, and StatusBar are placeholder views with correct sizing (see parent PRD "Layout structure" section).
3. **Cleanup**: Delete all Pebble UI files (FloatingPanel, PebbleButtonStyle, TopControlsLeft, TopControlsRight, BottomToolsPanel, BottomColorPalette, PebbleSwatch). Update Metal clear color to the new bgBase token.

After this slice, the app launches with the docked structure. The canvas is functional (default pencil tool), but panel areas are empty placeholders.

## Acceptance criteria

- [ ] ContentView uses VStack+HStack layout with 4 named regions (TopBar, LeftToolbar, RightPanel, StatusBar) surrounding a central canvas area
- [ ] LeftToolbar placeholder has 44pt fixed width
- [ ] RightPanel placeholder has 220pt fixed width
- [ ] TopBar and StatusBar have fixed heights
- [ ] Canvas area fills remaining space and PixelCanvasView renders correctly
- [ ] New DesignTokens replace PebbleTokens with web-aligned token values
- [ ] Metal clear color uses the new bgBase value
- [ ] All Pebble UI files are deleted (FloatingPanel.swift, PebbleButtonStyle.swift, TopControlsLeft.swift, TopControlsRight.swift, BottomToolsPanel.swift, BottomColorPalette.swift, PebbleSwatch.swift)
- [ ] App builds and launches on Mac (960x640) and iPad simulator (landscape)
- [ ] Drawing on canvas works with default pencil tool

## Blocked by

None — can start immediately.

## Scenarios addressed

- Scenario 1: User opens app on Mac → sees docked layout
- Scenario 2: User opens app on iPad landscape → sees docked layout
- Scenario 10: User resizes Mac window → canvas area flexes, panels stay fixed
