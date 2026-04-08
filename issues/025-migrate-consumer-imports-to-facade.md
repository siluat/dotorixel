---
title: Migrate consumer tests and story files to facade factories
status: done
created: 2026-04-08
---

## Problem Statement

Issue 024 introduced a WASM facade layer, reducing direct `$wasm/dotorixel_wasm` imports in production code from 25+ files to 1 (`wasm-backend.ts`). However, 4 consumer test files and 1 story file still import WASM types directly (`WasmPixelCanvas`, `WasmColor`, `WasmViewport`). This breaks the architectural boundary: consumers should interact through facade interfaces, not WASM types.

## Solution

Replace direct WASM imports in consumer tests and story files with facade factory calls (`canvasFactory`, `viewportFactory`). This is a mechanical import cleanup — no test doubles, no dependency injection refactoring, no behavioral changes.

For `set_pixel` calls (not on the `PixelCanvas` interface), use `restore_pixels` with a local helper or construct pixel arrays via `canvasFactory.fromPixels`.

### Target files

- `tool-runner.svelte.test.ts` — `WasmPixelCanvas`, `WasmColor` (unused)
- `canvas-interaction.svelte.test.ts` — `WasmViewport`
- `session-persistence.test.ts` — `WasmPixelCanvas`, `WasmColor`, `WasmViewport`
- `session.test.ts` — `WasmPixelCanvas`, `WasmColor`, `WasmViewport`
- `PixelCanvasView.stories.svelte` — `WasmPixelCanvas`, `WasmColor`, `WasmViewport`

### Not targeted

- `editor-state.svelte.test.ts` — already has no direct WASM import
- `wasm/*.test.ts` — test the WASM layer itself, direct imports are correct
- `wasm-sync.test.ts` — compile-time type guard, direct imports are its purpose

## Commits

### Commit 1: Migrate canvas test imports to facade factories

**tool-runner.svelte.test.ts:**

- Replace `import { WasmPixelCanvas, WasmColor } from '$wasm/dotorixel_wasm'` with imports from facade modules (`canvasFactory` from `wasm-backend`, `PixelCanvas` type from `pixel-canvas`)
- Replace all `new WasmPixelCanvas(w, h)` calls with `canvasFactory.create(w, h)`
- Change `WasmPixelCanvas` type annotations to `PixelCanvas` in helper functions (`createHost`, `createRunner`, `getPixel`)
- Remove unused `WasmColor` import

**canvas-interaction.svelte.test.ts:**

- Replace `import { WasmViewport } from '$wasm/dotorixel_wasm'` with `viewportFactory` import from `wasm-backend`
- Replace `WasmViewport.for_canvas(16, 16)` with `viewportFactory.forCanvas(16, 16)`

Run all tests to verify.

### Commit 2: Migrate session test imports to facade factories

**session-persistence.test.ts:**

- Replace `import { WasmPixelCanvas, WasmColor, WasmViewport } from '$wasm/dotorixel_wasm'` with facade imports (`canvasFactory`, `viewportFactory` from `wasm-backend`, `PixelCanvas` type, `Color` type)
- Remove the `wasmCanvas()` type guard helper (introduced as a stopgap in 024)
- Add a local `setPixel(canvas, x, y, color)` helper that reads `pixels()`, modifies the target offset, and calls `restore_pixels()`
- Replace all `new WasmColor(r, g, b, a)` + `wasmCanvas(...).set_pixel(x, y, color)` calls with `setPixel(canvas, x, y, { r, g, b, a })`
- Replace `new WasmViewport(ps, z, px, py)` with `viewportFactory.create(ps, z, px, py)`

**session.test.ts:**

- Apply the same pattern: remove `wasmCanvas()`, add local `setPixel` helper, replace WASM constructors with facade factories

Run all tests to verify.

### Commit 3: Migrate story file imports to facade factories

**PixelCanvasView.stories.svelte:**

- Replace `import { WasmPixelCanvas, WasmColor, WasmViewport } from '$wasm/dotorixel_wasm'` with facade imports (`canvasFactory`, `viewportFactory` from `wasm-backend`, `Color` type)
- Replace `WasmColor` constants with plain `Color` objects (`{ r, g, b, a }`)
- Replace `WasmViewport.for_canvas(w, h)` with `viewportFactory.forCanvas(w, h)`
- Replace `new WasmPixelCanvas(w, h)` with `canvasFactory.create(w, h)`
- Replace `WasmPixelCanvas.with_color(w, h, color)` with `canvasFactory.withColor(w, h, color)`
- Replace the checkerboard `set_pixel` loop: construct a `Uint8Array` pixel buffer with the checkerboard pattern, then create the canvas via `canvasFactory.fromPixels(w, h, pixels)`

