---
title: Unify duplicated workspace snapshot types across canvas and session modules
status: done
created: 2026-04-10
---

## Problem

The workspace/viewport snapshot shape is defined independently in three locations:

| Location | Type | File |
|----------|------|------|
| Canvas | `TabSnapshot.viewport` (inline 6-field object) | `src/lib/canvas/workspace-snapshot.ts` |
| Session | `PersistableWorkspace` (full duplicate of `WorkspaceSnapshot`) | `src/lib/session/session-persistence.ts` |
| Storage | `WorkspaceRecord.viewports` value (inline 6-field object) | `src/lib/session/session-storage-types.ts` |

Key issues:

- **`PersistableWorkspace` is a full copy of `WorkspaceSnapshot`** with no independent purpose. The comment in `session-persistence.ts` acknowledges this: "Structurally compatible with canvas's WorkspaceSnapshot — session never imports that type by name." However, `session.ts` already imports `Workspace` from canvas, so the dependency direction (`session -> canvas`) already exists. The avoidance was unnecessary.
- **`ViewportData` already exists** in `canvas/viewport.ts` with exactly the same 6 fields duplicated inline in `TabSnapshot.viewport`, `PersistableWorkspace`, and `WorkspaceRecord.viewports`. None reference it by name.
- **Type drift is caught only by accident.** The `openSession()` call in `session.ts` passes `() => workspace.toSnapshot()` (returning `WorkspaceSnapshot`) to `AutoSave` (expecting `() => PersistableWorkspace`). Structural typing makes this compile — but only as long as both types happen to match. If someone bypasses `openSession()`, drift goes undetected.
- **`PersistableWorkspace['tabs'][number][]`** indexed access types in session code are verbose and obscure intent. `TabSnapshot[]` is clearer.

## Proposed Interface

### Canvas module — `workspace-snapshot.ts`

Use `ViewportData` by name; extract `SharedStateSnapshot` as a named type:

```typescript
import type { ViewportData } from './viewport';

export interface SharedStateSnapshot {
  readonly activeTool: string;
  readonly foregroundColor: { r: number; g: number; b: number; a: number };
  readonly backgroundColor: { r: number; g: number; b: number; a: number };
  readonly recentColors: readonly string[];
}

export interface TabSnapshot {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly pixels: Uint8Array;
  readonly viewport: ViewportData;
}

export interface WorkspaceSnapshot {
  readonly tabs: readonly TabSnapshot[];
  readonly activeTabIndex: number;
  readonly sharedState: SharedStateSnapshot;
}
```

### Session module — `session-persistence.ts`

Delete `PersistableWorkspace`. Import `WorkspaceSnapshot` from canvas:

```typescript
import type { WorkspaceSnapshot } from '$lib/canvas/workspace-snapshot';

export class SessionPersistence {
  async save(snapshot: WorkspaceSnapshot, dirtyDocIds?: Set<string>): Promise<void> { ... }
  async restore(): Promise<WorkspaceSnapshot | null> { ... }
}
```

### Session module — `auto-save.ts`

Replace `PersistableWorkspace` with `WorkspaceSnapshot`:

```typescript
import type { WorkspaceSnapshot } from '$lib/canvas/workspace-snapshot';

export class AutoSave {
  #getSnapshot: () => WorkspaceSnapshot;
  constructor(
    persistence: SessionPersistence,
    getSnapshot: () => WorkspaceSnapshot,
    debounceMs?: number
  ) { ... }
}
```

### Storage module — `session-storage-types.ts`

Extract inline viewport to `ViewportRecord` named type. No canvas import — storage schema stays independent:

```typescript
export interface ViewportRecord {
  pixelSize: number;
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  gridColor: string;
}

export interface WorkspaceRecord {
  id: string;
  tabOrder: string[];
  activeTabIndex: number;
  sharedState: SharedStateRecord;
  viewports: Record<string, ViewportRecord>;
}
```

### Usage example — `session.ts` (no change needed)

