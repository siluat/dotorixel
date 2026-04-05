---
title: Workspace class — add/close/switch tabs
status: done
created: 2026-04-05
parent: 002-tab-system.md
---

## What to build

Introduce a Workspace class that manages an array of EditorState instances (tabs) and tracks the active tab index. The Workspace creates a single SharedState and passes it to every EditorState it creates. This slice is pure model logic with comprehensive unit tests — no UI changes.

See parent PRD sections: "Workspace responsibilities", "Tab closure behavior", "New image defaults", "Tab ordering", "Initial app state", "Workspace unit tests".

## Acceptance criteria

- [ ] Workspace class exists with `tabs` array, `activeTabIndex`, and `activeEditor` derived state
- [ ] `addTab()` creates a new 16x16 EditorState with the shared SharedState, assigns sequential name ("Untitled N"), sets it as active
- [ ] `closeTab(index)` removes the tab; if closing the active tab, activates the right neighbor (or left if rightmost)
- [ ] Closing the last remaining tab is a no-op (minimum 1 tab always open)
- [ ] Closing a non-active tab preserves the current active tab identity
- [ ] `setActiveTab(index)` switches the active tab
- [ ] Tab name counter is monotonically increasing (closing "Untitled 2" does not recycle the number)
- [ ] Workspace initializes with a single "Untitled 1" tab
- [ ] Unit tests cover all above behaviors

## Blocked by

- [003 — SharedState extraction](003-shared-state-extraction.md)

## User stories addressed

- User story 1 — create a new image in a new tab
- User story 3 — close a tab
- User story 7 — automatic tab naming ("Untitled N")
- User story 8 — prevent closing the last tab
- User story 9 — predictable tab activation after closure
- User story 16 — app starts with one default tab

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/workspace.svelte.ts` | Workspace class — tab array, active index, name counter, add/close/switch methods |
| `src/lib/canvas/workspace.svelte.test.ts` | 9 unit tests covering all acceptance criteria |
| `src/lib/canvas/editor-state.svelte.ts` | Added `name` property to EditorOptions and EditorState |

### Key Decisions
- Tab name stored on EditorState (via `name` option) rather than managed separately in Workspace — simpler, each tab naturally owns its name
- `name` defaults to empty string for backward compatibility with existing standalone EditorState usage in pages
