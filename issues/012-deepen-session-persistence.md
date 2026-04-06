---
title: Deepen session persistence pipeline into a single deep module
status: done
created: 2026-04-06
---

## Problem

The session persistence layer is spread across 5 files and 3 layers:

```text
AutoSave (debouncing, dirty tracking)
  -> SessionPersistence (Workspace <-> Record mapping)
       -> SessionStorage (IndexedDB CRUD)
```

This creates several friction points:

- **Type mirroring**: Three parallel type hierarchies exist for the same data — live state (`SharedState`, `ViewportState`), storage records (`SharedStateRecord`, `ViewportRecord`, `DocumentRecord`, `WorkspaceRecord`), and init types (`SharedStateInit`, `ViewportInit`, `TabInit`, `WorkspaceInit`). Any state shape change requires updating 3+ files.
- **Deep Workspace access**: `SessionPersistence.save()` reaches deep into Workspace internals (`editor.pixelCanvas.pixels()`, `editor.viewportState.viewport.pan_x`, etc.). Changes to Workspace/EditorState internals break the session layer.
- **Caller complexity**: `+page.svelte` assembles 3 objects in a chained promise sequence (`SessionStorage.open()` -> `SessionPersistence` -> `restore()` -> `AutoSave`), mixing storage initialization logic with UI component code.
- **Three separate test suites**: `session-storage.test.ts`, `session-persistence.test.ts`, and `auto-save.test.ts` each test one layer in isolation, but no test verifies the full round-trip through the combined pipeline.

## Proposed Interface

A single `openSession` factory function replaces the 3-step init chain. A `SessionHandle` with 4 methods replaces direct interaction with `AutoSave`.

```typescript
function openSession(defaults: {
  foregroundColor?: Color;
  gridColor?: string;
  debounceMs?: number;
}): Promise<{ workspace: Workspace; session: SessionHandle }>;

interface SessionHandle {
  markDirty(documentId: string): void;
  notifyTabClosed(documentId: string): void;
  flush(): Promise<void>;
  dispose(): void;
}
```

**How callers use it:**

```typescript
// Before (3 imports, ~15 lines, chained promises)
SessionStorage.open()
  .then(storage => {
    const persistence = new SessionPersistence(storage);
    return persistence.restore().then(init => ({ persistence, init }));
  })
  .then(({ persistence, init }) => {
    if (init) workspace = new Workspace({ gridColor, init });
    autoSave = new AutoSave(persistence, workspace);
  });

// After (1 import, ~4 lines)
const { workspace: ws, session } = await openSession({
  gridColor: '#ECE5D9'
});
workspace = ws;
```

**What it hides internally:**

- IndexedDB connection lifecycle (`SessionStorage.open()`, `close()`)
- State-to-record mapping (all `DocumentRecord`, `WorkspaceRecord`, etc.)
- Debounce timer management (`setTimeout`/`clearTimeout`, pending save tracking)
- Dirty document tracking (`Set<string>` management, re-mark on failure)
- Tab removal cleanup (deleting closed tab records from IndexedDB)
- Failure resilience (IndexedDB unavailable -> fresh Workspace + no-op handle)
- Init type intermediaries (`WorkspaceInit`, `TabInit`, `ViewportInit`, `SharedStateInit`)

## Commits

### Commit 1: Add `openSession` facade and `SessionHandle` interface

Create `session.ts` in the session module directory. Implement:

- `SessionHandle` interface with 4 methods: `markDirty`, `notifyTabClosed`, `flush`, `dispose`.
- `openSession` async factory that:
  1. Calls `SessionStorage.open()`.
  2. Creates `SessionPersistence` and calls `restore()`.
  3. If restore succeeds, creates `Workspace` with the restored init data.
  4. If restore returns null, creates a fresh `Workspace` with the provided defaults.
  5. Creates `AutoSave` wired to the persistence and workspace.
  6. Returns `{ workspace, session }` where `session` is an object literal that delegates to `AutoSave` via closure.
  7. On any failure (IndexedDB unavailable, corrupt data), returns a fresh `Workspace` with a no-op `SessionHandle` constant.
