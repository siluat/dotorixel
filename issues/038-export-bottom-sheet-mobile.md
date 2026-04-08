---
title: Mobile ExportBottomSheet — end-to-end mobile export UI
status: open
created: 2026-04-09
parent: 033-export-ui-web.md
---

## What to build

Build the `ExportBottomSheet` component for mobile using `vaul-svelte` for gesture handling. The sheet slides up from the bottom with a header ("Export"), format selector, filename input, and export button — the same controls as the desktop popover. Wire AppBar and SettingsContent export buttons to open the bottom sheet instead of triggering immediate download.

See parent PRD [033](033-export-ui-web.md) for interaction details and design reference [032](032-export-ui.md) for visual spec.

## Acceptance criteria

- `vaul-svelte` added as a dependency
- `ExportBottomSheet` component renders with header, format dropdown, filename input, and export button
- Sheet slides up from the bottom with smooth animation (vaul-svelte default)
- Tapping the overlay behind the sheet closes it
- Swiping the sheet down closes it
- Clicking the export button triggers download and closes the sheet
- AppBar and SettingsContent export buttons open the bottom sheet instead of immediate download
- Sheet reuses the same `availableFormats` registry and filename logic from 036

## Blocked by

- [036 — Export logic foundation](036-export-logic-foundation.md)

## Scenarios addressed

From parent PRD [033](033-export-ui-web.md):

- Scenario 9: Mobile tap → bottom sheet slides up
- Scenario 10: Swipe down → closes
- Scenario 11: Tap overlay → closes
