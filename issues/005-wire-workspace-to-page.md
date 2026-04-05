---
title: Wire Workspace into +page.svelte — active tab swap
status: done
created: 2026-04-05
parent: 002-tab-system.md
---

## What to build

Replace the single EditorState instantiation in `+page.svelte` with a Workspace instance. Pass `workspace.activeEditor` to all existing child components (PixelCanvasView, RightPanel, LeftToolbar, TopBar, etc.). The app starts with one default tab and behaves identically to before — this slice proves the Workspace wiring works end-to-end without any new UI elements.

See parent PRD sections: "State flow", "Initial app state".

## Acceptance criteria

- [ ] `+page.svelte` creates a Workspace instead of a bare EditorState
- [ ] All child components receive their state from `workspace.activeEditor`
- [ ] App starts with a single "Untitled 1" tab — behavior identical to current single-image experience
- [ ] Viewport, tool state, color state, undo/redo all function correctly through the Workspace indirection
- [ ] Keyboard input (shortcuts, modifier keys) continues to work

## Blocked by

- [004 — Workspace class](004-workspace-class.md)

## User stories addressed

- User story 2 — click a tab to switch (wiring only, no UI yet)
- User story 4 — zoom/pan preserved per tab (each EditorState holds independent viewport)
- User story 5 — tool and colors shared via SharedState
- User story 6 — undo/redo independent per tab (each EditorState holds independent history)
- User story 16 — app starts with one default tab

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/workspace.svelte.ts` | Added `WorkspaceOptions` interface; constructor forwards `foregroundColor` to SharedState and `gridColor` to each tab |
| `src/lib/canvas/workspace.svelte.test.ts` | 3 new tests: initial foregroundColor forwarding, gridColor forwarding, gridColor applied to new tabs |
| `src/routes/editor/+page.svelte` | Replaced `new EditorState(...)` with `new Workspace(...)` + `$derived(workspace.activeEditor)` |