```typescript
const autoSave = new AutoSave(persistence, () => workspace.toSnapshot(), defaults.debounceMs);
// workspace.toSnapshot() returns WorkspaceSnapshot
// AutoSave expects () => WorkspaceSnapshot
// Types match by name now, not just by structural coincidence
```

### What this hides internally

- The split-storage transformation (`WorkspaceSnapshot` tabs with inline viewports -> `WorkspaceRecord` with viewports keyed by doc ID) stays inside `SessionPersistence.save()/restore()`.
- `DEFAULT_VIEWPORT` fallback during restore stays inside `SessionPersistence.restore()`.
- `ViewportRecord` (mutable, for IndexedDB) vs `ViewportData` (readonly, for live state) distinction is local to each layer.

## Commits

### Commit 1: Extract `ViewportRecord` named type in storage module

Extract the anonymous inline viewport object type in `WorkspaceRecord.viewports` to a named `ViewportRecord` interface. The fields are identical — just given a name. Update the `viewports` field to reference `ViewportRecord`. No behavioral change; all existing code continues to compile.

### Commit 2: Use `ViewportData` in `TabSnapshot.viewport`

Import `ViewportData` from the viewport module and replace the inline 6-field object in `TabSnapshot.viewport`. The shape is identical — `ViewportData` already defines the same 6 readonly fields. The `workspace.svelte.ts` `toSnapshot()` method continues to work because `editor.viewport` is already typed as `ViewportData`.

### Commit 3: Extract `SharedStateSnapshot` as a named type

Extract the inline `sharedState` object type from `WorkspaceSnapshot` into a standalone `SharedStateSnapshot` interface in `workspace-snapshot.ts`. `WorkspaceSnapshot.sharedState` references the new named type. No change to any consumers — the shape is identical.

### Commit 4: Delete `PersistableWorkspace`, import `WorkspaceSnapshot` in session module

This is the main unification commit:

1. Delete the `PersistableWorkspace` interface and its preceding comment from `session-persistence.ts`.
2. Add `import type { WorkspaceSnapshot, TabSnapshot } from '$lib/canvas/workspace-snapshot'` to `session-persistence.ts`.
3. Replace all `PersistableWorkspace` usages in `session-persistence.ts`:
   - `save(snapshot: PersistableWorkspace, ...)` becomes `save(snapshot: WorkspaceSnapshot, ...)`.
   - `restore(): Promise<PersistableWorkspace | null>` becomes `restore(): Promise<WorkspaceSnapshot | null>`.
   - The local `viewports` variable type annotation `Record<string, PersistableWorkspace['tabs'][number]['viewport']>` becomes `Record<string, TabSnapshot['viewport']>` (or simply inline — the indexed access is now short and clear).
   - The local `tabs` array type `PersistableWorkspace['tabs'][number][]` becomes `TabSnapshot[]`.
4. Update `auto-save.ts`: replace `import type { ..., PersistableWorkspace } from './session-persistence'` with `import type { WorkspaceSnapshot } from '$lib/canvas/workspace-snapshot'`. Update `#getSnapshot` type and constructor parameter.
5. Update `session-persistence.test.ts`: replace `import { ..., type PersistableWorkspace }` with `import type { WorkspaceSnapshot, TabSnapshot } from '$lib/canvas/workspace-snapshot'`. Update `makeTab` and `makeSnapshot` type annotations.
6. Update `auto-save.test.ts`: same import replacement and type annotation updates.

Run `bun run check && bun run test` to verify all types resolve and all tests pass.

## Decision Document

- **Dependency direction**: Session modules may import types from canvas. This is not a new dependency — `session.ts` already imports `Workspace` from canvas. The `PersistableWorkspace` duplication was an unnecessary avoidance of a dependency that already exists.
- **Storage schema independence**: `session-storage-types.ts` does NOT import from canvas. The `ViewportRecord` and `SharedStateRecord` types are defined locally in the storage module. IndexedDB schema can evolve independently (e.g., adding migration versions) without coupling to canvas type changes. Structural compatibility between `ViewportData` (readonly) and `ViewportRecord` (mutable) is enforced by the assignment in `SessionPersistence.save()`.
- **`SharedStateSnapshot` vs `SharedStateRecord`**: These remain separate types. `SharedStateSnapshot` is readonly (canvas domain). `SharedStateRecord` is mutable (IndexedDB storage). Using mapped types (`-readonly`) to derive one from the other was considered and rejected — the complexity outweighs the DRY benefit for 4 fields.
- **`DEFAULT_VIEWPORT` type**: After the change, `DEFAULT_VIEWPORT` in `session-persistence.ts` satisfies `ViewportData` structurally (both have the same 6 readonly fields). No cast or explicit type annotation needed.
- **No runtime changes**: This entire refactor is type-level. No logic, no data flow, no behavior changes.