- `dispose()` must call both `AutoSave.dispose()` and `SessionStorage.close()`.
- A module-level `NO_OP_SESSION` constant for the failure path.

Add a test file for `openSession` with boundary tests:

- Fresh session (no prior data) returns a Workspace with 1 default tab.
- Round-trip: `openSession` -> draw pixel -> `markDirty` -> `flush` -> new `openSession` -> verify pixel data preserved.
- Multi-tab round-trip with per-tab viewport preservation.
- Tab removal: `notifyTabClosed` -> `flush` -> re-open -> removed tab is gone.
- Debounce batching: rapid `markDirty` calls result in a single save.
- `flush` when nothing is dirty does not error.

### Commit 2: Migrate `+page.svelte` to use `openSession`

Replace the 3-step init chain in `+page.svelte`:

- Remove imports of `SessionStorage`, `SessionPersistence`, `AutoSave`.
- Add import of `openSession` and `SessionHandle` type from the new `session.ts`.
- Caller creates a default `Workspace` with a `GRID_COLOR` constant (existing pattern preserved).
- In `onMount`, call `openSession({ gridColor: GRID_COLOR })` and on resolution:
  - Replace `workspace` with the returned workspace.
  - Add all returned workspace tabs to `fittedEditors` (same as current pattern).
  - Store the returned `session` handle.
