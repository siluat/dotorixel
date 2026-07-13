---
title: Apple view test infrastructure — snapshot testing for docked region views
status: ready-for-agent
created: 2026-07-13
---

## What to build

Stand up a **view-layer test capability** for the Apple shell so SwiftUI
layout/rendering regressions are caught automatically, not only by eye. Adopt
[swift-snapshot-testing](https://github.com/pointfreeco/swift-snapshot-testing) and
cover the docked layout's region views at each layout tier.

This **narrows** the runtime-layout gap surfaced while implementing issue 225: the
`GeometryReader → LayoutTier → size` chain has unit tests for `LayoutTier.resolve`
and the `DesignTokens` tier accessors, but nothing verifies the **rendered** result
(e.g. "at the x-wide tier the right panel actually renders 240pt"). Structural
inspectors can't see this — the tier is computed from a `GeometryReader`-measured
width at layout time — so only a pixel-rendering (snapshot) or live-UI (XCUITest)
tool can verify it. Snapshot testing is the proportionate choice for the current
layout-drift class.

Residual boundary (do not overclaim): leaf-view snapshots verify the **tier → sizing**
step (given a tier, the view renders the right dimensions), but NOT the **width → tier**
measurement and propagation through `ContentView`'s root `GeometryReader` — a broken
root measurement or tier hand-off would leave all four snapshots green. That link is
covered today by `LayoutTier.resolve` unit tests; fully closing the chain would need a
Metal-free docked-shell boundary test (extract the docked scaffold from
`PixelCanvasView` so the whole composition renders offscreen), which is out of scope
here.

Recommended scope (from the 225 evaluation):

- Add swift-snapshot-testing to `apple/project.yml` — this is **two** entries:
  declare it under the top-level `packages:` key **and** list it in the
  `DotorixelTests` target's `dependencies` (`- package: SnapshotTesting`). Both are
  required, or project generation succeeds but the test target never links the module.
  Regenerate with `xcodegen`.
- Snapshot the **leaf region views** — `RightPanel`, `LeftToolbar`, `TopBar`,
  `StatusBar` — at `.wide` and `.xWide` tiers, asserting the tier-driven sizing renders
  (200/240 panel, 44/48 toolbar & top bar, 28/32 status bar).
- Snapshot leaf views only, **not `ContentView`** — it pulls in `EditorState`
  (UniFFI) and `PixelCanvasView` (Metal `MTKView`), which won't render cleanly
  offscreen. Treat this as a testability boundary (decompose view-under-test from the
  Metal canvas).
- Pin a single recording host (one iOS simulator or macOS) for deterministic
  reference images; document it.
- Tests use Swift Testing (`@Test`), matching the existing suite.

Explicitly **deferred** (documented, not adopted): XCUITest (gesture/flow e2e) and
ViewInspector (structural inspection) — revisit each when a concrete regression it
would catch actually appears. ViewInspector in particular cannot verify the
`GeometryReader`-driven tier chain, so it adds little over the existing unit tests.

## Acceptance criteria

- swift-snapshot-testing is wired into `apple/project.yml` as both a top-level
  `packages:` entry and a `DotorixelTests` target dependency; the project regenerates
  cleanly with `xcodegen` and the test target links the module.
- Snapshot tests exist for `RightPanel`, `LeftToolbar`, `TopBar`, `StatusBar` covering
  `.wide` vs `.xWide`, written with Swift Testing, passing against committed reference
  images.
- Reference images are recorded on a documented, pinned host; the recording host and
  the re-record procedure are written down (test-file header or a short doc).
- `xcodebuild test` on the pinned destination runs the snapshot tests green alongside
  the existing unit suites.
- A short note (test README or `CONTEXT.md`/`AGENTS.md`) records the policy: leaf
  region views are snapshot-tested; `ContentView` and the Metal canvas are out of
  snapshot scope, and why — plus the residual `width → tier` boundary above.
- XCUITest and ViewInspector are documented as deferred, not added.

## Decisions / open questions

- **Recording host + CI parity.** No macOS CI exists yet, so snapshots start as a
  local gate. Confirm the pinned host and whether reference images are committed as
  binary artifacts or regenerated on demand.
- **`.compact` snapshots.** 225 deferred a real compact layout, so a `.compact`
  snapshot would mainly pin the "graceful clamp." Optional for this issue.
- **Whether to close the `width → tier` boundary** with a Metal-free docked-shell
  boundary test, or leave it to `LayoutTier.resolve` unit tests. Decide when scoping.

## Blocked by

- None — can start immediately. Independent of 225 (which can merge on its own); this
  hardens future Apple view work.
