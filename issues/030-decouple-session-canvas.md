---
title: Decouple session persistence from canvas domain types
status: done
created: 2026-04-08
---

## Problem

The session module (persistence layer) has bidirectional coupling with the canvas module (domain layer):

**Session → Canvas** (6 import paths):

- `session-storage-types.ts` imports `ToolType`, `Color`, `ViewportData`
- `workspace-init-types.ts` imports `ToolType`, `Color`, `ViewportData`
- `session-persistence.ts` imports `Workspace` class and `ViewportData`
- `auto-save.ts` imports `Workspace` class
- `session.ts` imports `Workspace` class and `Color`

**Canvas → Session** (reverse dependency):

- `workspace.svelte.ts` imports `WorkspaceInit` from `session/workspace-init-types`

This creates architectural friction:

1. **Persistence layer depends on domain internals.** `SessionPersistence.save()` directly traverses `workspace.tabs`, `editor.pixelCanvas.width`, `editor.pixelCanvas.pixels()`, `editor.viewport` — the full internal structure of `Workspace` and `EditorState`.
2. **Bidirectional coupling.** Canvas imports session types for initialization, session imports canvas types for storage — neither module can evolve independently.
3. **Test isolation impossible.** Session tests must instantiate real `Workspace` objects (which pull in WASM backend) to test save/restore round-trips.
4. **Schema fragility.** If `ViewportData` gains a field or `ToolType` gains a variant, both the domain type and the storage schema are affected simultaneously.

## Proposed Interface

### Core idea: Workspace produces plain-data snapshots, session consumes plain data

**Canvas side** — new snapshot types with `sharedState` nesting (matching IndexedDB schema):

```typescript
// canvas/workspace-snapshot.ts — zero session imports

export interface WorkspaceSnapshot {
  readonly tabs: TabSnapshot[];
  readonly activeTabIndex: number;
  readonly sharedState: {
    readonly activeTool: string;
    readonly foregroundColor: { r: number; g: number; b: number; a: number };
    readonly backgroundColor: { r: number; g: number; b: number; a: number };
    readonly recentColors: string[];
  };
}

export interface TabSnapshot {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
  readonly viewport: {
    readonly pixelSize: number;
    readonly zoom: number;
    readonly panX: number;
    readonly panY: number;
    readonly showGrid: boolean;
    readonly gridColor: string;
  };
}
```

**Workspace** gains `toSnapshot()` method and `#hydrate()` accepts `WorkspaceSnapshot` directly (replacing the session-owned `WorkspaceInit`):

```typescript
// canvas/workspace.svelte.ts
export class Workspace {
  constructor(options: { restored?: WorkspaceSnapshot; /* ... */ }) { /* ... */ }
  toSnapshot(): WorkspaceSnapshot { /* traverse internals, return plain data */ }
}
```

**Session side** — `SessionPersistence` defines its own structural interface in the same file, zero canvas imports:

```typescript
// session/session-persistence.ts
export interface PersistableWorkspace {
  readonly tabs: ReadonlyArray<{ /* same fields as TabSnapshot */ }>;
  readonly activeTabIndex: number;
  readonly sharedState: {
    readonly activeTool: string;
    readonly foregroundColor: { r: number; g: number; b: number; a: number };
    readonly backgroundColor: { r: number; g: number; b: number; a: number };
    readonly recentColors: string[];
  };
}

export class SessionPersistence {
  async save(snapshot: PersistableWorkspace, dirtyDocIds?: Set<string>): Promise<void>;
  async restore(): Promise<PersistableWorkspace | null>;
}
```

**AutoSave** receives a snapshot-producing callback instead of a `Workspace` reference:

```typescript
// session/auto-save.ts — zero canvas imports
export class AutoSave {
  constructor(
    persistence: SessionPersistence,
    getSnapshot: () => PersistableWorkspace,
    debounceMs?: number
  );
}
```

**Composition root** (`session.ts`) is the only file that bridges both modules:

