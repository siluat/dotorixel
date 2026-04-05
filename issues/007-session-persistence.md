---
title: Session persistence — restore work after refresh/revisit
status: open
created: 2026-04-06
---

## Problem Statement

When a user refreshes the page or closes the browser and comes back, all their work is lost. Every visit starts with a blank 16×16 canvas. For a pixel art editor, losing in-progress artwork without warning is a critical usability gap — users expect their work to survive a page reload.

## Solution

Automatically persist the entire workspace state to IndexedDB and silently restore it on the next page load. The user should not need to take any explicit action — the editor "just remembers" where they left off.

If no saved session exists (first visit, cleared browser data), the editor falls back to the current behavior: a single blank 16×16 canvas.

## Key Scenarios

1. User draws on the canvas, waits a few seconds, then refreshes the page → the editor reopens with the same canvas content, tab name, and viewport position.
2. User has 3 tabs open with different canvases, closes the browser, reopens it later → all 3 tabs are restored with correct names, order, pixel data, and the same tab is active.
3. User changes the active tool to "line", foreground color to red, then refreshes → the tool and color selections are preserved.
4. User zooms into a specific area of the canvas, refreshes → the zoom level and pan position are restored.
5. User refreshes immediately after drawing (before the debounce interval fires) → the beforeunload/visibilitychange handler saves the latest state, so the stroke is not lost.
6. Saved data is corrupted or unreadable → the editor falls back to a blank canvas without showing an error.
7. User opens the editor in two browser tabs, edits in both, closes them → the last-closed tab's state wins on next visit (last-write-wins).
8. User draws a stroke, then presses Ctrl+Z after a refresh → undo does nothing (undo/redo history is not persisted, which is expected behavior).

## Implementation Decisions

### Storage

- **IndexedDB** via the `idb` library (1.4 KB gzip, Promise-based, excellent TypeScript generics).
- Two object stores in a single database (`dotorixel`, version 1):
  - **`documents`**: One record per canvas/tab. Fields: `id`, `name`, `width`, `height`, `pixels` (Uint8Array), `createdAt`, `updatedAt`. Keyed by `id`. Indexed by `updatedAt` for future "Reopen past work" list sorting.
  - **`workspace`**: Single record (`id: "current"`) holding session metadata: tab order (array of document IDs), active tab index, shared state (active tool, foreground/background colors, recent colors), and per-tab viewport state (scale, offset, grid visibility, grid color).
- Schema versioning: start at version 1 with a switch-case upgrade callback structure so future versions (e.g., adding thumbnail field for "Reopen past work") can be added incrementally.

### Save Timing

- **Dirty flag + debounce**: When the canvas changes (draw, resize, clear) or workspace structure changes (tab add/close/reorder/rename), mark the affected data as dirty. A debounce timer (3–5 seconds) flushes dirty data to IndexedDB.
- **beforeunload + visibilitychange**: As a safety net, save immediately on page unload or when the page becomes hidden (covers mobile Safari where beforeunload is unreliable).
- Only dirty documents are written — unchanged tabs are skipped.

### Restore Behavior

- On page load, attempt to read the `workspace` record and its associated `documents`.
- If data exists and is valid, reconstruct the Workspace with the saved state.
- If data is missing, corrupted, or restore fails for any reason, fall back to the default blank canvas — no error shown to the user.

### Multiple Browser Tabs

- **Last-write-wins**: No cross-tab synchronization. The last tab to save overwrites the session. This is acceptable for MVP — the use case of editing in two tabs simultaneously is rare.

### Serialization

- Use existing WASM methods for extraction/reconstruction:
  - `pixelCanvas.pixels()` → Uint8Array, `pixelCanvas.width()`, `pixelCanvas.height()` for saving.
  - `WasmPixelCanvas.from_pixels(w, h, pixels)` for restoring canvas data.
  - `viewport.scale()`, `viewport.offset_x()`, `viewport.offset_y()` for saving viewport.
  - `new WasmViewport(scale, offsetX, offsetY)` for restoring viewport.
- No intermediate serialization format — the persistence module reads/writes domain objects directly.

### Module Structure

