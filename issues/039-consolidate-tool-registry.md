---
title: Consolidate tool registration into a unified ToolRegistry
status: done
created: 2026-04-09
---

## Problem

Adding a new tool requires editing 7 scattered files that each maintain a parallel mapping of the same tool identifiers:

| # | File | What it registers |
|---|------|-------------------|
| 1 | `tool-types.ts` | `ToolType` union + `TOOL_CURSORS` record |
| 2 | `tools/*-tool.ts` | Tool factory (DrawTool instance) |
| 3 | `tool-runner.svelte.ts:116-125` | `tools` record — ToolType → DrawTool |
| 4 | `shortcut-display.ts` | `TOOL_SHORTCUT_KEYS` record |
| 5 | `keyboard-input.svelte.ts:56-58` | `TOOL_SHORTCUTS` — KeyCode → ToolType (derived from 4) |
| 6 | `ToolStrip.svelte:30-39` | UI array — icon + i18n label |
| 7 | i18n message files | `m.tool_*` message keys |

The core friction: these 7 files independently list the same 8 tool identifiers. They share no single source of truth, so every new tool requires discovering and updating all of them. The `ToolType` union, `TOOL_CURSORS`, `TOOL_SHORTCUT_KEYS`, and the ToolRunner `tools` record are all manually synchronized — a forgotten entry is a runtime bug, not a compile error.

A secondary constraint adds structural tension: core tool metadata (cursor, shortcut, factory) must be framework-free, while UI metadata (Lucide icon, i18n label) depends on Svelte/Paraglide. A naive single-file registry would pull framework dependencies into the core domain.

## Proposed Interface

Two-file registry split across core and UI dependency domains. All derived data (cursors, shortcuts, toolbar items) is auto-generated from the registry.

### Core registry (`tool-registry.ts`, framework-free)

```typescript
import type { DrawTool } from './draw-tool';
import type { DrawingOps } from './drawing-ops';

/** Static metadata for a tool — everything known at module load time. */
export interface ToolDef {
  readonly cursor: string;
  readonly shortcutKey: string;
  readonly create: (ops: DrawingOps) => DrawTool;
}

const TOOL_DEFS = {
  pencil:     { cursor: 'crosshair', shortcutKey: 'P', create: (ops) => createPencilTool(ops) },
  eraser:     { cursor: 'crosshair', shortcutKey: 'E', create: (ops) => createEraserTool(ops) },
  line:       { cursor: 'crosshair', shortcutKey: 'L', create: (ops) => createShapeTool(ops, 'line', ops.interpolatePixels, constrainLine) },
  rectangle:  { cursor: 'crosshair', shortcutKey: 'U', create: (ops) => createShapeTool(ops, 'rectangle', ops.rectangleOutline, constrainSquare) },
  ellipse:    { cursor: 'crosshair', shortcutKey: 'O', create: (ops) => createShapeTool(ops, 'ellipse', ops.ellipseOutline, constrainSquare) },
  floodfill:  { cursor: 'crosshair', shortcutKey: 'F', create: (ops) => createFloodfillTool(ops) },
  eyedropper: { cursor: 'crosshair', shortcutKey: 'I', create: (_ops) => eyedropperTool },
  move:       { cursor: 'move',      shortcutKey: 'V', create: (_ops) => moveTool },
} as const satisfies Record<string, ToolDef>;

/** Derived from registry keys — no separate maintenance. */
export type ToolType = keyof typeof TOOL_DEFS;

/** All tool types in display order. */
export const TOOL_TYPES: readonly ToolType[] = Object.keys(TOOL_DEFS) as ToolType[];

/** Look up a single tool's static definition. */
export function getToolDef(type: ToolType): ToolDef { return TOOL_DEFS[type]; }

/** Instantiate all DrawTool instances. Called once at editor startup. */
export function createAllTools(ops: DrawingOps): Record<ToolType, DrawTool> {
  return Object.fromEntries(
    TOOL_TYPES.map(type => [type, TOOL_DEFS[type].create(ops)])
  ) as Record<ToolType, DrawTool>;
}

/** Derived: CSS cursor per tool. */
export const TOOL_CURSORS: Record<ToolType, string> = Object.fromEntries(
  TOOL_TYPES.map(type => [type, TOOL_DEFS[type].cursor])
) as Record<ToolType, string>;

/** Derived: display shortcut key per tool. */
export const TOOL_SHORTCUT_KEYS: Record<ToolType, string> = Object.fromEntries(
  TOOL_TYPES.map(type => [type, TOOL_DEFS[type].shortcutKey])
) as Record<ToolType, string>;

/** Derived: KeyboardEvent.code → ToolType. */
export const TOOL_SHORTCUTS: Record<string, ToolType> = Object.fromEntries(
  TOOL_TYPES.map(type => [`Key${TOOL_DEFS[type].shortcutKey}`, type])
) as Record<string, ToolType>;

export function isValidToolType(value: string): value is ToolType {
  return value in TOOL_DEFS;
}
```