```typescript
// session/session.ts
const autoSave = new AutoSave(persistence, () => workspace.toSnapshot(), debounceMs);
```

TypeScript's structural typing ensures `WorkspaceSnapshot` is assignable to `PersistableWorkspace` without explicit mapping — zero conversion code.

### Resulting dependency graph

```text
Before:  Session ←→ Canvas (bidirectional, 7 import paths)
After:   Session ← session.ts → Canvas (unidirectional, 1 composition root)
```

## Commits

### Commit 1: Add WorkspaceSnapshot types and toSnapshot() to Workspace

Pure addition — no existing code modified, all tests still pass.

- Create `canvas/workspace-snapshot.ts` with `WorkspaceSnapshot` and `TabSnapshot` interfaces. Use `sharedState` nesting to mirror the existing `WorkspaceRecord` shape. All fields use inline structural types (no canvas type imports like `Color` or `ViewportData`). `activeTool` is `string`, not `ToolType`.
- Add `toSnapshot(): WorkspaceSnapshot` method to `Workspace`. This method traverses `this.tabs` and `this.activeEditor`, producing a plain-data snapshot with spread copies for all objects and arrays. Pixel data via `editor.pixelCanvas.pixels()`.
- Add `isValidToolType(value: string): value is ToolType` guard function to `tool-types.ts`. Returns true if the value is one of the known tool types. This will be used in a later commit when Workspace hydrates from a snapshot.
- Add unit tests for `toSnapshot()`: single-tab snapshot, multi-tab snapshot, correct pixel data integrity, correct sharedState values.

### Commit 2: Remove canvas imports from session storage types

Type-only change — no behavior change, all tests still pass.

- In `session-storage-types.ts`, remove imports of `ToolType`, `Color`, `ViewportData` from canvas. Replace `SharedStateRecord.activeTool` type with `string`. Replace `foregroundColor`/`backgroundColor` type with inline `{ r: number; g: number; b: number; a: number }`. Replace `viewports` value type with inline viewport object shape.
- In `workspace-init-types.ts`, apply the same treatment: remove canvas imports, use `string` for `activeTool`, inline structural types for colors and viewport.

### Commit 3: Change SessionPersistence to accept plain-data snapshots

Core interface change — save/restore now operate on `PersistableWorkspace` instead of `Workspace`.

- Define and export `PersistableWorkspace` interface in `session-persistence.ts`. Structure matches `WorkspaceSnapshot` with `sharedState` nesting. Uses `ReadonlyArray` for tabs.
- Change `save(workspace: Workspace, ...)` to `save(snapshot: PersistableWorkspace, ...)`. Remove the `Workspace` and `ViewportData` imports from canvas. Rewrite the save body to read from `snapshot.tabs[i]` directly instead of traversing `workspace.tabs[i].pixelCanvas.width` etc.
- Change `restore()` return type from `WorkspaceInit | null` to `PersistableWorkspace | null`. Adjust the restore body to return the `sharedState` nested shape instead of the flat `WorkspaceInit` shape. Keep `DEFAULT_VIEWPORT` as a local constant (same values, but typed as inline object instead of `ViewportData`).
- Update `session-persistence.test.ts`: replace `new Workspace()` construction with plain `PersistableWorkspace` object literals. Remove `Workspace`, `PixelCanvas`, `Color`, `ViewportData` imports from canvas. The `setPixel` helper is replaced by directly constructing `Uint8Array` pixel data in the test fixtures. Each existing test case converts to pass a plain snapshot object to `save()` and assert on the plain object from `restore()`.

### Commit 4: Change AutoSave to snapshot callback pattern

- Change `AutoSave` constructor from `(persistence, workspace, debounceMs)` to `(persistence, getSnapshot, debounceMs)` where `getSnapshot: () => PersistableWorkspace`. Replace the `#workspace: Workspace` field with `#getSnapshot` callback field. In `#save()`, call `this.#getSnapshot()` instead of passing `this.#workspace`.
- Remove the `Workspace` import from `auto-save.ts`.
- Update `auto-save.test.ts`: replace `new Workspace()` with a `let currentSnapshot = makeSnapshot(...)` pattern. Pass `() => currentSnapshot` as the callback. For tests that simulate tab changes (dirty tracking, tab removal), mutate `currentSnapshot` between operations. Remove the `Workspace` import. Add a simple `makeSnapshot()` factory function that creates a minimal valid `PersistableWorkspace` object, and a variant `makeTwoTabSnapshot()` for multi-tab tests.

