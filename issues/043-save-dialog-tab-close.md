---
title: Save dialog on tab close
status: open
created: 2026-04-09
parent: 041-reopen-past-work.md
---

## What to build

When a user closes a tab containing a new unsaved document with drawn content, show a save dialog that lets them choose to save, delete, or cancel. Blank canvases close silently without a dialog.

End-to-end: blank canvas detection determines whether content exists → tab close handler checks `saved` flag and blank state to decide behavior → save dialog component presents options with name input → user action updates IndexedDB and closes (or keeps) the tab.

Key changes (see parent PRD "Implementation Decisions" for full context):
- Blank canvas detection: pure function comparing pixel data against initial background state
- Save dialog component: three actions — "Save" (mark `saved: true`, apply name), "Delete" (button text must clearly communicate deletion, remove from IndexedDB), "Cancel" (dismiss, keep tab)
- Name input field pre-filled with current document name (e.g., "Untitled 1")
- Tab close handler in editor page: route to dialog only when `saved: false` and canvas is not blank

## Acceptance criteria

- Closing a tab with a blank canvas (all pixels match initial state) dismisses without any dialog
- Closing a tab with drawn content on a new document (`saved: false`) shows the save dialog
- "Save" in the dialog sets `saved: true`, applies the entered name, and closes the tab
- "Delete" in the dialog removes the document from IndexedDB and closes the tab
- "Cancel" in the dialog dismisses it and keeps the tab open
- A canvas where all strokes were undone back to initial state is treated as blank
- Closing a tab with a `saved: true` document does not show the dialog (handled by slice 042)

## Blocked by

- [042 — Document persistence foundation](042-persistence-foundation.md)

## Scenarios addressed

- Scenario 1: New document with content → save dialog on close
- Scenario 2: User selects "Save" → document saved with name, tab closes
- Scenario 3: User selects "Delete" → document removed, tab closes
- Scenario 4: User selects "Cancel" → dialog dismissed, tab stays
- Scenario 5: Blank canvas → closes without dialog
- Scenario 6: All strokes undone → treated as blank, closes without dialog
