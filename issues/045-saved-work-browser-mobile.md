---
title: Saved work browser — mobile
status: done
created: 2026-04-09
parent: 041-reopen-past-work.md
---

## What to build

A mobile bottom sheet variant of the saved work browser. Reuses the query, thumbnail, open, and delete logic from the desktop slice, wrapped in a vaul-svelte bottom sheet with an AppBar trigger button.

End-to-end: trigger button in AppBar opens a bottom sheet → same card grid content as desktop (query, thumbnails, open action, delete) → responsive layout adapted for mobile viewports.

Key changes (see parent PRD "Implementation Decisions" for full context):
- Mobile bottom sheet component using vaul-svelte (following ExportBottomSheet pattern)
- AppBar trigger button (per design 040)
- Reuse card grid, thumbnail renderer, query logic, and delete confirmation from slice 044

Design reference: `docs/pencil-dotorixel.pen` frame `3PXRt` (issue 040).

## Acceptance criteria

- AppBar shows a trigger button that opens the saved work browser bottom sheet
- Bottom sheet displays the same card grid content as the desktop modal
- All interactions work identically: browse, open as tab, delete with confirmation, empty state
- Bottom sheet closes on drag-down, backdrop tap, or after opening a document
- Layout adapts to compact and medium viewport sizes

## Blocked by

- [044 — Saved work browser — desktop](044-saved-work-browser-desktop.md)

## Scenarios addressed

- Scenario 7: Browse saved work (mobile variant)
- Scenario 8: Open document as new tab (mobile variant)
- Scenario 10: Delete document (mobile variant)
- Scenario 11: Empty state (mobile variant)

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/SavedWorkCardGrid.svelte` | Extracted shared card grid content (thumbnails, delete confirmation, empty state) |
| `src/lib/ui-editor/SavedWorkCardGrid.svelte.test.ts` | Card grid tests: render, select, delete confirmation, empty state |
| `src/lib/ui-editor/SavedWorkBrowserSheet.svelte` | Mobile bottom sheet wrapping SavedWorkCardGrid (vaul-svelte) |
| `src/lib/ui-editor/SavedWorkBrowserSheet.svelte.test.ts` | Bottom sheet tests: render with documents, empty state |
| `src/lib/ui-editor/SavedWorkBrowser.svelte` | Refactored to use SavedWorkCardGrid |
| `src/lib/ui-editor/AppBar.svelte` | Added optional `onBrowseSavedWork` prop with FolderOpen trigger button |
| `src/lib/ui-editor/AppBar.svelte.test.ts` | AppBar tests: button render, click callback |
| `src/routes/editor/+page.svelte` | Wired mobile sheet + AppBar trigger; layout-aware rendering |

### Key Decisions
- Extracted `SavedWorkCardGrid` as shared component instead of duplicating card grid logic between desktop modal and mobile bottom sheet.
- Delete dialog keyboard events (Escape, Tab) handled at the backdrop element with `stopPropagation()`, preventing vaul-svelte from closing the bottom sheet when the delete dialog is open.
- Focus restoration after delete dialog dismiss: saves the triggering card button reference and restores focus via `tick()`, ensuring vaul-svelte can receive subsequent Escape events.
- Responsive grid: 2 columns on mobile (< 600px), 3 columns on iPad+ (≥ 600px).
