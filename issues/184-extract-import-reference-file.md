---
title: Extract importReferenceFile as a pure function out of the References store
status: done
created: 2026-06-14
---

## Context

From an architecture-depth review of the reference-images subsystem. The review's headline proposal — mirror the canvas Reference Layer Placement Interaction module for the Reference Window gesture — was found structurally inapt and dropped: the window gesture's geometry math is already extracted (`reference-window-placement.ts`), and the gesture deliberately mutates the Reference Window State store directly because that state is "the single source of truth the shell renders verbatim" (CONTEXT.md). Mirroring would only create a store-satellite with one consumer.

The one clean win that remains: the References store's private `#importOne` uses **no store state** — it is a standalone file→`ReferenceImage` orchestration (validate → decode → thumbnail) that happens to live as a private method. The project already has a family of pure import helpers (`import-validator`, `decode-reference-blob`, `thumbnail`); this extraction joins them.

## What to build

Lift the per-file import orchestration out of the References store into a standalone pure-ish async function, leaving the store's intake methods as thin callers.

- Extract `#importOne` into a standalone `importReferenceFile(file)` (its own module) that returns the existing result shape: `{ ok: true; reference } | { ok: false; error }`. It must not depend on the References store, its notifier, or any per-doc state.
- Have `importToGallery` and `importDroppedBatch` delegate to `importReferenceFile`; the store keeps ownership of sequencing, `add`, drop-batch placement/cascade, and error collection.
- Keep the existing error taxonomy (`unsupported-format` / `too-large` / `decode-failed`) and the `File`-paired error reporting unchanged.

## Acceptance criteria

- `importReferenceFile(file)` exists as a standalone async function with no reference to the store, notifier, or per-doc state; it returns the same `{ ok }` result shape callers already handle.
- `importToGallery` and `importDroppedBatch` delegate to it; intake behavior is unchanged — sequential in input order, typed errors paired with the source `File`, gallery `add`, and the drop-batch intra-batch cascade that does not advance the centered cascade slot.
- The function is unit-tested in isolation (validation rejection, decode failure, thumbnail path, success shape) without constructing the References store.
- It sits alongside the existing pure import helpers; the reference-window gesture, window-state CRUD, visibility/cascade/refit, and persistence paths are untouched.
- Web-only: no `CONTEXT.md` or ADR change (no new domain concept; the dropped gesture-mirror is already guarded by CONTEXT.md's "owned end-to-end by the References module").

Note for the implementer: `#importOne` mints `id: crypto.randomUUID()` and `addedAt: new Date()`. Either keep these inline (assert the success result structurally in tests) or inject an id/clock for deterministic assertions — implementer's discretion.

## Blocked by

None - can start immediately.

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/import-reference-file.ts` | New module. `importReferenceFile(file)` — the validate → decode → thumbnail → mint orchestration lifted out of the store as a standalone async function. Owns `ImportError` and the `ImportFileResult` result type and the `THUMBNAIL_LONGEST_EDGE` constant. |
| `src/lib/reference-images/import-reference-file.test.ts` | New isolated unit tests (5): success shape, `unsupported-format`, `too-large`, decoder-throws `decode-failed`, missing-2D-context `decode-failed` — none construct the References store. |
| `src/lib/reference-images/references.svelte.ts` | `#importOne` deleted; `importToGallery`/`importDroppedBatch` delegate to `importReferenceFile`. Store keeps sequencing, `add`, drop-batch placement/cascade, and error collection. Re-exports `ImportError` so existing consumers keep their import path. |

### Key Decisions
- **`ImportError` lives in the new module, re-exported from the store.** `+page.svelte` imports `ImportError` from `references.svelte`; a `export type { ImportError }` re-export keeps that path working without churn. `ImportFileError` (the `File`-paired batch shape) stays in the store — it is the batch-reporting concept, not part of the per-file result.
- **`id`/`addedAt` minted inline** (`crypto.randomUUID()` / `new Date()`), per the issue's implementer-discretion note; tests assert the success result structurally (id is a non-empty string, `addedAt instanceof Date`) rather than injecting a clock.

### Notes
- Behavior-preserving: 40 store tests + 5 new unit tests, full unit suite (1459) and all e2e (100) green; `svelte-check` clean.
- The repo has **no prettier config** (no `.prettierrc`, no `prettier` key) and no `format` script; the convention is **tab** indentation. `prettier --write` falls back to its 2-space default and silently reformats whole files — do not run it here. New files were authored with tabs to match siblings.