- Remove the `.catch(() => {})` block (failure handling is now inside `openSession`).
- Replace `autoSave?.markDirty(...)` calls with `session?.markDirty(...)`.
- Replace `autoSave?.notifyTabRemoved(...)` with `session?.notifyTabClosed(...)`.
- Replace `autoSave?.flush()` with `session?.flush()`.
- In onMount cleanup, call `session?.flush()` then `session?.dispose()` (adds storage close that wasn't happening before).
- The `$effect` watching `renderVersion` stays in the caller, using `session?.markDirty(...)`.
- The `handleAddTab` function calls `session?.markDirty(newDocId)` (no `notifyTabAdded` — same semantics).

### Commit 3: Remove public re-exports of internal session classes

Update the session module so that `SessionStorage`, `SessionPersistence`, and `AutoSave` are no longer importable from outside the session directory:

- If there is a barrel `index.ts`, update it to only export `openSession` and `SessionHandle`.
- If there is no barrel file (current state — callers import directly), no module-level export change is needed since internal files still import each other via relative paths. The "public API" is established by convention: only `session.ts` is the entry point for external callers.
- Verify no files outside `src/lib/session/` import `SessionStorage`, `SessionPersistence`, or `AutoSave` (confirmed: only `+page.svelte` did, and commit 2 already removed those imports).
- The record types (`DocumentRecord`, `WorkspaceRecord`, etc.) and init types (`WorkspaceInit`, `TabInit`, etc.) remain accessible because `WorkspaceInit` is used by `Workspace`'s constructor and its tests. This is intentional — see Decision Document.

## Decision Document

### Architecture

- **Facade pattern, not rewrite**: `openSession` is a thin facade over the existing `SessionStorage`, `SessionPersistence`, and `AutoSave` classes. Internal class structure is preserved unchanged.
- **`session.ts` as entry point**: New file in the session module directory. Contains `openSession` factory, `SessionHandle` interface, `NO_OP_SESSION` constant, and the live session handle construction via object literal + closure.

### Interface decisions

- **Return type**: `Promise<{ workspace: Workspace; session: SessionHandle }>`. Two separate concerns (editor state vs persistence control) returned as distinct properties.
- **No `restoredDocumentIds`**: Unnecessary because all tabs in the returned workspace are either restored or default. Caller adds all tabs to `fittedEditors` unconditionally (same semantic as current code).
- **No `notifyTabAdded`**: Tab addition is handled by `markDirty(newDocId)`. No distinct behavior warranted at this point (YAGNI).
- **`markDirty` requires `documentId`**: Always required (not optional). Workspace-level dirty marking is handled internally by `notifyTabClosed`.

### Workspace ownership

- **`openSession` creates the Workspace**: Eliminates the "create temporary, then replace" pattern in the caller.
- **Caller still creates a default Workspace first**: Because `openSession` is async, the caller initializes a default workspace for immediate rendering, then replaces it when `openSession` resolves. A `GRID_COLOR` constant prevents value duplication.
- **`WorkspaceInit` remains public**: It is part of `Workspace`'s constructor API and used in `workspace.svelte.test.ts`. Not a session-internal concept.

### Lifecycle

- **`dispose()` closes IndexedDB**: Calls `AutoSave.dispose()` (clears timers) and `SessionStorage.close()` (closes DB connection). This is new behavior — current code never closes the DB in production, but it's safe and enables clean test teardown.
- **No-op handle**: Module-level constant object with empty method implementations. Used when IndexedDB is unavailable. No class hierarchy needed.

### Dependency direction

- `session.ts` imports `SessionStorage`, `SessionPersistence`, `AutoSave`, `Workspace`, and `Color` type.
- Nothing outside the session module imports internal session classes (after migration).
- `Workspace` still imports `WorkspaceInit` from session init types (acceptable, not changed).

## Testing Decisions

### What makes a good test here

Tests should verify the **observable round-trip behavior** through the public `openSession` interface. They should survive internal refactoring of `SessionStorage`, `SessionPersistence`, or `AutoSave`. Tests assert on workspace state (tabs, pixels, viewport, colors), not on IndexedDB records.

### New tests

A single test file for `openSession` boundary tests using `fake-indexeddb/auto` (already a dev dependency) and `vi.useFakeTimers` for debounce verification.

Prior art: `session-persistence.test.ts` — same test environment setup (`fake-indexeddb/auto`, `happy-dom`, WASM setup via `vitest.config.ts`), same round-trip verification pattern (save -> restore -> assert state equality).

### Existing tests

The three existing test files (`session-storage.test.ts`, `session-persistence.test.ts`, `auto-save.test.ts`) are preserved unchanged. They continue to test internal class behavior and will coexist with the new boundary tests. Consolidation into boundary-only tests is a potential follow-up but is out of scope for this refactor.

## Out of Scope

- **Internal class rewriting**: `SessionStorage`, `SessionPersistence`, and `AutoSave` internals are not modified.
- **Type hierarchy unification**: The three parallel type hierarchies (Record, Init, Live) remain. Unifying them into a single `WorkspaceSnapshot` type is a separate future opportunity.
- **Existing test deletion/consolidation**: The three existing test files stay. Replacing them with boundary-only tests is a follow-up.
- **Loading state UI**: No loading indicator while `openSession` resolves. Current "default workspace -> replace" pattern is preserved.
- **`Workspace` constructor changes**: `WorkspaceInit` parameter remains. No changes to `Workspace` or `EditorState`.
- **Export/import functionality**: `WorkspaceSnapshot` or file-based persistence is not introduced.

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session.ts` | `openSession` facade + `SessionHandle` interface + `NO_OP_SESSION` constant |
| `src/lib/session/session.test.ts` | 7 boundary tests for `openSession` (round-trip, multi-tab, viewport, tab removal, debounce, flush-when-clean, IndexedDB failure) |
| `src/routes/editor/+page.svelte` | Migrated from 3 session imports to single `openSession`; added `session.dispose()` in cleanup |

### Key Decisions
- `WorkspaceInit` remains public — it is part of `Workspace`'s constructor API, not a session-internal concept
- `restoredDocumentIds` removed from the interface — all tabs in the returned workspace are treated uniformly by the caller
- `dispose()` closes the IndexedDB connection (new behavior, previously never closed in production)
- Existing 3 test files preserved alongside new boundary tests

### Notes
- The three parallel type hierarchies (Record, Init, Live) still exist internally — unifying them is a separate future opportunity
- Existing test consolidation (replacing layer tests with boundary-only tests) deferred as a follow-up
