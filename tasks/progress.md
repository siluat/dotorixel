# Progress

## Currently Working On

None

## Last Completed

Architecture deepening planning — surveyed the reference-image lifecycle and identified that domain rules (*centered* / *at-point* Placement Intent, intra-batch Drop Batch cascade, three-state toggle, gallery "open or raise" semantics, batch file intake) currently live as inline orchestration in `+page.svelte` (~120 LOC) and a thin `select-reference.ts` wrapper (46 LOC). Designed a deepened `References` class (renamed from `ReferenceImagesStore`) at `src/lib/reference-images/references.svelte.ts` with lifecycle-shaped public methods `importToGallery` / `importDroppedBatch` / `openCentered` / `toggleDisplay`. Data primitives `add` / `display` / `nextCascadeIndex` become structurally private (`#`-prefixed); intake (`import-reference-files.ts`, `import-reference-image.ts`, `select-reference.ts` + their tests, 361 LOC) folds inside as `#importOne`; `ImportError` / `ImportFileError` types relocate to the store file as part of the public surface. `show` / `close` and the geometry setters stay public because `ReferenceWindowOverlay.svelte` and `ReferenceWindow.svelte` invoke them directly for window-level UI (X button, z-raise, drag/resize/minimize). Filed as a single ready-for-human issue [084](../issues/084-deepen-reference-image-lifecycle.md) with a four-commit sequence (additive → migration → deletion+encapsulation → rename) following the 077 pattern. Seeded `Drop Batch` term in `CONTEXT.md` plus a Relationships line linking *at-point* Placement Intents to their Drop Batch.

## Next Up

- [084 — Deepen reference image lifecycle: promote intake/display orchestration into a References class](../issues/084-deepen-reference-image-lifecycle.md)
  - Ready-for-human, no blockers. Architecture deepening.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