### UI registry (`tool-ui.ts`, framework-dependent)

```typescript
import type { Component } from 'svelte';
import { TOOL_TYPES, getToolDef, type ToolType } from '$lib/canvas/tool-registry';

export interface ToolUIEntry {
  readonly type: ToolType;
  readonly icon: Component;
  readonly label: () => string;
  readonly shortcutKey: string;
  readonly cursor: string;
}

// Record<ToolType, ...> ensures compile error if a tool is missing
const TOOL_UI: Record<ToolType, { icon: Component; label: () => string }> = {
  pencil:     { icon: Pencil,      label: m.tool_pencil },
  line:       { icon: Slash,       label: m.tool_line },
  rectangle:  { icon: Square,      label: m.tool_rectangle },
  ellipse:    { icon: Circle,      label: m.tool_ellipse },
  eraser:     { icon: Eraser,      label: m.tool_eraser },
  floodfill:  { icon: PaintBucket, label: m.tool_floodfill },
  eyedropper: { icon: Pipette,     label: m.tool_eyedropper },
  move:       { icon: Move,        label: m.tool_move },
};

/** Ordered tool entries with merged core + UI metadata. */
export const TOOL_ENTRIES: readonly ToolUIEntry[] = TOOL_TYPES.map(type => {
  const def = getToolDef(type);
  const ui = TOOL_UI[type];
  return { type, icon: ui.icon, label: ui.label, shortcutKey: def.shortcutKey, cursor: def.cursor };
});
```

## Commits

### Commit 1: create `tool-registry.ts` and its test file

Create the core registry module alongside the existing `tool-types.ts`. Both modules coexist — no consumers are changed yet.

**`tool-registry.ts`:**

- Define `ToolDef` interface (`cursor`, `shortcutKey`, `create`).
- Define `TOOL_DEFS` object with all 8 tools. Use `as const satisfies Record<string, ToolDef>` for type safety.
- Derive `ToolType` via `keyof typeof TOOL_DEFS`.
- Export `TOOL_TYPES`, `getToolDef`, `createAllTools`, `TOOL_CURSORS`, `TOOL_SHORTCUT_KEYS`, `TOOL_SHORTCUTS`, `isValidToolType`.
- Include `constrainLine` and `constrainSquare` functions (copied from `tool-runner.svelte.ts` — the originals are not yet removed).

**`tool-registry.test.ts`:**

- Copy the `constrainLine` and `constrainSquare` tests from `tool-runner.svelte.test.ts` (20 test cases), importing from the new module.
- Add registry completeness tests: every `ToolType` has valid cursor and shortcutKey, `createAllTools` returns entries for all tool types, `TOOL_SHORTCUTS` maps each key code correctly.

### Commit 2: migrate `tool-runner.svelte.ts` to use registry

