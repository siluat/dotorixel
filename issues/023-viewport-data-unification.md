---
title: Unify viewport serialization — single type + centralized conversion
status: done
created: 2026-04-07
---

## Problem

Viewport data passes through three identical-but-separate type definitions and four manual field-extraction sites, creating fragile coupling between the WASM boundary and the persistence/rendering layers.

### Type duplication

Three interfaces share the exact same fields (`pixelSize`, `zoom`, `panX`, `panY`, `showGrid`, `gridColor`):

- `ViewportRecord` in `session-storage-types.ts` (persistence)
- `ViewportInit` in `workspace-init-types.ts` (restore)
- `RenderViewport` in `renderer.ts` (rendering, file-private)

Additionally, `RenderViewportSize` in `renderer.ts` duplicates `ViewportSize` in `view-types.ts`.

Adding or renaming a viewport field requires updating all three in sync. The compiler does not enforce consistency between them.

### Manual field extraction in 4 places

WasmViewport is a WASM class that cannot be spread or serialized. Its properties use snake_case (`pixel_size`, `pan_x`, `pan_y`), while TS uses camelCase. This mismatch forces manual field-by-field mapping at every extraction site:

1. `session-persistence.ts` save — WasmViewport getters to ViewportRecord
2. `workspace.svelte.ts` restore — ViewportInit to WasmViewport constructor
3. `editor-state.svelte.ts` renderViewport derived — WasmViewport getters to inline object
4. `renderer.ts` — defines its own RenderViewport interface identical to the others

If a field is added to WasmViewport, all 4 sites must be updated. The snake_case/camelCase translation at each site is error-prone and only caught at runtime.

### Missing round-trip coverage

The existing `session-persistence.test.ts` viewport round-trip test does not verify the `pixelSize` field, leaving a gap in serialization correctness.

## Solution

Introduce a single `ViewportData` type and two conversion functions that centralize all WASM↔plain-object translation in one place. The WASM boundary stays snake_case (consistent with wasm-bindgen ecosystem convention); the helper functions absorb the snake_case→camelCase mapping internally.

## Decision Document

### WASM boundary naming

The WASM API retains snake_case names. `js_name` is not applied. Rationale: wasm-bindgen has no automatic camelCase conversion, the ecosystem convention (official tutorial, photon-rs, etc.) is to accept snake_case on the JS side, and applying `js_name` manually to individual methods creates maintenance overhead with no `rename_all` bulk mechanism available. The helper functions encapsulate all snake_case access — after this refactor, no production code outside the two helper functions reads `pixel_size`, `pan_x`, or `pan_y` directly.

### serde-wasm-bindgen adoption deferred

The ecosystem's most common pattern for WASM class→plain object conversion is Rust-side serialization via serde-wasm-bindgen. However, the project currently has no serde dependency, and only two WASM types (WasmViewport, WasmColor) need plain-object conversion. Adding three crate dependencies (serde, serde-wasm-bindgen, tsify) for one 4-field struct is disproportionate. The `extractViewportData`/`restoreViewportState` interface is designed so that the internal implementation can later switch to serde-based serialization without changing any caller. Revisit when Milestone 3 "Project file format (JSON-based)" requires multi-type Rust↔JSON↔TS conversion.

### ViewportData type and helper functions live in view-types.ts

`view-types.ts` already defines `ViewportState` and imports `WasmViewport` as a type. Adding `ViewportData` (the plain-object counterpart of `ViewportState`) and two conversion functions (~15 lines) keeps viewport-related definitions co-located. The file remains small (~45 lines total). A value import of `WasmViewport` is added for the constructor call in `restoreViewportState`.

### DEFAULT_VIEWPORT stays in session-persistence.ts

The constant has only one consumer (the `restore()` fallback). Moving it to `view-types.ts` would export it without a clear second use site. Only its type annotation changes from `ViewportInit` to `ViewportData`.

### renderer.ts gains type-only imports from view-types.ts

`RenderViewport` is replaced by `ViewportData` and `RenderViewportSize` is replaced by `ViewportSize`. Both are `import type` — no runtime dependency added. The local `RenderableCanvas` interface is intentionally kept: it is a minimal dependency interface (depend on interfaces, not implementations), not a duplication of `WasmPixelCanvas`.

### Dependency graph after change

```text
view-types.ts (ViewportData, ViewportState, extractViewportData, restoreViewportState)
  ├── session-persistence.ts   (import extractViewportData)
  ├── workspace.svelte.ts      (import restoreViewportState)
  ├── editor-state.svelte.ts   (import extractViewportData)
  ├── renderer.ts              (import type ViewportData, ViewportSize)
  ├── session-storage-types.ts (import type ViewportData — replaces ViewportRecord)
  └── workspace-init-types.ts  (import type ViewportData — replaces ViewportInit)
```

No circular dependencies introduced.

## Commits

### Commit 1: Add ViewportData type and conversion functions with tests

Add to `view-types.ts`:
- `ViewportData` interface with all 6 readonly fields (`pixelSize`, `zoom`, `panX`, `panY`, `showGrid`, `gridColor`)
- `extractViewportData(state: ViewportState): ViewportData` — reads WasmViewport snake_case getters and ViewportState grid fields, returns a flat camelCase plain object
- `restoreViewportState(data: ViewportData): ViewportState` — constructs a WasmViewport from ViewportData fields and assembles a ViewportState

