---
title: Reference images — move + resize
status: open
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Add interactive move (title-bar drag) and resize (bottom-right handle, aspect-locked) to the floating reference window. Uses unified PointerEvents so mouse and touch share one path. Position / size persist through reload and tab switch.

- **Move** — dragging the title bar updates `DisplayState.x/y` via callback; store writes persist to `WorkspaceRecord`.
- **Resize** — single bottom-right handle; preserves aspect ratio; enforces ~80×80 minimum; updates `DisplayState.width/height`.
- **Viewport clamp** — ongoing operations may go beyond viewport edges but final position is clamped to safe bounds so the title bar remains grabbable.
- **Pointer absorption** — reinforced: drawing on the canvas under the window does nothing (already established in #056, covered again by tests here because the move/resize interactivity surfaces this most clearly).

## Acceptance criteria

- Title-bar drag moves the window; the canvas underneath is unaffected.
- Bottom-right handle drag resizes the window while preserving aspect ratio.
- Minimum size (~80×80) is enforced — attempting to shrink past it stops at the floor.
- Release commits; reload restores last position and size.
- Drawing with the pencil tool on an area covered by a reference window produces no canvas change.
- Unit tests: resize math preserves aspect across square/landscape/portrait inputs; move clamp math.
- Component tests: drag updates position callback, resize preserves aspect, pointer-absorb verified with a simulated canvas click.

## Blocked by

- [056 — Reference images — display on canvas + close](056-reference-images-display-close.md)

## Scenarios addressed

- Scenario 4 (title-bar drag moves window)
- Scenario 5 (bottom-right handle resize, aspect locked, min size enforced)
- Scenario 9 (pencil on covered area is absorbed)
