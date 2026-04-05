---
title: SharedState extraction + EditorState accepts shared reference
status: open
created: 2026-04-05
parent: 002-tab-system.md
---

## What to build

Extract the shared state fields (`activeTool`, `foregroundColor`, `backgroundColor`, `recentColors`) from EditorState into a new SharedState object. EditorState's constructor accepts a SharedState reference, and all internal access to these fields goes through `this.shared.*`. This is a pure refactor — the app behaves identically with a single editor, but the groundwork is laid for multiple EditorState instances to share tool and color state.

See parent PRD sections: "Architecture: Workspace + SharedState pattern", "EditorState + SharedState integration tests".

## Acceptance criteria

- [ ] SharedState class exists with `activeTool`, `foregroundColor`, `backgroundColor`, `recentColors` as reactive state
- [ ] EditorState constructor accepts an optional SharedState reference (creates a default one if not provided, preserving backward compatibility)
- [ ] EditorState delegates tool and color access through `this.shared.*`
- [ ] All existing EditorState tests pass without modification (or with minimal adaptation to the new constructor signature)
- [ ] Integration tests verify: two EditorState instances sharing the same SharedState see the same `activeTool`, `foregroundColor`, `backgroundColor`, and `recentColors`
- [ ] Integration tests verify: independent state (canvas pixels, history, viewport) does not leak between instances sharing a SharedState
- [ ] App runs identically to before — no visible behavior change

## Blocked by

None — can start immediately.

## User stories addressed

- User story 5 — drawing tool and colors stay the same when switching tabs
- User story 17 — recent colors shared across all tabs
