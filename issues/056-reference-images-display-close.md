---
title: Reference images — display on canvas + close
status: done
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Clicking a gallery card displays the reference as a static floating window on the canvas; closing the window (X) removes it from the canvas but keeps the gallery entry. Establishes the overlay container, `ReferenceWindow` component skeleton, `DisplayState` persistence, and the pointer-absorb policy. No move/resize/minimize yet.

- **`DisplayState`** — per-instance record: refId, visible, x, y, width, height, minimized=false, zOrder. Persisted inside `WorkspaceRecord` (extends the map from #055).
- **Overlay container** — mounted on the editor page above the canvas, below editor chrome (TopBar, LeftToolbar, RightPanel, StatusBar). Renders one `ReferenceWindow` per visible `DisplayState` for the active tab.
- **`ReferenceWindow` component** — receives `ReferenceImage` + `DisplayState` via props; emits close via callback. Static frame: title bar + image body + close (X). Absorbs pointer events (no pass-through).
- **Initial placement & size** — viewport center with ~24px cascade offset (see PRD §Window Behavior); size = `min(natural, viewport × 0.3)` on the longer edge, aspect preserved; hard minimum ~80×80; clamped to viewport.
- **Close behavior** — X sets visible=false and persists; re-showing is out of scope for this slice (re-display UX lives with #055's gallery toggle wiring or a follow-up; for this slice, close + gallery delete are the two removal paths).

Note: re-display toggle (clicking a card for an already-closed reference to bring it back) should be wired here as part of the card-body click surface already added in #055 — clicking a non-displayed card displays it; clicking a displayed card… TBD in this slice (likely closes the modal without re-toggling; move toggle logic into #059 once z-order lands).

## Acceptance criteria

- Clicking a gallery card body closes the modal and displays the reference as a floating window centered in the viewport with cascade offset.
- Floating window renders thumbnail-free, full-resolution image at the computed initial size.
- Pointer events on the window do NOT reach the canvas underneath (drawing, clicking, etc. are absorbed).
- Close (X) hides the window; the gallery entry remains and the card reflects the non-displayed state.
- Reload restores visible windows at their persisted position/size; hidden windows stay hidden.
- Unit tests: store toggle/hide sequences, workspace round-trip preserves `DisplayState` including visible flag, initial-placement math.
- Component tests: `ReferenceWindow` close callback fires without removing the underlying ref record; pointer-absorb verified.

## Blocked by

- [055 — Reference images — gallery foundation](055-reference-images-gallery-foundation.md)

## Scenarios addressed

- Scenario 3 (card click → centered floating window, modal closes)
- Scenario 12 (close X → window disappears, gallery entry remains)

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/display-state-types.ts` | New `DisplayState` interface (refId, visible, x/y/w/h, minimized, zOrder) |
| `src/lib/reference-images/compute-initial-placement.ts` | Pure placement math — natural ↔ viewport×0.3, 80px floor, **viewport upper-bound cap**, cascade offset, viewport clamp |
| `src/lib/reference-images/reference-images-store.svelte.ts` | Added `display` / `show` / `close` mutators, `displayStateFor` / `displayStatesForDoc` / `displayStatesSnapshot` queries, `restoredDisplayStates` constructor option; `delete` / `removeDoc` now clear display states too |
| `src/lib/reference-images/ReferenceWindow.svelte` | New floating window component — title bar + close X + image body, `data-active` attribute for active/inactive styling, `pointer-events: auto`, design tokens (`--ds-shadow-sm/md`, `--ds-font-size-sm`) |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | New overlay container — renders one `ReferenceWindow` per visible state, render-time `fit()` clamps to viewport without mutating store |
| `src/lib/reference-images/ReferenceGalleryGrid.svelte` | Added Eye/EyeOff toggle button, `displayedRefIds` prop, `data-displayed` on cards |
| `src/lib/reference-images/ReferenceBrowser.svelte` / `ReferenceBrowserSheet.svelte` | Pass-through props for `displayedRefIds`, `onToggleDisplay` |
| `src/lib/session/session-storage-types.ts` | Added `DisplayStateRecord` and `WorkspaceRecord.displayStates?` (forward-compat optional) |
| `src/lib/session/session-persistence.ts` | Wired `displayStates` round-trip in `save()` / `restore()` |
| `src/lib/canvas/workspace-snapshot.ts` | Added `WorkspaceSnapshot.displayStates?` |
| `src/lib/canvas/editor-session/workspace.svelte.ts` | Wired `restoredDisplayStates` and `displayStatesSnapshot()` through `Workspace` |
| `src/routes/editor/+page.svelte` | Mounted `<ReferenceWindowOverlay>` (docked + tabs layouts), wired card-click to display/show, `viewportWidth/Height` props for responsive fit |
| `messages/{en,ko,ja}.json` | New keys: `references_window_close`, `references_toggle_display_show`, `references_toggle_display_hide` |
| Tests | 13 new component tests (`ReferenceWindow` 4 + `ReferenceWindowOverlay` 9), 7 store tests, 1 persistence round-trip test, 7 placement tests including 2 viewport-cap edge cases |

### Key Decisions

- **Render-time fit, not store-time clamp.** `ReferenceWindowOverlay` clamps the window into the viewport on every render but never writes back. The store keeps the user's stored placement intent intact, so when the viewport grows again the original size/position is restored. This keeps the seam clean for #057 (move/resize), where only user-driven changes will mutate the store.
- **Initial placement caps to viewport.** `computeInitialPlacement` had an 80px minimum-edge floor that could exceed a small viewport (e.g., 2000×100 on 360×500 mobile → width=1600). Added a viewport upper-bound cap so a freshly-opened window is always fully visible, even when extreme aspect ratios fight the floor.
- **Forward-compat persistence.** `WorkspaceRecord.displayStates?` and `WorkspaceSnapshot.displayStates?` are optional with "absent → empty map" hydration semantics; old IndexedDB rows do not need migration.
- **Eye/EyeOff toggle on card.** Card body click selects (closes modal + displays); card Eye button toggles display without closing modal — supports both "switch context to canvas" and "manage many references in one sitting" patterns.

### Notes

- `#f5f0eb` literal in `ReferenceWindow.svelte` body background mirrors the existing `ReferenceGalleryGrid` thumbnail backdrop pattern from #055; left as-is for consistency. A separate cleanup can promote both to `var(--ds-bg-surface)` (≈ #F5F1EB).
- Re-display of a closed window via gallery card click is wired via `show()` (preserves stored x/y/w/h and bumps zOrder). Z-order interaction with click-to-front is deferred to #059.
- Pointer-absorb (`pointer-events: auto` on window, `pointer-events: none` on overlay container) is implemented but not yet asserted by an automated pointer-passthrough test; verified manually in browser.