- **SessionStorage** (new): IndexedDB wrapper. Owns DB schema, open/close, typed CRUD for `documents` and `workspace` stores. Has no knowledge of editor domain objects — operates on plain data types.
- **SessionPersistence** (new): Orchestration layer. Knows how to extract data from Workspace/EditorState/SharedState and convert to storage format. Manages dirty tracking, debounce timer, save/restore lifecycle.
- **Workspace** (modified): Accept optional initialization data to restore from saved state instead of always creating a blank canvas.
- **Editor page** (modified): Call restore on mount, start auto-save after initialization, save on unload events.

## Testing Decisions

Good tests for this feature assert on observable outcomes (data round-trips correctly, dirty tracking triggers saves, fallback works on corruption) rather than implementation details (which IndexedDB methods were called, internal timer state).

### SessionStorage

- Test with `fake-indexeddb` injected into the vitest environment, exercising real IndexedDB behavior.
- Key scenarios: store and retrieve a document with Uint8Array pixel data, update a document and verify updated fields, store and retrieve workspace metadata, handle missing records gracefully.

### SessionPersistence

- Mock SessionStorage interface to test orchestration logic in isolation.
- Key scenarios: only dirty documents are saved, restore produces a valid Workspace configuration, corrupted/missing data falls back to defaults, debounce batches rapid changes into a single write.
- One integration test with real SessionStorage (fake-indexeddb): full round-trip save → restore and verify pixel data equality.

### Workspace modifications

- Extend existing Workspace tests to cover initialization from saved data (multiple tabs, active tab index, shared state).

### Prior art

- Existing tests in the codebase (e.g., workspace, editor-state, shared-state tests) follow the same pattern: construct domain objects, exercise methods, assert on outcomes. The new tests will follow this convention.

## Rejected Alternatives

### localStorage

Rejected because it only supports string values (Uint8Array would need Base64 encoding with 33% size inflation), has a ~5–10 MB limit, and uses synchronous API that blocks the main thread. IndexedDB handles binary data natively and has much larger storage limits.

### Dexie.js

Feature-rich IndexedDB wrapper (~26 KB gzip) with ORM-like queries, reactive queries, and cloud sync. Vastly over-powered for our CRUD needs. 18× the bundle size of `idb` with no features we would use.

### idb-keyval

Smallest option (<1 KB) but only supports a single object store with no indexes. Cannot separate documents and workspace metadata into distinct stores, which is needed for the "Reopen past work" extension.

### Persisting undo/redo history

Each history snapshot is a full canvas copy (up to ~256 KB). With multiple snapshots per tab and multiple tabs, storage could reach several MB. Serializing WASM-managed history stacks adds complexity. Most web editors (Figma, Photoshop Web, Pixlr) do not persist undo history across sessions — users expect a fresh undo stack after reload.

### Cross-tab synchronization (BroadcastChannel)

Would enable real-time sync between multiple browser tabs editing the same session. Rejected as over-engineering for MVP — the simultaneous multi-tab editing scenario is rare for a pixel art editor. Last-write-wins is sufficient. Can be added later without schema changes.

### Confirmation prompt on restore

"Restore previous session?" dialog on every page load. Rejected because it adds friction to the most common case (user wants to continue). The editor should silently restore. Users who want a fresh start can close tabs and create new ones.

## Out of Scope

- **Explicit save/load UI**: Covered by the separate "Reopen past work" task.
- **Named projects / file management**: Future feature; this task only auto-saves the current workspace as a single anonymous session.
- **Cloud/server-side persistence**: All storage is local (IndexedDB). No accounts, no sync.
- **Undo/redo history persistence**: Fresh undo stack on each session.
- **Cross-tab real-time synchronization**: Last-write-wins is the only multi-tab policy.
- **Storage quota management / eviction policy**: Deferred until "Reopen past work" where multiple saved projects make quota relevant.

## Further Notes

- The `documents` store schema is intentionally designed to be reusable by "Reopen past work". That task will query the same store to list past canvases, potentially adding fields like thumbnails via a schema version upgrade.
- The `idb` library's `DBSchema` generic interface allows compile-time type safety for all store operations, catching key/value type mismatches at build time.
- `fake-indexeddb` (vitest) provides a spec-compliant in-memory IndexedDB implementation, making tests fast and deterministic without browser infrastructure.
