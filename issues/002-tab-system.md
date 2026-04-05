---
title: Tab system — multi-image workflow
status: done
created: 2026-04-05
---

## Problem Statement

DOTORIXEL currently supports editing only a single image at a time. Pixel art workflows frequently require working on multiple related assets simultaneously — a character sprite, its animation frames, or a tileset alongside a map layout. Without tabs, users must close their current work to start something new, losing all progress (since there is no save/load yet).

## Solution

Introduce a tab system that lets users open multiple images simultaneously and switch between them instantly. Each tab holds an independent image with its own canvas, viewport, and undo history, while drawing tools and colors are shared across all tabs. A tab strip UI (already designed in .pen files across all 4 breakpoints) provides visual tab management.

## User Stories

1. As a pixel artist, I want to create a new image in a new tab, so that I can work on multiple assets without losing my current work.
2. As a pixel artist, I want to click a tab to switch to that image, so that I can quickly move between related assets.
3. As a pixel artist, I want to close a tab I no longer need, so that my workspace stays uncluttered.
4. As a pixel artist, I want my zoom level and pan position preserved per tab, so that switching back to an image returns me to exactly where I was working.
5. As a pixel artist, I want the drawing tool and colors to stay the same when switching tabs, so that I can continue working with the same tool without re-selecting it.
6. As a pixel artist, I want undo/redo to be independent per tab, so that undoing in one image doesn't affect another.
7. As a pixel artist, I want each new tab to get an automatic name like "Untitled 1", "Untitled 2", so that I can distinguish between open images.
8. As a pixel artist, I want the app to prevent me from closing the last remaining tab, so that I always have an active workspace.
9. As a pixel artist, I want the tab to the right of a closed tab to become active (or the left if none exists on the right), so that tab closure feels predictable.
10. As a pixel artist, I want new tabs to automatically become the active tab and scroll into view, so that I immediately start working on the new image.
11. As a pixel artist, I want to horizontally scroll the tab strip when there are more tabs than the screen can show, so that I can still access all my open images.
12. As a pixel artist, I want the tab strip to be visually consistent across desktop, iPad, tablet, and mobile breakpoints, so that the experience feels cohesive on any device.
13. As a pixel artist, I want to see a "+" button at the end of the tab strip, so that I have a clear affordance for creating new images.
14. As a pixel artist, I want each tab to show a close "x" button, so that I can close individual images directly.
15. As a pixel artist, I want the active tab to be visually distinct (elevated background + accent indicator), so that I always know which image I'm editing.
16. As a pixel artist, I want the app to start with one default tab ("Untitled 1"), so that the experience is identical to before tabs were introduced.
17. As a pixel artist, I want recent colors to be shared across all tabs, so that my color palette builds up from all my work.

## Implementation Decisions

### Architecture: Workspace + SharedState pattern

- Introduce a **Workspace** class above EditorState that manages an array of EditorState instances (tabs) and tracks the active tab index.
- Extract shared state (activeTool, foregroundColor, backgroundColor, recentColors) into a **SharedState** object. All EditorState instances reference the same SharedState object — no synchronization logic needed.
- EditorState's constructor accepts a SharedState reference. Internal access to shared state goes through `this.shared.activeTool` etc., preserving the existing reactive chain.
- Each EditorState retains independent: pixelCanvas, history (WasmHistoryManager), viewportState, viewportSize, renderVersion, resizeAnchor.

### Workspace responsibilities

- `addTab()`: Create a new EditorState with default 16x16 canvas, assign sequential name ("Untitled N"), set as active, ensure scrolled into view.
- `closeTab(index)`: Remove the tab. If it's the last tab, do nothing (minimum 1 tab). If closing the active tab, activate the right neighbor (or left if rightmost).
- `setActiveTab(index)`: Switch the active tab.
- Tab name counter: monotonically increasing per session (closing "Untitled 2" doesn't recycle the number).

### Tab strip UI

- Implement as a new **TabStrip** Svelte component placed below Top Bar / App Bar.
- Responsive heights: 36px (desktop), 32px (iPad/tablet), 28px (mobile) — matching .pen designs.
- Active state: `--bg-elevated` background + `--accent` bottom 2px indicator. Inactive: no background, `--text-secondary` text.
- First tab flush to left edge, "+" button immediately follows last tab.
- Overflow: CSS `overflow-x: auto` with scrollbar hidden. Supports trackpad horizontal swipe and touch swipe.
- Auto-scroll to newly created tab or newly activated tab if outside visible area.

### State flow

- `+page.svelte` creates Workspace (which creates initial SharedState + first EditorState).
- Active EditorState is passed to existing child components (PixelCanvasView, RightPanel, LeftToolbar, etc.) — these components need minimal changes since they already accept EditorState.
- Tool/color UI components read from the active EditorState, which delegates to SharedState.

### Tab closure behavior

- No confirmation dialog — tabs close immediately.
- Minimum 1 tab always open (last tab cannot be closed).
- Closing a non-active tab does not change the active tab.

### New image defaults

- New tab creates a 16x16 blank canvas immediately (no size dialog).
- Users can resize afterward using the existing ResizeModal.

### Tab ordering

- Tabs are in creation order, fixed. No drag-to-reorder.

### Keyboard shortcuts

- None for this iteration. Browser shortcut conflicts make this risky for a web app.

### Initial app state

- App starts with a single "Untitled 1" tab — identical UX to current single-image behavior.

## Testing Decisions

Good tests for this feature assert on external behavior (tab count, active tab identity, state independence) rather than internal implementation details (array indices, internal method calls).

### Workspace unit tests

- Adding a tab increments count, sets it active, assigns correct sequential name.
- Closing the active tab activates the right neighbor; closing the rightmost active tab activates the left neighbor.
- Closing the last remaining tab is a no-op (count stays 1).
- Closing a non-active tab preserves the current active tab.
- Tab name counter never recycles (close "Untitled 2", next tab is "Untitled 3" not "Untitled 2").

Prior art: existing EditorState tests in `src/lib/canvas/` use Vitest with direct class instantiation.

### EditorState + SharedState integration tests

- Two EditorState instances sharing the same SharedState: changing activeTool on one is reflected when reading from the other.
- Shared color state (foreground, background, recentColors) is consistent across instances.
- Independent state (canvas pixels, history, viewport) does not leak between instances.

## Out of Scope

- **Session persistence**: Saving/restoring tabs across browser refresh (separate M2 task).
- **File save/load**: Import/export of image files to associate with tabs.
- **Tab name editing**: Double-click to rename tabs.
- **Tab reordering**: Drag-and-drop to rearrange tab positions.
- **Tab limit**: Maximum number of simultaneously open tabs.
- **Close confirmation dialog**: Warning before closing a tab with unsaved changes.
- **Keyboard shortcuts**: Tab switching, new tab, close tab shortcuts.
- **Tab context menu**: Right-click menu with close/close others/close all.
- **Thumbnail previews**: Showing a small preview of the canvas in the tab or on hover.

## Further Notes

- The existing mobile TabBar (DRAW / COLORS / SETTINGS view navigation) is orthogonal to image tabs. Switching image tabs preserves the current view mode. No changes to the existing TabBar are needed.
- The tab name counter is session-scoped. Since there is no persistence, it resets on page reload.
- When persistence is added later, tab names will naturally transition to file names, and the "Untitled N" pattern will only apply to unsaved images.
