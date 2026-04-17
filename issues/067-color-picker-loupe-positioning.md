---
title: Color picker loupe — quadrant flip positioning
status: done
created: 2026-04-16
parent: 063-color-picker-loupe.md
---

## What to build

Replaces the fixed-offset positioning from slice 065 with dynamic positioning that auto-flips the loupe to a different quadrant relative to the pointer when the loupe would otherwise be clipped by the viewport edge. The loupe is always fully visible regardless of where the pointer is on the canvas.

A new pure-function module `loupe-position` encapsulates the geometry (which quadrant given pointer position, viewport dimensions, loupe dimensions, and per-input-source offsets). The module is independently unit-testable and table-driven.

Mouse and touch use different offset magnitudes per the design spec — touch offsets are larger to clear finger occlusion.

See parent PRD §"Implementation Decisions" → "Modules — New" → `loupe-position`.

## Acceptance criteria

- `loupe-position.ts` pure function module created.
- Function signature accepts: pointer screen coordinates, viewport width and height, loupe width and height, mouse offset and touch offset values from the design spec, current input source (mouse vs touch).
- Function returns: loupe screen coordinates and the chosen quadrant (one of `tl`, `tr`, `bl`, `br`).
- Default quadrant matches the design spec; loupe flips to a different quadrant when the default would clip outside the viewport.
- `Loupe.svelte` updated to consume `loupe-position` and apply the returned coordinates.
- Mouse vs touch input source is plumbed through the sampling session so the loupe knows which offset to use.
- Vitest unit tests: table-driven across 4 quadrants × 2 input sources × edge proximity cases (near each viewport corner, near each viewport edge, in the center).
- Manual smoke test: dragging Eyedropper near each viewport edge keeps the loupe fully visible.

## Blocked by

- [065 — drag-and-commit eyedropper + basic loupe](065-color-picker-loupe-drag-commit.md)

## Scenarios addressed

- Scenario 7

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/loupe-position.ts` | New pure-function module. `computeLoupePosition` returns `{ x, y, quadrant }` for mouse (4 quadrants via default-tr + flip) and touch (centered-above with clamp-not-flip) |
| `src/lib/canvas/loupe-position.test.ts` | 8 behavioral tests (one per quadrant per input source + clamp edges) + 18-case quadrant sweep across 9 reference pointer positions × 2 input sources |
| `src/lib/canvas/sampling-session.svelte.ts` | `SamplingSessionStartParams.inputSource` plumbed; `inputSource` getter exposes mouse/touch/null for the Loupe overlay |
| `src/lib/canvas/sampling-session.svelte.test.ts` | Adds initial-state + start-param + cancel coverage for `inputSource` |
| `src/lib/canvas/canvas-interaction.svelte.ts` | Introduces `PointerType = 'mouse' \| 'pen' \| 'touch'` union + `normalizePointerType` boundary helper; drawing interaction carries `pointerType`; `onDrawStart` callback now `(button, pointerType)` |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | New "pointerType plumbing" describe: mouse / pen / touch-deferred / touch-tap each round-trip through `onDrawStart` |
| `src/lib/canvas/tool-runner.svelte.ts` | `drawStart(button, pointerType: PointerType)`; maps `pen → mouse` once at the boundary, caches `activeInputSource`; `liveSampleLifecycle` forwards to `samplingSession.start` via closure |
| `src/lib/canvas/tool-runner.svelte.test.ts` | 3 inputSource plumbing tests + bulk update of existing `drawStart` call sites for the new 2-arg signature |
| `src/lib/canvas/editor-state.svelte.ts` / `.test.ts` | `handleDrawStart(button, pointerType: PointerType)` propagation; bulk update of ~60 test call sites |
| `src/lib/canvas/PixelCanvasView.svelte` | Tracks `windowSize` reactively (resize listener) + `screenPointer` on every pointer event; normalizes `event.pointerType` at the boundary; passes `viewport`/`inputSource` to `<Loupe>` |
| `src/lib/ui-editor/Loupe.svelte` | Consumes `computeLoupePosition` via new `viewport` + `inputSource` props; removes old CSS-variable positioning; loupe outer dimensions derived from named cell/padding/gap/chip/border constants |
| `src/lib/ui-editor/Loupe.svelte.test.ts` | 3 positioning tests (mouse top-right quadrant, mouse right-edge h-flip, touch horizontal centering) + `TEST_VIEWPORT` shared constant |

### Key Decisions

- **Touch horizontal clipping → clamp inward, no h-flip.** Preserves the design-spec intent of "finger centered in loupe"; the loupe visually slides along the top/bottom edge rather than jumping across the pointer.
- **Loupe outer dimensions decomposed into named building blocks.** After refactor, `LOUPE_WIDTH` / `LOUPE_HEIGHT` are derived from `CELL_SIZE_PX`, `GRID_COLUMNS`, `CELL_GAP_PX`, `PADDING_PX`, `BORDER_PX`, `GRID_CHIP_GAP_PX`, `CHIP_HEIGHT_PX`. Keeps positioning math pure (no ResizeObserver) while cutting the CSS↔JS sync surface down to one constant per CSS value.
- **Pen shares the mouse offset preset.** W3C pen behaves like a mouse for the loupe. The mapping lives in one place (`tool-runner.drawStart`) so the rest of the pipeline only knows `LoupeInputSource = 'mouse' \| 'touch'`.
- **`PointerType` union with boundary normalize.** `PixelCanvasView` normalizes `event.pointerType: string` once via `normalizePointerType`; every signature inside (`canvas-interaction`, `tool-runner`, `editor-state`) uses the closed union, so unexpected values can't reach the core.
- **`ToolContext.inputSource` not added.** During refactor, instead of widening the shared tool context for one consumer (`liveSampleLifecycle`), the lifecycle reads the runner's `activeInputSource` via closure — keeps `ToolContext` small and tool-agnostic.

### Notes

- 068 (long-press touch entry) will exercise the touch branch of `computeLoupePosition` via a real finger gesture. The current tests + smoke cover the geometry; visual-parity verification on touch deferred to 068.
- `LOUPE_WIDTH` / `LOUPE_HEIGHT` still depend on matching the CSS values by human discipline — named constants narrow the surface but don't eliminate the sync requirement. Revisit with a ResizeObserver if the chip layout becomes dynamic.
