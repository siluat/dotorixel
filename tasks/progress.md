# Progress

## Currently Working On

None

## Last Completed

[084 — Deepen reference image lifecycle](../issues/084-deepen-reference-image-lifecycle.md): promoted reference-image intake and display orchestration into a deepened `References` class (renamed from `ReferenceImagesStore`) at `src/lib/reference-images/references.svelte.ts`. Added four lifecycle-shaped public methods — `importToGallery`, `importDroppedBatch`, `openCentered`, `toggleDisplay` — so the page now talks in user actions instead of assembling Placement intents itself. Inlined `importReferenceImage` as a private `#importOne`, deleted `select-reference.{ts,test.ts}`, `import-reference-files.{ts,test.ts}`, `import-reference-image.{ts,test.ts}` (~361 LOC removed), and moved `ImportError`/`ImportFileError` types onto the store file. Made `nextCascadeIndex` `#`-private (owned by the centered-open path); kept `add`/`display` public after discovering ~50 fixture-only callers in `ReferenceWindowOverlay.svelte.test.ts` and `workspace.svelte.test.ts` whose precise-coordinate setups would be degraded by routing through lifecycle methods. Page handlers shrank to delegations + i18n only. Replaced the previous `vi.spyOn(singleImport, 'importReferenceImage')` test pattern with `vi.stubGlobal('createImageBitmap', …)` + a fake `OffscreenCanvas` since `#importOne` is no longer reachable as a free function. Four commits as planned (additive → migration → deletion+encapsulation → rename), all green at every step.

## Next Up

- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
