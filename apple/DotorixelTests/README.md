# DotorixelTests

Unit and view-layer tests for the Apple shell, written with
[Swift Testing](https://developer.apple.com/documentation/testing) (`@Test`/`@Suite`).

## View snapshot testing (docked region views)

`DockedRegionSnapshotTests` uses
[swift-snapshot-testing](https://github.com/pointfreeco/swift-snapshot-testing) to
guard the docked editor's **rendered layout** against regressions. It renders each
leaf region view offscreen and compares the pixels to a committed reference image.

> "Snapshot" here is the image-reference **testing technique**, not the History
> `Snapshot` (the undo/redo pixel buffer) in the domain model. They are unrelated.

### What is covered — and why snapshots

The four leaf region views — `RightPanel`, `LeftToolbar`, `TopBar`, `StatusBar` —
are snapshotted at the `.wide` and `.xWide` layout tiers, asserting the tier-driven
sizing actually renders:

| View | Tier-driven axis | `.wide` | `.xWide` |
|------|------------------|---------|----------|
| `RightPanel` | width | 200pt | 240pt |
| `LeftToolbar` | width | 44pt | 48pt |
| `TopBar` | height | 44pt | 48pt |
| `StatusBar` | height | 28pt | 32pt |

This layer is **additive**, not a duplicate of the existing unit tests:

- `DesignTokensTierSizingTests` checks the token *values* (`rightPanelWidth(.xWide) == 240`).
- `LayoutTierTests` checks `width → tier` resolution.
- These snapshots check the remaining link — that a view *applies* the token when it
  renders. The tier flows through a `GeometryReader`-measured width at layout time, so
  only a pixel render (or a live-UI test) can confirm it; structural inspection cannot.

Each test fixes only the view's **flexible** axis (`.frame(height:)` for the vertical
strips, `.frame(width:)` for the horizontal bars) and snapshots with
`.image(layout: .sizeThatFits)`, leaving the tier-driven axis intrinsic. The reference
image's dimensions therefore encode the tier sizing: break `rightPanelWidth` and the
`.xWide` reference stops matching.

### What is NOT covered (scope boundaries)

- **`ContentView` is not snapshotted.** It composes `EditorState` (UniFFI) with
  `PixelCanvasView` (a Metal `MTKView`), which does not render cleanly offscreen. Treat
  this as a testability boundary: leaf views are the unit under test, not the whole
  Metal-backed composition.
- **Residual `width → tier` gap.** These leaf snapshots verify the *tier → sizing*
  step (given a tier, the view renders the right dimension) but NOT the *width → tier*
  measurement or its propagation through `ContentView`'s root `GeometryReader`. A broken
  root measurement or tier hand-off would leave all snapshots green. That link is
  covered today by `LayoutTierTests` (`LayoutTier.resolve`). Fully closing the chain
  would need a Metal-free docked-shell boundary test (extracting the docked scaffold
  from `PixelCanvasView` so the whole composition renders offscreen) — out of scope for
  now.
- **`.compact` tier is not snapshotted.** `LayoutTier.docked` maps `.compact` to the
  `.wide` sizing (a full compact layout is deferred — see the issue 013 RFC), so a
  `.compact` leaf snapshot would be pixel-identical to `.wide` and add no coverage.

### Deferred alternatives (documented, not adopted)

- **XCUITest** — gesture/flow end-to-end. Revisit when a concrete interaction
  regression needs it; it is heavier than the current layout-drift class warrants.
- **ViewInspector** — structural view inspection. It cannot see the
  `GeometryReader`-driven tier chain (the value is computed at layout time), so it adds
  little over the existing `LayoutTier`/`DesignTokens` unit tests.

## Recording host (pinned)

Reference images are host-dependent (SF Symbols and system controls render differently
across OS versions and scales). Record and verify on **one** host:

```text
iPad Pro 11-inch (M5) · iOS 26.4 simulator · @2x
```

There is no macOS CI yet, so these snapshots are a **local gate**: references are
committed as binary PNGs under `apple/DotorixelTests/__Snapshots__/` and diffed on each
run. **The pinned host above is the only trusted reference — record and verify there.**
These leaf views size to content via `.sizeThatFits` rather than to the device, so the
device model should have little effect, but only the pinned host is verified (SF Symbols
and system controls can still drift across OS versions).

## Running

```text
xcodegen generate --spec apple/project.yml    # .xcodeproj is generated (git-ignored)
xcodebuild test \
  -project apple/Dotorixel.xcodeproj \
  -scheme Dotorixel \
  -destination 'platform=iOS Simulator,name=iPad Pro 11-inch (M5),OS=26.4'
```

(Requires the iOS 26.4 simulator runtime: `xcodebuild -downloadPlatform iOS`.)

## Re-recording references

When a view legitimately changes, regenerate its reference **on the pinned host**:

- Delete the affected PNG(s) under
  `apple/DotorixelTests/__Snapshots__/DockedRegionSnapshotTests/` and re-run — a missing
  reference is auto-recorded (and fails that run; re-run to verify), **or**
- set the recording mode temporarily, e.g. `assertSnapshot(…, record: .all)` or wrap a
  run with `withSnapshotTesting(record: .all) { … }`.

Review the regenerated image before committing, then commit the updated PNG.
