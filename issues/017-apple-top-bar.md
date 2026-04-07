---
title: "Apple native: TopBar"
status: done
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

- IconButtonStyle implemented with hover/press visual states
- TopBar displays logo, zoom controls, grid toggle, and Export button
- Zoom −/+ buttons adjust canvas zoom level
- Zoom percentage label shows current zoom level
- Fit-to-view button fits canvas to the available area
- Grid toggle button toggles pixel grid visibility
- Export button is visible but disabled

## Blocked by

- [015 — Design tokens + layout skeleton](015-apple-layout-skeleton.md)

## Scenarios addressed

- Scenario 7: User uses zoom controls → canvas zoom changes, percentage updates
- Scenario 8: User toggles grid → pixel grid visibility toggles
- Scenario 9: User taps Export → nothing happens (disabled)

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Views/TopBar.swift` | Full TopBar implementation — logo, zoom controls group, grid toggle, Export button |
| `apple/Dotorixel/Style/IconButtonStyle.swift` | Added hover state via extracted `IconButtonBody` with `@State` + `.onHover` |
| `apple/Dotorixel/Style/DesignTokens.swift` | Added `fontSizeSm` (11pt) token |
| `apple/Dotorixel/ContentView.swift` | Hoisted `@Observable` reads outside `GeometryReader` to fix update propagation |
| `apple/Dotorixel/Assets.xcassets/Logo.imageset/` | App logo image set for TopBar identity |
| `apple/DotorixelTests/DesignTokensTests.swift` | Added `fontSizeSm` test |

### Key Decisions

- TopBar styling matches web's `TopBar.svelte` CSS rather than using `IconButtonStyle` for all buttons. Zoom controls use a grouped container with `ZoomButtonStyle`, grid toggle uses `GridToggleButtonStyle`, and Export is a filled accent button — each matching the web's distinct styling per element.
- Logo uses a dedicated `Logo.imageset` (copied from `apple-touch-icon.png`) rather than SF Symbols, matching the web's raster logo.

### Notes

- `@Observable` property reads inside `GeometryReader` closures don't reliably trigger SwiftUI view updates. Properties must be read at the parent view scope and captured into local bindings before passing into the `GeometryReader`. This fix in `ContentView` also resolves potential issues with `viewport` and `canvasVersion` updates.
- `ZoomButtonStyle` and `GridToggleButtonStyle` are `private` to `TopBar.swift` — they are TopBar-specific and not reusable elsewhere.
