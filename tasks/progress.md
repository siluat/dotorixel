# Progress

## Currently Working On

None

## Last Completed

[085 — Deepen TabState's viewport responsibility into a TabViewport class](../issues/085-deepen-tab-viewport.md): introduced a `TabViewport` class at `src/lib/canvas/editor-session/tab-viewport.svelte.ts` that owns `ViewportData` + `ViewportSize` for one tab, reads canvas dimensions through an injected reactive getter (matching the established `ToolRunner.host` / `StrokeEngine.host` / `SamplingSession.getSamplingPort` pattern), hides the `clampPan` rule behind an explicit `reclamp()` entry point, and emits `markDirty` itself. `TabState` keeps its public surface intact and now delegates all six viewport intent methods (`setViewport`, `zoomIn/Out/Reset/Fit`, `toggleGrid`) plus the new `setViewportSize`; `resize` and the `canvasReplaced` effect path both call `reclamp()` instead of repeating inline `clampPan`. Two commits (`feat: introduce TabViewport + tests` → `refactor: delegate TabState viewport responsibility to TabViewport`); the optional Commit 3 rename (`setViewport` → `apply`) was skipped because `TabState.setViewport` keeps an explicit `clampPan` safety net for raw gesture inputs while `TabViewport.apply` writes directly, and renaming would create same-name-different-semantics anti-parity. Test count net +10 (9 new `TabViewport` tests + 1 `TabState` reactive-getter sanity check); 846 total passing.

## Next Up

- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
