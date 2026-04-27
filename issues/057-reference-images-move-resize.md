---
title: Reference images — move + resize
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/compute-resize.ts` | Pure aspect-locked resize math: dominant axis (larger relative pointer delta) drives result; uniform scale-up enforces `minSize` floor on both axes |
| `src/lib/reference-images/compute-resize.test.ts` | Aspect preservation across square/landscape/portrait, dominant axis selection, min-size floor |
| `src/lib/reference-images/compute-position-clamp.ts` | Pure release-time position clamp: window stays fully inside viewport; oversized axis snaps to 0 |
| `src/lib/reference-images/compute-position-clamp.test.ts` | Inside/outside cases, oversized axis snap, zero-size viewport |
| `src/lib/reference-images/reference-window-constants.ts` | Shared `MIN_WINDOW_EDGE = 80` consumed by `computeInitialPlacement` and `ReferenceWindow` so the floor matches |
| `src/lib/reference-images/compute-initial-placement.ts` | Replaced local `MIN_EDGE` with shared `MIN_WINDOW_EDGE` |
| `src/lib/reference-images/reference-images-store.svelte.ts` | New `setDisplayPosition(refId, docId, x, y)` and `setDisplaySize(refId, docId, width, height)` — immutable update + `markDirty(docId)` for auto-save |
| `src/lib/reference-images/reference-images-store.svelte.test.ts` | Store mutators: position/size update + dirty notification |
| `src/lib/reference-images/ReferenceWindow.svelte` | Title-bar pointerdown/move/up handlers (with `closest('button')` guard so X button isn't captured); bottom-right `<button class="resize-handle">` driven by `computeResize`; `onMove`/`onMoveCommit`/`onResize`/`onResizeCommit` callbacks; inline `style:pointer-events="auto"` on root (workaround for happy-dom not applying scoped CSS); `::before` pseudo expands hit area to 44×44; `::after` pseudo draws subtle two-line diagonal grip in `--ds-text-tertiary`, opacity 0.7 → 1 on hover |
| `src/lib/reference-images/ReferenceWindow.svelte.test.ts` | Drag emits `onMove(absX, absY)`, resize emits aspect-preserved size, button-target guard regression test, pointer-events absorption |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | Wires `onMove`/`onMoveCommit`/`onResize` to store; `commitPosition` clamps via `clampPosition` and writes back only when changed |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte.test.ts` | Move-then-commit clamps to viewport; resize forwards through to store |
| `messages/{en,ko,ja}.json` | New `references_window_resize` message for resize handle aria-label |
| `docs/platform-status.md` | Reference Images → Display on canvas: appended move + resize summary |

### Key Decisions

- **Position clamp policy: window fully inside viewport** (option A). Matches the existing render-time fit policy in `ReferenceWindowOverlay`, so the stored intent and rendered position agree and the title bar always remains grabbable. Considered "title-bar partial visibility" but it doubled the policy surface for no UX benefit on this MVP slice.
- **Live update vs commit split**: drag/resize emit continuous `onMove`/`onResize` for responsive feedback; pointer-up triggers `onMoveCommit` which runs the clamp and writes back through the store. Resize doesn't need a commit-time clamp because aspect-locked resize from inside the viewport can't push the window past it.
- **Aspect-resize math driven by dominant axis** (the axis whose pointer delta represents the larger relative change). Diagonal drags feel predictable regardless of which axis the user emphasises, instead of jittering between two competing readings.
- **Hit area via `::before`, visual via `::after`**: the visible 16×16 grip stays small to match design language while the invisible `::before` expands the touch zone to 44×44 (web-styling rule on compact/medium). Keeps the geometry composable — visual and hit area can change independently.
- **Inline `style:pointer-events="auto"` on root**: happy-dom doesn't apply Svelte scoped CSS during component tests, so `getComputedStyle(...).pointerEvents` returns empty. Moving the rule inline keeps the pointer-absorb test reliable without weakening production behavior.

### Notes

- The X-button-during-drag regression (title-bar pointerdown captured the close button) was caught by the user mid-implementation. Fixed with `if ((e.target as HTMLElement).closest('button')) return;` and locked in by a regression test in `ReferenceWindow.svelte.test.ts`.
- `setDisplaySize` does not currently re-position the window — corner handle is bottom-right, so growing the window keeps the top-left fixed and clamp on resize commit isn't needed in this slice. Issue 058 (minimize/window-shade) will introduce a separate height transform that may revisit this assumption.
- `--ds-text-tertiary` was chosen for the grip indicator over `--ds-border-subtle` because the grip needs to be visible against the image content beneath the body, not just against the title bar.
