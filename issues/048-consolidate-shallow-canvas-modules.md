---
title: Consolidate shallow canvas type modules into canvas-model.ts / adapter-types.ts
status: done
created: 2026-04-10
---

## Problem

Six shallow files in `src/lib/canvas/` each contain only interface definitions or a single pure function. Their interfaces are nearly as complex as their implementations, and understanding one canvas concept requires navigating multiple tiny files:

- `canvas-types.ts` (18 LOC): `CanvasCoords`, `ResizeAnchor`
- `pixel-canvas.ts` (29 LOC): `PixelCanvas`, `Snapshot`
- `canvas-factory.ts` (17 LOC): `CanvasFactory`
- `canvas-constraints.ts` (7 LOC): `CanvasConstraints`
- `history.ts` (23 LOC): `HistoryManager`
- `blank-detection.ts` (4 LOC): `isBlankCanvas()`

The fragmentation creates navigability friction: "Where is `Snapshot` defined?" requires checking multiple files. Internal dependency chains (history → pixel-canvas, canvas-factory → pixel-canvas + canvas-types) add coupling complexity that a consolidated module would eliminate.

## Proposed Interface

Consolidate into 3 files based on consumer frequency:

### `canvas-model.ts` — primary import target

Domain types consumed by canvas internals and UI components (14+ consumers):

```typescript
import type { Color } from './color';

export interface CanvasCoords { readonly x: number; readonly y: number }
export type ResizeAnchor = 'top-left' | 'top-center' | ... | 'bottom-right'
export interface PixelCanvas { /* width, height, pixels, get_pixel, ... */ }
```

Usage:

```typescript
// Tool module
import type { CanvasCoords, PixelCanvas } from '$lib/canvas/canvas-model';

// UI component
import type { ResizeAnchor } from '$lib/canvas/canvas-model';
```

### `adapter-types.ts` — WASM boundary contracts

Interfaces only consumed by `wasm-backend.ts` and its tests, plus `Snapshot`:

```typescript
import type { PixelCanvas, ResizeAnchor } from './canvas-model';
import type { Color } from './color';

export interface Snapshot { /* width, height, pixels */ }
export interface CanvasFactory { /* create, fromPixels, withColor, resizeWithAnchor */ }
export interface CanvasConstraints { /* minDimension, maxDimension, isValidDimension, presets */ }
export interface HistoryManager { /* can_undo, can_redo, push_snapshot, undo, redo */ }
```

Usage:

```typescript
// wasm-backend.ts
import type { PixelCanvas } from './canvas-model';
import type { CanvasFactory, CanvasConstraints, HistoryManager } from './adapter-types';
```

### `blank-detection.ts` — unchanged

Single pure function, single consumer. No consolidation needed.

### Dependency graph

```text
canvas-model.ts  ←──  adapter-types.ts
color.ts         ←──  adapter-types.ts
color.ts         ←──  canvas-model.ts
                       (all one-directional, no cycles)
blank-detection.ts     (isolated)
```

## Commits

### Commit 1 (single atomic commit): Consolidate shallow canvas modules

This is a pure file reorganization with no runtime behavior change. All existing exports are preserved with identical signatures.

Steps within the commit:

1. **Create `canvas-model.ts`**: Copy `CanvasCoords` and `ResizeAnchor` from `canvas-types.ts`, copy `PixelCanvas` from `pixel-canvas.ts`. Add `import type { Color } from './color'` for `PixelCanvas.get_pixel` return type. Preserve all JSDoc comments.

2. **Create `adapter-types.ts`**: Copy `Snapshot` from `pixel-canvas.ts`, copy `CanvasFactory` from `canvas-factory.ts`, copy `CanvasConstraints` from `canvas-constraints.ts`, copy `HistoryManager` from `history.ts`. Add imports from `canvas-model.ts` and `color.ts`. Preserve all JSDoc comments.

3. **Update all consumers of `canvas-types.ts`** (9 .ts + 5 .svelte files): Replace `from './canvas-types'` or `from '$lib/canvas/canvas-types'` with `from './canvas-model'` or `from '$lib/canvas/canvas-model'`.

4. **Update all consumers of `pixel-canvas.ts`** (9 files): Replace `from './pixel-canvas'` or `from '$lib/canvas/pixel-canvas'` with the correct target — `PixelCanvas` imports go to `canvas-model`, `Snapshot` imports go to `adapter-types`.