### Commit 5: Wire session.ts composition root with toSnapshot()

- In `session.ts`, change `new AutoSave(persistence, workspace, ...)` to `new AutoSave(persistence, () => workspace.toSnapshot(), ...)`.
- The `restore()` result from `SessionPersistence` is now `PersistableWorkspace | null`. This is structurally compatible with the current `WorkspaceInit` that `Workspace` constructor expects, so pass it through directly as the `init` option. (The actual type switch to `WorkspaceSnapshot` happens in the next commit.)
- Adjust `session.test.ts` minimally — the tests still use `openSession()` as an integration test with real `Workspace` objects. Only fix compilation if needed (e.g., if `restore()` return type change requires small adjustments). The `Color`, `ViewportData`, `PixelCanvas` imports remain since this is the composition root's integration test.

### Commit 6: Switch Workspace hydration to WorkspaceSnapshot, delete workspace-init-types

Remove the reverse dependency (canvas → session) and clean up.

- In `workspace.svelte.ts`, replace `import type { WorkspaceInit } from '$lib/session/workspace-init-types'` with `import type { WorkspaceSnapshot } from './workspace-snapshot'`. Rename the `init` option to `restored` in `WorkspaceOptions`. Rename `#initFromSaved` to `#hydrate`.
- In `#hydrate`, use `isValidToolType()` guard for `activeTool`: if invalid, fall back to `'pencil'`. Colors and viewport fields are structurally compatible — no cast needed.
- Update `session.ts` to pass `restored` instead of `init` in the `Workspace` constructor options.
- Delete `workspace-init-types.ts` entirely.
- Verify all tests pass. The `session.test.ts` integration tests serve as the safety net for the full round-trip path.

## Decision Document

### Structural typing over shared type module

A shared `$lib/persistence-types/` module was considered (3 designs evaluated in parallel) but rejected. With only 2 consumers (canvas, session), a shared module adds directory overhead without proportional benefit. `Color` and its utility functions (`colorToHex`, `hexToColor`) belong together in canvas — extracting just the interface fragments cohesion. TypeScript's structural typing bridges the two modules at the composition root without any explicit mapping code.

### sharedState nesting preserved

Both `WorkspaceSnapshot` (canvas) and `PersistableWorkspace` (session) use `sharedState: { activeTool, foregroundColor, backgroundColor, recentColors }` nesting. This matches the existing IndexedDB schema (`WorkspaceRecord.sharedState: SharedStateRecord`), minimizing mapping logic in `SessionPersistence` and avoiding IndexedDB migration.

### Single type for save and restore

`PersistableWorkspace` serves as both the `save()` parameter type and the `restore()` return type. Save and restore are symmetric operations on the same data shape. If asymmetry arises in the future (e.g., restore needs migration metadata), the type can be split — a mechanical change.

### IndexedDB schema unchanged

The internal storage schema (`DocumentRecord`, `SharedStateRecord`, `WorkspaceRecord`) retains its structure. Only the type annotations change (canvas type imports → inline structural types). No DB version bump or migration needed.

### PersistableWorkspace lives in session-persistence.ts

Defined and exported from the same file that uses it most. `AutoSave` already imports from `session-persistence`, so no new import paths. Extract to a separate file only if a third consumer appears.

### activeTool validated at hydration boundary

Session stores `activeTool` as `string` — it never interprets tool values. Canvas validates on hydration via an `isValidToolType()` type guard, falling back to `'pencil'` for unrecognized values. This follows "fail at the boundary, trust the core" and provides a safety net for future `ToolType` variant removal.

### session.ts remains the sole composition root