Run Storybook to visually verify stories render correctly.

## Decision Document

### No test doubles or dependency injection

024's Out of Scope section proposed migrating to `MockPixelCanvas`, `mockDrawingOps`, etc. as a follow-up for "testing core logic without WASM." Re-evaluation found that WASM initialization has never caused test brittleness in practice — the "test brittleness" premise was theoretical. Test doubles would add complexity (DI refactoring, fake implementations, maintenance burden) without solving a real problem. Simple facade factory import cleanup achieves the architectural consistency goal with minimal cost.

### `set_pixel` replacement via `restore_pixels`

`PixelCanvas` intentionally excludes `set_pixel` (024 decision: all pixel mutations go through `DrawingOps`). Session tests used `set_pixel` for test setup via a `wasmCanvas()` type guard. The replacement is a local helper that reads `pixels()`, modifies bytes at the target offset, and calls `restore_pixels()`. This uses only `PixelCanvas` interface methods.

### Story checkerboard via `fromPixels` construction

The story file's checkerboard pattern currently uses a `set_pixel` loop on a `WasmPixelCanvas`. Replacing with direct `Uint8Array` construction + `canvasFactory.fromPixels()` is more declarative — build the data, then create the canvas in one call.

### `setPixel` helper is file-local, not shared

The helper appears in 2 session test files. At 6 lines each, duplication is preferable to a shared test utility. Consistent with the project's principle of avoiding premature abstractions.

### 024 "test doubles follow-up" is superseded

This issue replaces both todo.md items from 024's follow-up:
- "Migrate consumer tests to facade test doubles" → redefined as facade factory import cleanup
- "Migrate story files to facade factories" → merged into this single issue

## Testing Decisions

### No new tests needed

This is a non-behavioral refactor — import paths and type annotations change, but all runtime behavior is identical. The existing tests in each migrated file serve as the verification: they must pass unchanged after migration. Storybook visual check confirms story rendering.

### Verification after each commit

Each commit must leave all tests passing. Run `bun run test` after commits 1 and 2. Run Storybook after commit 3 to verify visual output.

### Prior art

024 itself followed this exact pattern — migrating production code imports file-by-file with tests passing after each commit.

## Out of Scope

### Dependency injection into `createToolRunner`, `EditorState`, or `Workspace`

DI was considered and rejected for this task. These modules still import from `wasm-backend` internally, which is the correct architectural pattern (consumers use facade, not WASM directly).

### WASM-free test execution

Tests still require WASM initialization via `setup.ts`. This is acceptable — the goal is architectural consistency (no direct `$wasm/dotorixel_wasm` imports in consumer code), not WASM isolation.

### `wasm/*.test.ts` and `wasm-sync.test.ts`

These files test the WASM layer itself. Direct WASM imports are correct and intentional.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tool-runner.svelte.test.ts` | `WasmPixelCanvas` → `canvasFactory.create()`, `PixelCanvas` type, unused `WasmColor` removed |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | `WasmViewport.for_canvas()` → `viewportFactory.forCanvas()` |
| `src/lib/session/session-persistence.test.ts` | `wasmCanvas()` helper removed, `setPixel()` helper via `restore_pixels`, `viewportFactory.create()` |
| `src/lib/session/session.test.ts` | Same pattern as session-persistence |
| `src/lib/canvas/PixelCanvasView.stories.svelte` | `WasmColor` → plain `Color`, checkerboard via `fromPixels`, `canvasFactory`/`viewportFactory` |

### Key Decisions

- 024's "test doubles follow-up" was re-evaluated and rejected: WASM initialization has never caused test brittleness in practice. Simple facade factory import cleanup achieves architectural consistency without the complexity of DI refactoring and fake implementations.
- `set_pixel` replacement in session tests uses `restore_pixels` with a local helper — a test-only pattern not used in production (where all pixel mutations go through `DrawingOps`).
- Two todo.md items ("consumer tests" + "story files") merged into one task since the scope is small and the changes are uniform.
