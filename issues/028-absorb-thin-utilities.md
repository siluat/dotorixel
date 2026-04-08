---
title: Absorb single-consumer utility modules into their callers
status: done
created: 2026-04-08
---

## Problem

Two utility modules exist as separate files despite having exactly one consumer each:

- `constrain.ts` (38 LOC, 2 functions) — consumed only by `tool-runner.svelte.ts`
- `shift-pixels.ts` (33 LOC, 1 function) — consumed only by `tools/move-tool.ts`

Both were extracted for testability, but the extraction creates file-level separation without encapsulation. Understanding the tool system requires jumping into these satellite files for what are effectively private implementation details of their consumers. This adds navigational friction without architectural benefit.

## Proposed Interface

No new interface — this is a consolidation refactor. The functions retain their signatures and remain exported (for testability), but move into the consumer module that uses them.

**constrain functions → tool-runner.svelte.ts:**

```typescript
// Exported from tool-runner.svelte.ts for testability
export function constrainLine(start: CanvasCoords, end: CanvasCoords): CanvasCoords { ... }
export function constrainSquare(start: CanvasCoords, end: CanvasCoords): CanvasCoords { ... }

// Usage unchanged:
line: createShapeTool(ops, 'line', ops.interpolatePixels, constrainLine),
rectangle: createShapeTool(ops, 'rectangle', ops.rectangleOutline, constrainSquare),
ellipse: createShapeTool(ops, 'ellipse', ops.ellipseOutline, constrainSquare),
```

**shiftPixels → tools/move-tool.ts:**

```typescript
// Exported from move-tool.ts for testability
export function shiftPixels(source: Uint8Array, width: number, height: number, dx: number, dy: number): Uint8Array { ... }

// Usage unchanged:
const shifted = shiftPixels(snapshot, ctx.canvas.width, ctx.canvas.height, dx, dy);
```

## Commits

### Commit 1: Inline constrain functions into tool-runner

Move `constrainLine` and `constrainSquare` function bodies into `tool-runner.svelte.ts`. Keep them exported so existing tests continue to pass. Update tool-runner's import to remove the `constrain.ts` reference. Do not delete the old files yet — `constrain.test.ts` still imports from `constrain.ts`, so both test files pass independently.

Verification: run all tests — both `constrain.test.ts` (unchanged) and `tool-runner.svelte.test.ts` (unchanged) pass.

### Commit 2: Relocate constrain tests and delete constrain files

Move all test cases from `constrain.test.ts` into `tool-runner.svelte.test.ts` as `describe('constrainLine')` and `describe('constrainSquare')` blocks. Update imports to reference `tool-runner.svelte` instead of `constrain`. Delete `constrain.ts` and `constrain.test.ts`.

Verification: run all tests — the 15 constrain cases now live in `tool-runner.svelte.test.ts` and pass.

### Commit 3: Inline shiftPixels into move-tool

Move the `shiftPixels` function body into `tools/move-tool.ts`. Keep it exported for testability. Remove the import from `shift-pixels.ts`. Do not delete the old files yet.

Verification: run all tests — both `shift-pixels.test.ts` (unchanged) and `tool-runner.svelte.test.ts` (move tool integration tests) pass.

### Commit 4: Relocate shift-pixels tests and delete shift-pixels files

Create `tools/move-tool.test.ts` with the 9 test cases from `shift-pixels.test.ts` under a `describe('shiftPixels')` block. Include the helper functions (`createBuffer`, `setPixel`, `getPixel`) in the new test file. Update imports to reference `move-tool` instead of `shift-pixels`. Delete `shift-pixels.ts` and `shift-pixels.test.ts`.

Verification: run all tests — the 9 shiftPixels cases now live in `tools/move-tool.test.ts` and pass.

## Decision Document

- **Export vs. private**: Functions remain exported from their new locations. The co-location benefit (reduced file count, related code together) is the primary gain. Access restriction is not a goal — these are pure functions whose unit tests (15 + 9 = 24 cases) cover edge cases that the 2 integration tests in tool-runner don't fully cover (8-directional snapping, all clipping variants).
- **Dependency strategy**: In-process — pure computation with no I/O or external dependencies. Direct merge into consumers.
- **No re-exports**: Consumers import directly from the new location. No backward-compatible re-exports from old paths.
- **Re-extraction trigger**: If a second consumer appears in the future, extract back to a shared module. One consumer = co-located; two consumers = shared.

## Testing Decisions

- **Preserve, don't rewrite.** The existing 24 test cases are moved verbatim — only import paths change. No new test logic is needed.
- **Constrain tests** (15 cases) move into `tool-runner.svelte.test.ts` as separate `describe` blocks. This file already contains integration tests for shift constraint behavior (2 cases), which remain untouched.
- **Shift-pixels tests** (9 cases) move into a new `tools/move-tool.test.ts`. This file is new because no `move-tool.test.ts` exists yet.
- **Good test criteria**: Each test asserts on a single pure-function input/output pair. These are algorithmic edge cases (diagonal snapping, off-canvas clipping) that serve as regression defense per the project's testing guidelines.
- **Prior art**: The test style matches existing pure-function tests in the codebase (e.g., `color.test.ts`, `canvas-constraints.test.ts`).

## Out of Scope

- **color.ts**: Also a thin utility, but has 12+ consumers. Not a single-consumer module — different treatment needed.
- **Tool behavior changes**: No functional changes to constrain or shift-pixels logic.
- **Test coverage expansion**: No new test cases beyond what already exists. Coverage gaps (e.g., diagonal clipping in constrain) can be addressed separately.
- **Barrel exports or index files**: No module re-export changes outside the directly affected files.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tool-runner.svelte.ts` | Inlined `constrainLine` and `constrainSquare` as exported functions |
| `src/lib/canvas/tool-runner.svelte.test.ts` | Added 15 constrain test cases (10 constrainLine + 5 constrainSquare) |
| `src/lib/canvas/tools/move-tool.ts` | Inlined `shiftPixels` as an exported function |
| `src/lib/canvas/tools/move-tool.test.ts` | Created with 9 shiftPixels test cases |
| `src/lib/canvas/constrain.ts` | Deleted |
| `src/lib/canvas/constrain.test.ts` | Deleted |
| `src/lib/canvas/shift-pixels.ts` | Deleted |
| `src/lib/canvas/shift-pixels.test.ts` | Deleted |

### Key Decisions

- Functions remain exported from their new locations for testability. The co-location benefit (4 files removed) is the primary gain, not access restriction.

### Notes

- Total test count unchanged (449). Git detected shift-pixels.test.ts → tools/move-tool.test.ts as a rename (98% similarity), preserving file history.
