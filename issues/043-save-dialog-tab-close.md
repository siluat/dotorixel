---
title: Save dialog on tab close
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/blank-detection.ts` | Pure function `isBlankCanvas` — checks all pixels are zero |
| `src/lib/canvas/blank-detection.test.ts` | 4 tests for blank detection (blank, non-blank, 1×1 edges) |
| `src/lib/session/session-persistence.ts` | Added `isDocumentSaved`, `saveDocumentAs`, `deleteDocument` |
| `src/lib/session/session-persistence.test.ts` | 3 tests for new persistence methods |
| `src/lib/session/session.ts` | Extended `SessionHandle` interface with new methods |
| `src/lib/ui-editor/SaveDialog.svelte` | Modal dialog — name input, Save/Delete/Cancel, focus trap |
| `src/lib/ui-editor/TabStrip.svelte` | Close button keyboard accessibility (tabindex, Enter handling) |
| `src/routes/editor/+page.svelte` | Tab close handler integration, editor keyboard guard |
| `messages/en.json` | i18n messages for save dialog |
| `messages/ko.json` | i18n messages for save dialog |
| `messages/ja.json` | i18n messages for save dialog |

### Key Decisions
- Blank detection checks all bytes are zero (transparent initial state) rather than comparing against a configurable background color — new canvases are always transparent
- New `SessionPersistence` methods bypass `AutoSave` and go directly to storage — they are immediate operations, not debounced
- `onmousedown` for backdrop dismiss instead of `onclick` — prevents accidental close during text selection drag
- Full focus trap manages all Tab movements manually instead of relying on browser default tab order

### Notes
- `TabStrip` close button accessibility was improved as part of this task (roving tabindex, Enter/Space passthrough)
- Editor keyboard shortcuts are suppressed while the dialog is open via a guard in `handleEditorKeyDown`
- Duplicate document names are allowed (no uniqueness constraint) — consistent with standard graphics editors