5. **Update all consumers of `canvas-factory.ts`, `canvas-constraints.ts`, `history.ts`** (wasm-backend.ts + test files): Replace import paths to `adapter-types`.

6. **Delete the 5 original files**: `canvas-types.ts`, `pixel-canvas.ts`, `canvas-factory.ts`, `canvas-constraints.ts`, `history.ts`.

7. **Run the full test suite** to verify no import breakage.

## Decision Document

### File naming

`canvas-model.ts` instead of `types.ts`. The canvas module already has several type-defining files (`draw-tool.ts`, `drawing-ops.ts`, `color.ts`). A generic `types.ts` would create ambiguity about which types live where. `canvas-model.ts` clearly communicates "canvas data model types" and sits naturally alongside sibling files.

### Snapshot placement

`Snapshot` goes in `adapter-types.ts`, not `canvas-model.ts`. Current consumers are exclusively in the adapter layer (`history.ts` → being absorbed into `adapter-types.ts`, `wasm-sync.test.ts`). Following the Design 3 principle of organizing by consumer frequency, adapter-only types belong in the adapter file. If future consumers outside the adapter layer need `Snapshot`, promote it to `canvas-model.ts` at that time.

### blank-detection.ts unchanged

Stays as a separate file. `canvas-model.ts` is a type-only file; mixing in a runtime function would break that invariant. The function has a single consumer and 4 LOC — consolidation cost exceeds benefit.

### Import replacement strategy

All-at-once replacement in a single commit. No re-export intermediate step. The scope (14 consumers, all type imports) is small enough that a gradual migration would be overengineering. Re-export layers create temporary "which import path is correct?" confusion.

### Single commit

The entire consolidation is one atomic commit. Splitting into two commits (canvas-model first, adapter-types second) would require a re-export bridge because `canvas-factory.ts` depends on `pixel-canvas.ts` — conflicting with the no-re-export decision. Pure type reorganization has no meaningful intermediate state.

### Color import dependency

Both `canvas-model.ts` and `adapter-types.ts` import from `color.ts`. This is a natural intra-module dependency with no circular risk. No interface signatures are changed — `PixelCanvas.get_pixel(): Color` and `CanvasFactory.withColor(..., color: Color)` remain identical.

### Dependency category

In-process. All six files contain pure type definitions and one pure function. No I/O, no external dependencies. The consolidation is a file reorganization with no runtime behavior change.

## Testing Decisions

- **No new tests needed.** The consolidation changes only file organization and import paths. All type signatures remain identical. No runtime behavior is affected.
- **Existing tests are the verification.** The full test suite (`bun run test`) serves as the migration completeness check — any missed import path update will cause a compile/import error.
- **`blank-detection.test.ts` stays.** The file and its tests are unchanged.
- **No test files need deletion.** The 5 deleted source files (`canvas-types.ts`, `pixel-canvas.ts`, `canvas-factory.ts`, `canvas-constraints.ts`, `history.ts`) have no dedicated test files. They are type-only.

## Out of Scope

- **Interface signature changes.** No types are renamed, restructured, or have their members modified. This is a pure file reorganization.
- **`blank-detection.ts` consolidation.** Stays as a separate file per the decision above.
- **`draw-tool.ts`, `drawing-ops.ts`, `color.ts` reorganization.** These are not shallow modules — they contain substantial logic or multi-consumer interfaces and are not candidates for this consolidation.
- **Barrel/index file.** No `index.ts` is created. Direct file imports remain the project convention.
- **`export.ts` consolidation.** Contains runtime functions (DOM operations for file download), not type definitions. Different concern.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/canvas-model.ts` | New file: `CanvasCoords`, `ResizeAnchor`, `PixelCanvas` |
| `src/lib/canvas/adapter-types.ts` | New file: `Snapshot`, `CanvasFactory`, `CanvasConstraints`, `HistoryManager` |
| `src/lib/canvas/canvas-types.ts` | Deleted — absorbed into `canvas-model.ts` |
| `src/lib/canvas/pixel-canvas.ts` | Deleted — `PixelCanvas` → `canvas-model.ts`, `Snapshot` → `adapter-types.ts` |
| `src/lib/canvas/canvas-factory.ts` | Deleted — absorbed into `adapter-types.ts` |
| `src/lib/canvas/canvas-constraints.ts` | Deleted — absorbed into `adapter-types.ts` |
| `src/lib/canvas/history.ts` | Deleted — absorbed into `adapter-types.ts` |
| 15 consumer files | Import paths updated mechanically |
