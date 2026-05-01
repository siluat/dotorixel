# Progress

## Currently Working On

None

## Last Completed

Reference images — long-press sampling loupe — added a magnification loupe overlay during reference image long-press sampling, mirroring the canvas Eyedropper. Reuses `SamplingSession` via a new `createReferenceSamplingPort` adapter wrapping a once-decoded `DecodedImage` (`decodeReferenceBlob` runs `createImageBitmap` → `OffscreenCanvas.getImageData` once on long-press start; subsequent moves read RGBA synchronously from the cached buffer). Renamed `CanvasSamplingPort` → `SamplingPort` to reflect the realized abstraction; aligned reference-sampling method names on `referenceSample*` prefix. Single page-level `<Loupe>` instance (position: fixed) serves both docked and tabs layouts; `<svelte:window>` pumps screen pointer coords + handles resize so quadrant flip + viewport clamping reuse the canvas implementation. `#refSampleSeq` race defense covers both decode supersession and ghost-session prevention. Closes PRD 053 (Floating reference image windows) — all sub-issues done. ([issue](../issues/079-reference-images-long-press-loupe.md))

## Next Up

- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