Add `view-types.test.ts`:
- Round-trip test: `extractViewportData(restoreViewportState(data))` deep-equals original data for all 6 fields
- Verify each field individually to catch field-mapping errors

No existing code is modified. All tests pass.

### Commit 2: Replace ViewportRecord with ViewportData in persistence layer

- In `session-storage-types.ts`: delete `ViewportRecord` interface, import `ViewportData` from `view-types.ts`, update `WorkspaceRecord.viewports` type to `Record<string, ViewportData>`
- In `session-persistence.ts`: replace the 6-line inline field extraction in `save()` with `extractViewportData(editor.viewportState)`. Update `DEFAULT_VIEWPORT` type annotation from `ViewportInit` to `ViewportData`.

All existing `session-persistence.test.ts` and `session.test.ts` tests pass without modification (they now exercise `extractViewportData` indirectly).

### Commit 3: Replace ViewportInit with ViewportData in workspace restore

- In `workspace-init-types.ts`: delete `ViewportInit` interface, import `ViewportData` from `view-types.ts`, update `TabInit.viewport` type to `ViewportData`
- In `workspace.svelte.ts`: replace the manual `new WasmViewport(...)` + grid field assembly in `#initFromSaved` with `restoreViewportState(tab.viewport)`

All tests pass.

### Commit 4: Apply extractViewportData to editor-state renderViewport

- In `editor-state.svelte.ts`: replace the 6-line inline object literal in the `renderViewport` `$derived` with `extractViewportData(this.viewportState)`. Add import.

All tests pass. The `renderViewport` shape is unchanged — callers (renderer, PixelCanvasView) see no difference.

### Commit 5: Replace renderer local interfaces with shared types

- In `renderer.ts`: delete the local `RenderViewport` interface, import `ViewportData` from `view-types.ts`. Delete the local `RenderViewportSize` interface, import `ViewportSize` from `view-types.ts`. Update all function signatures that referenced these local types. Keep `RenderableCanvas` as-is (intentional minimal interface).

All tests pass.

## Testing Decisions

### What makes a good test here

Tests should verify the **observable behavior** of the conversion boundary: given a `ViewportData` plain object, does the round-trip through `restoreViewportState` → `extractViewportData` produce an identical plain object? Tests should not depend on internal field order, the specific WasmViewport constructor signature, or the snake_case property names — those are implementation details hidden by the functions.

### New tests

- `view-types.test.ts`: round-trip test covering all 6 fields with non-default values (to catch zero/default masking). This is the primary boundary test for the conversion functions.

### Existing tests

- `session-persistence.test.ts` and `session.test.ts` continue to pass and now implicitly exercise the helper functions through the save/restore pipeline. No modifications needed to these test files.

### Prior art

- `session-persistence.test.ts` uses the same `fake-indexeddb/auto` + `WasmViewport` setup pattern. The new `view-types.test.ts` follows the same WASM import and assertion style.

## Out of Scope

- **`js_name` on WasmViewport**: WASM boundary stays snake_case. Ecosystem convention; helper functions absorb the translation.
- **serde-wasm-bindgen / tsify adoption**: Deferred to Milestone 3 project file format. A review item is tracked in `tasks/todo.md`.
- **`RenderableCanvas` interface in renderer.ts**: Intentional minimal-dependency interface, not a type duplication.
- **`DEFAULT_VIEWPORT` relocation**: Stays in `session-persistence.ts` (single consumer).
- **`WasmColor` → `Color` conversion centralization**: Similar pattern but low pain (few use sites). Can be addressed independently if needed.
- **File rename of `view-types.ts`**: The file contains non-viewport types (`CanvasCoords`, `ResizeAnchor`) that are appropriately co-located at current scale. Renaming is not warranted.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/view-types.ts` | Added `ViewportData` interface and `extractViewportData`/`restoreViewportState` conversion functions |
| `src/lib/canvas/view-types.test.ts` | New round-trip unit tests for ViewportData conversion (3 tests) |
| `src/lib/session/session-storage-types.ts` | Replaced `ViewportRecord` with `ViewportData` import |
| `src/lib/session/workspace-init-types.ts` | Replaced `ViewportInit` with `ViewportData` import |
| `src/lib/session/session-persistence.ts` | Inline extraction replaced with `extractViewportData()` call |
| `src/lib/canvas/workspace.svelte.ts` | Manual WasmViewport construction replaced with `restoreViewportState()` |
| `src/lib/canvas/editor-state.svelte.ts` | `renderViewport` derived uses `extractViewportData()` |
| `src/lib/canvas/renderer.ts` | `RenderViewport` and `RenderViewportSize` replaced with shared types |

### Key Decisions
- No `js_name` on WASM boundary — snake_case retained per wasm-bindgen ecosystem convention; helper functions absorb the translation
- serde-wasm-bindgen deferred — review item added to todo.md at Milestone 3 project file format
- `DEFAULT_VIEWPORT` stays in session-persistence.ts (single consumer)
- `RenderableCanvas` kept as intentional minimal-dependency interface