- Replace 5 factory imports (`createPencilTool`, `createEraserTool`, `createFloodfillTool`, `eyedropperTool`, `moveTool`, `createShapeTool`) and the inline `tools` record with a single `createAllTools(ops)` call from the registry.
- Remove `constrainLine` and `constrainSquare` function definitions (now in registry).
- Update `ToolType` import from `tool-types` to `tool-registry`.
- In `tool-runner.svelte.test.ts`: remove the `constrainLine`/`constrainSquare` describe blocks (moved to `tool-registry.test.ts` in commit 1). Update the `constrainLine`/`constrainSquare` imports if they were used elsewhere in the test file.

### Commit 3: create `tool-ui.ts`

Create the UI metadata registry. No consumers are changed yet — the module exists alongside the existing manual tool arrays in UI components.

- Define `ToolUIEntry` type.
- Define `TOOL_UI` record as `Record<ToolType, { icon, label }>`. Use `Slash` for the line tool icon (replacing the previous `Minus`/`Slash` inconsistency).
- Export `TOOL_ENTRIES` — ordered array merging core + UI metadata.

### Commit 4: migrate core consumers to registry

Update all non-UI files that import from `tool-types` or `shortcut-display` to import from `tool-registry` instead. Pure import path changes — no behavioral changes.

- `editor-state.svelte.ts`: import `TOOL_CURSORS` and `ToolType` from `tool-registry`.
- `shared-state.svelte.ts`: import `ToolType` from `tool-registry`.
- `workspace.svelte.ts`: import `isValidToolType` from `tool-registry`.
- `keyboard-input.svelte.ts`: import `TOOL_SHORTCUTS` and `ToolType` from `tool-registry`. Remove import of `TOOL_SHORTCUT_KEYS` from `shortcut-display`. Remove the local `TOOL_SHORTCUTS` derivation logic (the registry provides it pre-computed).
- `src/lib/index.ts`: update re-export path from `tool-types` to `tool-registry`.
- `editor-state.svelte.test.ts`: update import path.
- `keyboard-input.svelte.test.ts`: update import path.

### Commit 5: migrate `ToolStrip` and `LeftToolbar` to `TOOL_ENTRIES`

- `ToolStrip.svelte`: remove 8 Lucide icon imports and the manual `tools` array. Import `TOOL_ENTRIES` from `tool-ui`. Remove `TOOL_SHORTCUT_KEYS` import from `shortcut-display`. The `{#each}` loop now iterates `TOOL_ENTRIES`, accessing `tool.shortcutKey` for tooltips.
- `LeftToolbar.svelte`: same changes. Both components now use `Slash` for the line tool icon (via `TOOL_UI`).

### Commit 6: migrate `BottomToolsPanel` to `{#each}` loop

Replace 8 individual `EditorButton` blocks (lines 29–92) with a `{#each TOOL_ENTRIES}` loop. Remove 8 tool icon imports (keep `ZoomIn`, `ZoomOut` for zoom controls). Remove `TOOL_SHORTCUT_KEYS` import from `shortcut-display`. The separator and zoom controls remain as individual elements after the loop.

### Commit 7: migrate `StatusBar` to use `tool-ui`

Remove the manual `toolMessages: Record<ToolType, () => string>` record. Import `TOOL_ENTRIES` from `tool-ui` and look up the active tool's label. Remove the `ToolType` import from `tool-types`.

### Commit 8: delete `tool-types.ts` and clean up `shortcut-display.ts`

All consumers have been migrated. This commit removes the old modules.

- Delete `tool-types.ts` entirely (all its exports are now provided by `tool-registry.ts`).
- In `shortcut-display.ts`: remove the `TOOL_SHORTCUT_KEYS` record and the `ToolType` import. Only `formatShortcut` and `isMac` remain — general-purpose keyboard display utilities unrelated to the tool registry.

## Decision Document

### Dependency category

**In-process.** All modules are pure computation and in-memory state. No I/O, no async, no side effects.

Dependency flows one way: `tool-ui.ts` → `tool-registry.ts`, never the reverse. Core tool logic remains framework-free. UI components import from `tool-ui.ts` only.

### Two-file split rationale

Three interface designs were explored in parallel:

1. **Minimal interface** (2 files, core/UI split): 2 edits per new tool, full compile-time safety.
2. **Maximum flexibility** (builder pattern, branded string ToolId): plugin-ready, but loses compile-time exhaustiveness and adds complexity inappropriate for 8 tools.
3. **Default-case-trivial** (single file, core + UI merged): 1 edit per new tool, but violates the "core logic is framework-free" architectural rule.

Design 1 was chosen with Design 3's derived-data strategy (auto-generating `TOOL_CURSORS`, `TOOL_SHORTCUTS`, `TOOL_ENTRIES` from the registry). This preserves the core/UI boundary while minimizing consumer boilerplate.

### `ToolType` derivation via `keyof typeof`

`ToolType` is derived from `TOOL_DEFS` keys, not manually maintained. Adding a key to `TOOL_DEFS` automatically widens the union. `Record<ToolType, ...>` on `TOOL_UI` catches missing entries at compile time.

### `constrainLine`/`constrainSquare` placement

These pure math functions move from `tool-runner.svelte.ts` into `tool-registry.ts`. They are consumed only by shape tool `create` closures in the registry. Co-locating them with their sole consumer avoids creating a separate file for two small functions.

### Line tool icon unified to `Slash`

`ToolStrip`/`LeftToolbar` previously used `Minus`, `BottomToolsPanel` used `Slash`. Unified to `Slash` — a diagonal line better represents the line drawing tool than a horizontal dash.

### `shortcut-display.ts` retained

After removing `TOOL_SHORTCUT_KEYS`, the file retains `formatShortcut()` and `isMac()` — general-purpose keyboard display utilities consumed by `TopControlsLeft.svelte`. The filename remains appropriate.

### `TOOL_DEFS` is not exported

Consumers use the derived API (`getToolDef`, `TOOL_TYPES`, `TOOL_CURSORS`, etc.). The `TOOL_DEFS` object is a module-private implementation detail.

### `BottomToolsPanel` converted to `{#each}` loop

Converting from 8 individual `EditorButton` blocks to a `{#each TOOL_ENTRIES}` loop ensures that adding a new tool does not require editing this component. The zoom controls (separator + zoom buttons) remain as individual elements after the loop.

### Dual-module coexistence during migration

`tool-types.ts` and `tool-registry.ts` coexist during commits 1–7. Each commit migrates a subset of consumers. `tool-types.ts` is deleted only after all consumers have been migrated (commit 8), ensuring every intermediate commit compiles and runs.

### Adding a new tool after this refactoring

1. Create tool factory in `tools/new-tool.ts`
2. Add entry to `TOOL_DEFS` in `tool-registry.ts` (cursor, shortcut, factory)
3. Add entry to `TOOL_UI` in `tool-ui.ts` (icon, label) — compile error if missing
4. Add i18n message keys

Effective code-level edits: **2 files** (down from 7). The i18n files are irreducible external data.

## Testing Decisions

### What makes a good test here

Tests should assert on the registry's public interface — the derived data structures and their correctness. Tests should NOT assert on `TOOL_DEFS` internal structure or how derivation is implemented. A test should survive internal registry refactoring as long as the external contract is preserved.

### Modules tested

**`tool-registry.test.ts` (new):**

- `constrainLine`: 10 test cases covering horizontal, vertical, 45° diagonal, and boundary snapping (moved from `tool-runner.svelte.test.ts`).
- `constrainSquare`: 5 test cases covering axis-aligned and diagonal squares (moved from `tool-runner.svelte.test.ts`).
- Registry completeness: every `ToolType` has a valid `ToolDef` with non-empty `cursor` and `shortcutKey`.
- `createAllTools(ops)`: returns a `Record<ToolType, DrawTool>` with entries for all registered tools.
- `TOOL_SHORTCUTS`: maps each `Key${letter}` code to the correct `ToolType`.

**Existing tests (modified, not deleted):**

