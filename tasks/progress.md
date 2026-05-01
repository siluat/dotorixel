# Progress

## Currently Working On

None

## Last Completed

Reference images — mouse drag-to-sample loupe parity — closed the desktop/mobile asymmetry left by #079: mouse press-and-drag on a reference image (eyedropper tool active) now engages the same `SamplingSession` lifecycle as touch/pen long-press, so the loupe appears on press and tracks the cursor while held. Replaced the dual-purpose `onSamplePixelAt` callback (which served as both handler and feature flag) with an explicit `quickSamplingEnabled: boolean` prop on `ReferenceWindow`/`Overlay`; both touch short-tap and mouse press now route through `onSampleStart`/`Move`/`End`, collapsing to a single sampling code path. Plumbed `LoupeInputSource` through `onSampleStart` so loupe positioning reuses the canvas mouse-vs-touch offset logic. Defended against the async-decode race for fast clicks with a `#endPending` flag in `tab-state` (release before decode resolves still commits via the in-flight start). Surfaced during desktop manual verification: native HTML5 `<img>` drag was hijacking mouse `pointermove` so the loupe never tracked — fixed with `draggable="false"` plus an attribute-presence regression test. ([issue](../issues/080-reference-images-mouse-loupe.md))

## Next Up

- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
