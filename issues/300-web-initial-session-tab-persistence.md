---
title: Web initial session tab persistence verification
status: done
created: 2026-10-20
---

## Problem Statement

The backlog inherited from the Apple persistence review claims that adding a
second tab before the first save omits the initial Document and prevents Workspace
restoration. Current Workspace construction already emits a dirty notification
for the initial tab. Existing multi-tab session tests manually mark Documents
dirty, so they do not establish whether the automatic wiring covers this case.

## Solution

Verify the existing user flow through the public session boundary before changing
production behavior. Keep a regression test and correct the backlog if the flow
already works.

## User Stories

1. As an editor user, I want an untouched initial tab to survive when I add another
   tab before the first save, so reopening preserves my Workspace.
2. As an editor user, I want tab identity, ordering, and the active tab preserved
   when the session is reopened.

## Implementation Decisions

- The user approved testing the openSession → addTab → flush → dispose → openSession
  boundary on 2026-10-20. No extra manual dirty notifications or internal mocks.
- Freeze only timers to ensure the first save is the explicit flush, before any
  debounce callback runs. Use the existing in-memory IndexedDB test environment.
- This is verification of existing behavior: an initially passing test is valid.
  Validate sensitivity by temporarily omitting the initial dirty notification.
- No production behavior or schema changes unless the public flow fails.

## Testing Decisions

Observe restored Document IDs in the original tab order and the active Document
through the reopened Workspace. Dispose sessions and restore timers in finally
blocks. Do not inspect database rows as the assertion surface.

## Out of Scope

Shared-state-only document rewrites, persistence-layer defense against incomplete
dirty sets supplied by other callers, browser GUI testing, and Apple behavior.

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session.test.ts` | Adds an initial two-tab round-trip without manual dirty notifications |
| `tasks/todo.md` | Replaces the obsolete initial-tab bug claim with a conditional hardening note; retains shared-state rewrite work |
| `tasks/progress.md` | Records completion and remaining persistence work |
| `tasks/done.md` | Links this verification result |

### Key Decisions

- The public initial-session flow passes on the existing production code at
  `dda1fa6`; do not claim or implement a product fix for this scenario.
- Mutation check: omit only the initial tab notification. The new test fails with
  one fresh Document instead of the two original IDs. Restore production code,
  then rerun the related suites successfully.
- The lower-level save method still relies on its caller's dirty set. Keep possible
  hardening separate from a proven current user-flow defect.

### Validation

- `bun run test src/lib/session/session.test.ts`: 8 passed (includes WASM build).
- Mutation run of the new test: expected assertion failure; source restored.
- `bun run vitest run src/lib/session src/lib/canvas/editor-session/workspace.svelte.test.ts`:
  7 files, 175 tests passed after restoration.

- `bun run check`: 0 errors and 0 warnings.

### Notes

This verification uses the real session, Workspace and persistence code with
fake IndexedDB and controlled timers. It does not establish real-browser reload
behavior, concurrent-save handling, or all persistence guarantees.
