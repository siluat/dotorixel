---
title: Saved work browser — mobile
status: open
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
