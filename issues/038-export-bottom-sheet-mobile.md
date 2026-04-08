---
title: Mobile ExportBottomSheet — end-to-end mobile export UI
status: done
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

## Results

| File | Description |
|------|-------------|
| `package.json` / `bun.lock` | Added `vaul-svelte@0.3.2` dependency |
| `src/lib/ui-editor/ExportBottomSheet.svelte` | New component — vaul-svelte Drawer with format selector, filename input, and export button |
| `src/routes/editor/+page.svelte` | Wired ExportBottomSheet in tabbed layout; AppBar/SettingsContent now toggle export UI |
| `src/lib/ui-editor/AppBar.svelte` | Export button aria-label changed from `action_exportPng` to `label_export` |
| `src/lib/ui-editor/SettingsContent.svelte` | Export button label changed from `action_exportPng` to `label_export` |

### Key Decisions

- **CSS `@keyframes` for open animation**: vaul-svelte's `data-vaul-drawer-visible` CSS transition does not work because bits-ui creates and removes elements via `{#if $open}` — the initial paint never occurs. Keyframe animations fire on element insertion regardless.
- **Local `drawerOpen` state decoupled from parent `open` prop**: `bind:open` on bits-ui's `DialogPrimitive.Root` immediately removes elements when `open` becomes false, cutting close animation short. The local state delays DOM removal by `CLOSE_ANIMATION_MS` (500ms) for user-gesture closes, allowing vaul-svelte's inline transition to play.
- **Parent-initiated close is instant (no animation)**: When the export confirm handler sets `open=false`, the drawer closes immediately. User attention is on the download, so the missing animation is not noticeable.
