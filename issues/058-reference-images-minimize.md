---
title: Reference images — minimize (window-shade)
status: done
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Add window-shade minimize: a minimize button in the title bar (and double-click on title bar) collapses the image area, leaving only the title bar in place. Restoring returns to the previous size. Minimize state persists.

- `DisplayState.minimized` flag toggles the collapsed presentation.
- Minimized window keeps its position; unminimize restores the last width/height.
- Double-click on title bar mirrors the button.
- Minimized windows remain draggable (title bar still interactive) but not resizable.

## Acceptance criteria

- Clicking minimize collapses the body; only the title bar is visible.
- Double-clicking the title bar toggles minimize state.
- Restoring returns to the pre-minimize size; position does not change.
- Minimize state persists across reload and tab switch.
- A minimized window can still be moved by dragging its title bar.
- Unit tests: store minimize toggle, round-trip preserves `minimized` flag.
- Component tests: minimize button + double-click both toggle; collapsed layout renders title bar only; resize handle not interactive while minimized.

## Blocked by

- [057 — Reference images — move + resize](057-reference-images-move-resize.md)

## Scenarios addressed

- Scenario 6 (minimize collapses to title bar; restore expands; double-click title bar also toggles)

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/reference-images-store.svelte.ts` | Added `setMinimized(refId, docId, minimized)` mirroring `setDisplayPosition`/`setDisplaySize` patterns (immutable update + `markDirty`). |
| `src/lib/reference-images/ReferenceWindow.svelte` | Added `minimized?: boolean` prop and `onMinimizeChange?: (next: boolean) => void` callback. New minimize button (left of close) with `ChevronUp`/`ChevronDown` icons whose direction signals the next action. Title-bar `ondblclick` handler with `closest('button')` guard. Body and resize handle wrapped in `{#if !minimized}`. Container `style:height` switches to `auto` when minimized; `data-minimized` attribute drops the title-bar `border-bottom`. Renamed `.close-button` to `.title-bar-button` and grouped controls in `.title-bar-controls`. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | Wires `minimized={state.minimized}` and `onMinimizeChange={(next) => store.setMinimized(...)}` to the store. |
| `messages/en.json`, `messages/ko.json`, `messages/ja.json` | Added `references_window_minimize` and `references_window_restore` i18n keys. |
| `src/lib/reference-images/reference-images-store.svelte.test.ts` | 2 new tests: flag flip + dirty mark, snapshot/restore round-trip preserves `minimized: true`. |
| `src/lib/reference-images/ReferenceWindow.svelte.test.ts` | 5 new tests: minimize button click (both directions), title-bar dblclick (both directions), no image body when minimized, no resize handle when minimized, title-bar drag still works when minimized. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte.test.ts` | 1 new test: minimize button click writes through to `store.setMinimized` with the expected args. |

### Key Decisions

- **`setMinimized(value)` over `toggleMinimize()`** — explicit value matches existing `setDisplayPosition` / `setDisplaySize` shape and keeps tests deterministic without dependence on prior state.
- **`onMinimizeChange?: (next: boolean) => void`** — same shape as existing `onMove` / `onResize`. Overlay maps 1:1 to `store.setMinimized` with no transformation.
- **Title-bar `ondblclick` with `closest('button')` guard** — mirrors the existing pointerdown shield. Side benefit: dblclick on a button itself is two clicks → toggles back to original state (intuitive no-op), and the dblclick is swallowed by the guard so no extra parent-level toggle.
- **`{#if !minimized}` over CSS hiding** — removes body/resize-handle from the DOM and accessibility tree; eliminates any chance of stray pointer events on the resize-handle hit-area while minimized; cleaner test surface (`queryByRole(...)` returns `null`).
- **Toggling Chevron icons** — `ChevronUp` (will roll up) when expanded, `ChevronDown` (will roll down) when minimized. Makes the next action obvious; especially helpful in the minimized state where the title bar is the only visible surface.
- **Visual polish in scope** — container height switches to `auto`, title-bar `border-bottom` removed via `data-minimized` attribute, button cluster wrapped in `.title-bar-controls`. AC says "only the title bar is visible" — a leftover empty body region would not satisfy that.

### Notes

- **Touch target size (44×44 guideline)** — minimize and close buttons are 20×20 with a 2px gap. The `web-styling.md` guideline calls for ≥44×44 hit areas in compact/medium tiers. Matches the existing close-button convention from 057, so 058 did not introduce a new violation. Worth folding into the `Reference image window polish` backlog item before MVP closes.
- **Backward-compat** — older snapshots without a `minimized` field deserialize to `undefined`, which is falsy, so `{#if !minimized}` and `!minimized` toggle behave correctly. After one toggle, the snapshot gains the field. No migration step required.
- **PRD 053 still open** — 4 sibling sub-issues remain (059 z-order + cascade, 060 eyedropper sampling, 061 long-press sampling, 062 drag-drop import).
