---
title: Desktop ExportPopover — end-to-end desktop export UI
status: done
created: 2026-04-09
parent: 033-export-ui-web.md
---

## What to build

Build the `ExportPopover` component that appears below the Export button on desktop/iPad. It contains a format selector dropdown (reading `availableFormats`), a filename text input with a placeholder default, and an "Export {format}" confirmation button. Wire TopBar and TopControlsRight export buttons to toggle the popover instead of triggering immediate download. Add a `clickOutside` Svelte action for dismiss behavior and an active visual state on the Export button while the popover is open.

See parent PRD [033](033-export-ui-web.md) for interaction details and design reference [032](032-export-ui.md) for visual spec.

## Acceptance criteria

- `ExportPopover` component renders format dropdown, filename input, and export button
- Format dropdown reads `availableFormats` array — shows only implemented formats
- Filename input shows `dotorixel-{width}x{height}` as placeholder, no initial value
- Confirmation button label shows "Export {format}" using parameterized i18n key `action_exportFormat`
- Selecting a different format updates the button label
- Clicking the confirmation button triggers download with correct filename and format, then closes the popover
- Clicking outside the popover closes it (via `clickOutside` Svelte action)
- Pressing ESC closes the popover
- Re-clicking the Export button toggles the popover closed
- Export button in TopBar shows active/pressed state (darker accent) while popover is open
- TopBar and TopControlsRight export buttons open the popover instead of immediate download
- i18n: `action_exportFormat({ format })` key added to all locale files (en, ko, ja)

## Blocked by

- [036 — Export logic foundation](036-export-logic-foundation.md)

## Scenarios addressed

From parent PRD [033](033-export-ui-web.md):

- Scenario 1: Desktop click → popover appears
- Scenario 5: Click outside → closes
- Scenario 6: ESC → closes
- Scenario 7: Re-click Export → toggles closed
- Scenario 8: Click export button → downloads + closes
- Scenario 14: Select SVG → button updates to "Export SVG"
- Scenario 15: Export button shows active state

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/ExportPopover.svelte` | New component — format dropdown, filename input, export confirm button |
| `src/lib/click-outside.ts` | New Svelte action for outside-click dismiss with element exclusion |
| `src/lib/click-outside.test.ts` | 4 tests — outside click, inside click, excluded element, destroy cleanup |
| `src/lib/canvas/export.ts` | Added `generateDefaultStem()` to eliminate placeholder/fallback duplication |
| `src/lib/ui-editor/TopBar.svelte` | Popover rendering, active state (#8A5D20), `isExportOpen` / `onExportToggle` / `onExportConfirm` props |
| `src/lib/ui-editor/TopBar.stories.svelte` | Updated to match new TopBar props |
| `src/lib/ui-editor/TopControlsRight.svelte` | Export button tooltip changed from `action_exportPng` to `label_export` |
| `src/routes/editor/+page.svelte` | `handleExportConfirm` with strip → build → export → analytics → close flow |
| `messages/{en,ko,ja}.json` | Added `action_exportFormat`, `label_format`, `label_filename` keys |
| `CLAUDE.md` | Added `happy-dom` to Tech Stack table |

### Key Decisions
- `clickOutside` uses `pointerdown` (not `click`) for immediate dismiss response
- ExportPopover is conditionally rendered (`{#if}`) so component destruction resets filename state on each open (scenario 12)
- Native `<select>` with `appearance: none` + custom chevron icon for accessible format dropdown
- No positioning library — CSS `position: absolute` on `export-wrapper` is sufficient for TopBar's fixed location

### Notes
- TopControlsRight is not rendered in the page (only in Storybook stories); its `onExport` callback remains generic for future wiring
- Mobile buttons (AppBar, SettingsContent) still use immediate `handleExport` — issue 038 will wire them to the bottom sheet