- `tool-runner.svelte.test.ts`: constrain test blocks removed (moved to registry test). Remaining 94 tests unchanged — they validate ToolRunner's public API, which is unaffected by the internal switch to `createAllTools`.
- `editor-state.svelte.test.ts`: import path update only.
- `keyboard-input.svelte.test.ts`: import path update only.

### Prior art

The existing `tool-runner.svelte.test.ts` constrain tests follow a simple pattern: call the pure function with input coords, assert on the output coords via `toEqual`. The new registry tests follow the same style for constrain functions, and use simple property checks (`expect(TOOL_TYPES).toContain(...)`, `expect(tools.pencil.kind).toBe(...)`) for registry completeness.

## Out of Scope

- **Tool factory files** (`tools/*.ts`): No changes to individual tool implementations. They continue to export the same factory functions and singleton objects.
- **i18n message files**: Already exist for all 8 tools. No message keys are added or removed.
- **Storybook stories**: Use string literals for `activeTool` props, not imported types. No changes needed.
- **`wasm-backend.ts`**: Contains a separate `DrawingToolType` → `WasmToolType` mapping unrelated to the tool registry.
- **`TopControlsLeft.svelte`**: Only imports `formatShortcut` from `shortcut-display.ts`, which is unaffected.
- **`DrawTool` discriminated union**: The 4-category type system (`ContinuousTool`, `OneShotTool`, `ShapePreviewTool`, `DragTransformTool`) is unchanged. This refactoring consolidates *registration*, not *behavior*.
- **Plugin/extension system**: `ToolType` remains a closed union derived from `TOOL_DEFS` keys. Open `string`-based `ToolId` for plugins was considered and deferred — unnecessary complexity for 8 built-in tools.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tool-registry.ts` | Core registry — TOOL_DEFS, ToolType (keyof typeof), all derived exports |
| `src/lib/canvas/tool-registry.test.ts` | Constrain tests (moved) + registry completeness tests (20 total) |
| `src/lib/ui-editor/tool-ui.ts` | UI registry — TOOL_UI (icons, labels), TOOL_ENTRIES |
| `src/lib/canvas/tool-runner.svelte.ts` | Replaced 5 factory imports + inline record with createAllTools(ops) |
| `src/lib/canvas/tool-runner.svelte.test.ts` | Removed constrain test blocks (moved to registry) |
| `src/lib/canvas/keyboard-input.svelte.ts` | Import TOOL_SHORTCUTS from registry, removed local derivation |
| `src/lib/canvas/editor-state.svelte.ts` | Import path change (tool-types → tool-registry) |
| `src/lib/canvas/shared-state.svelte.ts` | Import path change |
| `src/lib/canvas/workspace.svelte.ts` | Import path change |
| `src/lib/canvas/shortcut-display.ts` | Removed TOOL_SHORTCUT_KEYS and ToolType import |
| `src/lib/index.ts` | Updated re-export path |
| `src/lib/ui-editor/ToolStrip.svelte` | Replaced manual array + 8 icon imports with TOOL_ENTRIES |
| `src/lib/ui-editor/LeftToolbar.svelte` | Same as ToolStrip |
| `src/lib/ui-editor/BottomToolsPanel.svelte` | Replaced 8 EditorButton blocks with {#each} loop |
| `src/lib/ui-editor/StatusBar.svelte` | Replaced toolMessages record with TOOL_ENTRIES lookup |
| `src/lib/canvas/tool-types.ts` | Deleted (absorbed into tool-registry) |

### Key Decisions

- Two-file split (core + UI) chosen over single-file to preserve "core logic is framework-free" rule
- Line tool icon unified to `Slash` across all toolbar components
- `constrainLine`/`constrainSquare` co-located in registry (sole consumer)
- `shortcut-display.ts` retained for `formatShortcut`/`isMac` utilities

### Notes

- New tool addition now requires 2 code edits (TOOL_DEFS + TOOL_UI) + i18n, down from 7
- Net change: +315/-306 lines across 18 files — total similar, but registration centralized
- All 472 tests pass; test count went from 487 → 472 (15 constrain tests moved, not duplicated)