`session.ts` is the only file that imports from both canvas and session modules. This is the composition root's natural role. Its integration tests (`session.test.ts`) legitimately use canvas types and remain unchanged in scope.

## Testing Decisions

### What makes a good test here

Tests should verify the **data contract** between modules — that a snapshot produced by canvas can survive a round-trip through session persistence and reconstruct an equivalent workspace. Tests should NOT verify IndexedDB internals, Svelte reactivity, or WASM behavior.

### session-persistence tests — plain objects

Replace `new Workspace()` construction with plain `PersistableWorkspace` object literals. This eliminates WASM dependency from session tests and makes them faster and more focused. Prior art: the existing tests already use `storage.putDocument()` / `storage.putWorkspace()` with plain record objects for corruption scenarios (lines 211-260 of current test file).

### auto-save tests — mutable snapshot callback

Replace `Workspace` instance with a `let currentSnapshot` variable and `() => currentSnapshot` callback. Simulate tab changes by swapping the snapshot object. This tests AutoSave's actual responsibilities (debounce timing, dirty tracking, flush behavior) without canvas coupling.

### Workspace.toSnapshot() — new unit tests

Verify snapshot correctness for single-tab, multi-tab, and specific field values (pixel data, viewport, colors, tool type). These tests live alongside existing workspace tests.

### session.test.ts — integration tests unchanged

These tests exercise the full `openSession()` → workspace manipulation → `flush()` → `openSession()` round-trip. They use real `Workspace` objects because that's the composition root's job. Canvas imports are expected and correct here.

## Out of Scope

- **IndexedDB schema migration.** The storage schema structure is unchanged; only TypeScript type annotations are updated. No DB version bump.
- **PersistencePort abstraction.** A formal interface for multiple persistence backends (file system, cloud sync) is not needed at current project scale. Can be extracted later from the concrete `SessionPersistence` class.
- **Shared types module.** A `$lib/persistence-types/` or `$lib/shared-types/` module is premature with only 2 consumers.
- **Snapshot performance optimization.** `toSnapshot()` copies pixel data for all tabs, same as current `save()`. Lazy or incremental snapshot strategies are a separate concern.
- **UI component test coverage.** The 46 untested UI components are a separate architectural concern unrelated to session-canvas decoupling.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/workspace-snapshot.ts` | New plain-data snapshot types (WorkspaceSnapshot, TabSnapshot) |
| `src/lib/canvas/workspace.svelte.ts` | Added toSnapshot(), switched hydration from WorkspaceInit to WorkspaceSnapshot |
| `src/lib/canvas/tool-types.ts` | Added isValidToolType() guard function |
| `src/lib/session/session-persistence.ts` | PersistableWorkspace interface, save/restore on plain data, all canvas imports removed |
| `src/lib/session/auto-save.ts` | Snapshot callback pattern, canvas import removed |
| `src/lib/session/session-storage-types.ts` | Canvas imports replaced with inline structural types |
| `src/lib/session/session.ts` | Wired toSnapshot() callback, WorkspaceInit import removed |
| `src/lib/session/workspace-init-types.ts` | Deleted — absorbed into canvas's own snapshot types |
| `src/lib/session/session-persistence.test.ts` | Rewritten with plain object literals, canvas imports removed |
| `src/lib/session/auto-save.test.ts` | Rewritten with mutable snapshot callback pattern |
| `src/lib/canvas/workspace.svelte.test.ts` | Added toSnapshot() tests, switched to WorkspaceSnapshot |

### Key Decisions
- Structural typing over shared type module — only 2 consumers, not worth a new module directory
- sharedState nesting preserved in snapshot to match IndexedDB schema, avoiding migration
- Single type (PersistableWorkspace) for both save and restore — symmetric operations
- activeTool stored as string in session, validated with isValidToolType() guard on hydration

### Notes
- session.ts remains the sole composition root importing both modules — this is architecturally correct
- Commit 5 (session.ts wiring) was absorbed into Commits 3-4 as call-site updates were needed for compilation