## Testing Decisions

No new tests are needed. The existing test suites already validate the behaviors at the correct boundaries:

- `session-persistence.test.ts` (15 tests): round-trip save/restore, viewport preservation, dirty tracking, document lifecycle. These tests exercise the full `WorkspaceSnapshot -> WorkspaceRecord -> WorkspaceSnapshot` transformation.
- `auto-save.test.ts` (7 tests): debounce batching, dirty tracking, tab removal. These tests pass snapshot objects through `AutoSave` to `SessionPersistence`.
- `workspace.svelte.test.ts` (16 tests): `toSnapshot()` captures tabs, viewport state, shared state correctly.

The only test changes are type annotation updates — replacing `PersistableWorkspace` imports with `WorkspaceSnapshot`/`TabSnapshot` imports. Test logic and assertions remain identical.

A good test in this area: asserts on observable round-trip outcomes (save then restore yields equivalent data), not on internal type names or module boundaries. The existing tests already follow this pattern.

## Out of Scope

- **Unifying `SharedStateSnapshot` and `SharedStateRecord`**: The 4-field readonly/mutable duplication is acceptable. Mapped type derivation adds complexity without proportional benefit.
- **Moving `ViewportData` to a shared module**: `ViewportData` stays in `canvas/viewport.ts`. Creating a `src/lib/workspace/` or `src/lib/shared-types.ts` module was considered and rejected — it would create a "no-man's-land" file that belongs to neither domain.
- **Adding canvas import to `session-storage-types.ts`**: The storage schema layer remains independent from canvas types. Structural compatibility is enforced at the `SessionPersistence` boundary.
- **Renaming `ViewportData` or `ViewportRecord`**: Both names are clear in their respective contexts. No rename needed.

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | Extracted `ViewportRecord` named interface; `WorkspaceRecord.viewports` now references it |
| `src/lib/canvas/workspace-snapshot.ts` | `TabSnapshot.viewport` references `ViewportData`; `SharedStateSnapshot` extracted as named type |
| `src/lib/session/session-persistence.ts` | Deleted `PersistableWorkspace` interface; `save()`/`restore()` now use `WorkspaceSnapshot`; local type annotations use `TabSnapshot` |
| `src/lib/session/auto-save.ts` | `#getSnapshot` and constructor parameter use `WorkspaceSnapshot` |
| `src/lib/session/session-persistence.test.ts` | Test helpers use `WorkspaceSnapshot`/`TabSnapshot` imports from canvas |
| `src/lib/session/auto-save.test.ts` | Test helpers use `WorkspaceSnapshot`/`TabSnapshot` imports from canvas |

### Key Decisions

- Session modules import types from canvas directly. `PersistableWorkspace` was an unnecessary avoidance — `session.ts` already imports `Workspace` from canvas, so the dependency direction was already established.
- Storage schema stays independent. `session-storage-types.ts` defines its own `ViewportRecord` (mutable) without importing from canvas, allowing IndexedDB schema to evolve independently.
- `SharedStateSnapshot` (readonly) and `SharedStateRecord` (mutable) remain separate. Mapped type derivation was rejected — the 4-field duplication is clearer than type-level transformation for this size.

### Notes

- Net change: -23 lines (48 deletions, 25 insertions) across 4 commits.
- All 516 existing tests continue to pass. No new tests needed — the change is type-level only with no runtime behavior changes.
- Type drift detection moved from accidental structural matching at `openSession()` to explicit named-type imports across all session module files.
