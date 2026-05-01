# Progress

## Currently Working On

None

## Last Completed

Deepen reference sampling — extracted the async port-binding state machine from `TabState` (60+ lines: `#refSampleSeq` / `#endPending` / `#referencePort` / `#previewSamplingCenter` plus three lifecycle methods) into a new `ReferenceSamplingSession` module at `src/lib/reference-images/reference-sampling-session.svelte.ts`. The new module owns blob decode, port binding, press-time foreground preview, drag-time preview tracking, commit-on-release, and race/stale handling behind a small lifecycle interface (`start` / `move` / `end` / `cancel`) that returns effects instead of mutating state via callbacks. `decodeReferenceBlob` is now injected via a `decode` port at construction; tests cover all 12 lifecycle scenarios without `vi.mock` by passing an in-test queue-backed decode. `TabState` shrank to three one-line delegations through `#applyEffects`; `EditorController`, `ReferenceWindowOverlay`, and `+page.svelte` were unchanged at runtime (single type-annotation update on the controller getter). User-visible behaviour is unchanged — 834 tests passing, web build green. ([issue](../issues/081-deepen-reference-sampling-session.md))

## Next Up

- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Sub-issue of [PRD 014](../issues/014-apple-native-docked-layout.md). Independent, can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Sibling of 018. Can start independently.
- Layer system: basic infrastructure (add/delete/reorder)
  - Milestone 3 next major feature. Needs a PRD before implementation.
