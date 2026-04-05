---
title: SharedState extraction + EditorState accepts shared reference
status: done
created: 2026-04-05
parent: 002-tab-system.md
---

## What to build

Extract the shared state fields (`activeTool`, `foregroundColor`, `backgroundColor`, `recentColors`) from EditorState into a new SharedState object. EditorState's constructor accepts a SharedState reference, and all internal access to these fields goes through `this.shared.*`. This is a pure refactor — the app behaves identically with a single editor, but the groundwork is laid for multiple EditorState instances to share tool and color state.

See parent PRD sections: "Architecture: Workspace + SharedState pattern", "EditorState + SharedState integration tests".

## Acceptance criteria

- [x] SharedState class exists with `activeTool`, `foregroundColor`, `backgroundColor`, `recentColors` as reactive state
- [x] EditorState constructor accepts an optional SharedState reference (creates a default one if not provided, preserving backward compatibility)
- [x] EditorState delegates tool and color access through `this.shared.*`
- [x] All existing EditorState tests pass without modification (or with minimal adaptation to the new constructor signature)
- [x] Integration tests verify: two EditorState instances sharing the same SharedState see the same `activeTool`, `foregroundColor`, `backgroundColor`, and `recentColors`
- [x] Integration tests verify: independent state (canvas pixels, history, viewport) does not leak between instances sharing a SharedState
- [x] App runs identically to before — no visible behavior change

## Blocked by

None — can start immediately.

## User stories addressed

- User story 5 — drawing tool and colors stay the same when switching tabs
- User story 17 — recent colors shared across all tabs

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/shared-state.svelte.ts` | New SharedState class with reactive `activeTool`, `foregroundColor`, `backgroundColor`, `recentColors` |
| `src/lib/canvas/editor-state.svelte.ts` | EditorState delegates shared fields via getter/setter to `this.shared`; constructor accepts optional `SharedState` |
| `src/lib/canvas/shared-state.svelte.test.ts` | SharedState defaults, delegation, two-editor sharing, and independent state isolation tests |

### Key Decisions
- Used getter/setter delegation instead of removing the public properties — preserves EditorState's existing API so no consumer code changes are needed
- SharedState uses `$state` runes directly — Svelte 5's dependency tracking follows getter reads through to the underlying `$state`, preserving the reactive chain for `$derived` properties like `foregroundColorHex` and `toolCursor`
