---
title: "Apple native: design tokens + layout skeleton"
status: done
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

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Style/DesignTokens.swift` | Replaced PebbleTokens with DesignTokens matching web design-tokens.css |
| `apple/Dotorixel/Style/ToolButtonStyle.swift` | 44×44pt button style for toolbar (active state with accent color) |
| `apple/Dotorixel/Style/IconButtonStyle.swift` | Subtle icon button style for TopBar |
| `apple/Dotorixel/Views/TopBar.swift` | Top bar placeholder (44pt height, border bottom) |
| `apple/Dotorixel/Views/LeftToolbar.swift` | Left toolbar placeholder (44pt width, border right) |
| `apple/Dotorixel/Views/RightPanel.swift` | Right panel placeholder (220pt width, border left) |
| `apple/Dotorixel/Views/StatusBar.swift` | Status bar placeholder (28pt height, border top) |
| `apple/Dotorixel/ContentView.swift` | ZStack floating panels → VStack+HStack docked layout |
| `apple/Dotorixel/Rendering/PixelGridRenderer.swift` | Metal clear color updated to DesignTokens.bgBase |
| `apple/DotorixelTests/DesignTokensTests.swift` | 11 tests: color values match web, sizing matches PRD |
| `apple/project.yml` | Added test target, scheme, ad-hoc signing |
| `apple/src/lib.rs` | Fixed fit_to_viewport missing max_zoom parameter |

### Key Decisions
- Test target configured as hosted test (bundle inside app) to access DesignTokens symbols
- Metal clear color resolves from DesignTokens.bgBase at runtime instead of hardcoded RGB values
- StatusBar height set to 28pt (compact info bar; TopBar at 44pt for controls)

### Notes
- Pebble UI files deleted (7 files): FloatingPanel, PebbleButtonStyle, TopControlsLeft/Right, BottomToolsPanel, BottomColorPalette, PebbleSwatch
- `fit_to_viewport` in lib.rs had a pre-existing build error (missing 4th parameter); fixed by passing `f64::INFINITY`
- UniFFI `Color` type conflicts with `SwiftUI.Color` — explicit `SwiftUI.Color` disambiguation needed in several files
