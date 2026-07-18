---
title: Apple native — pixel-perfect stroke filtering + toggle
status: done
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Bring the **pixel-perfect** freehand mode to the Apple shell: when enabled (the
web default), pencil and eraser strokes run through the Aseprite-style L-corner
filter so jagged double-pixel corners collapse into clean single-pixel diagonals.

The filter itself is already across the FFI boundary
(`apple_pixel_perfect_filter`, with `TailState`/`FilterResult` types) — this
slice builds the stroke-scoped plumbing and the toggle UI.

Stroke plumbing (the web's pixel-perfect ops wrapper encodes the hard-won
details — mirror its semantics):

- The filter is **stroke-scoped**: fresh tail + cache per stroke, created at
  stroke start and dropped at end. The enabled flag is snapshotted at stroke
  begin (toggling mid-stroke doesn't affect the in-flight stroke).
- Each interpolated sample batch passes through the filter; `Paint` actions
  apply the tool, `Revert` actions restore the pixel's **pre-stroke** color from
  a first-touch-wins cache (capture a pixel's original color the first time the
  stroke touches it; later repaints don't overwrite the cached original).
- **Seam dedupe**: consecutive batches share a junction pixel (interpolation
  includes both endpoints); drop a leading pixel equal to the previous batch's
  tail before filtering, or corner detection silently fails at batch seams.

Applies to pencil and eraser only — shapes, fill, and other tools bypass the
filter (web parity).

UI: a pixel-perfect toggle button in the TopBar (web TopBar is the reference),
reflecting on/off state, **disabled when the active tool is neither pencil nor
eraser**. Default on.

## Acceptance criteria

- With pixel-perfect on, drawing a slow freehand diagonal produces no L-corners
  (the corner middle pixel is reverted); with it off, the raw interpolated stroke
  is kept.
- Eraser strokes filter the same way (reverting restores the pre-stroke pixel,
  not transparency).
- A pixel repainted later in the same stroke reverts to its pre-stroke color,
  not an intra-stroke intermediate.
- Corner detection works across sample-batch seams (the seam-dedupe case is
  unit-tested).
- Toggling mid-stroke doesn't change the in-flight stroke; the next stroke uses
  the new setting.
- The TopBar toggle reflects state, is disabled for non-freehand tools, and is
  covered by a snapshot baseline.
- Undo reverts the whole filtered stroke as one step.

## Blocked by

- [230 — stroke session architecture](230-apple-stroke-sessions.md)

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Tools/FreehandStrokeSession.swift` | Stroke-scoped L-corner filtering: tail carry between batches, first-touch-wins pre-stroke color cache, batch-seam dedupe; raw apply path when the toggle is off |
| `apple/Dotorixel/Tools/StrokeSession.swift` | `StrokeSessionHost.isPixelPerfectEnabled` seam, snapshotted at session creation |
| `apple/Dotorixel/Tools/EditorTool.swift` | `supportsPixelPerfect` (pencil/eraser only); freehand sessions receive the snapshotted flag |
| `apple/Dotorixel/State/EditorState.swift` | `pixelPerfect` state (default on) + host conformance |
| `apple/Dotorixel/Views/TopBar.swift` | Toggle left of the grid toggle: staircase icon mirroring the web SVG, accent on-state, dimmed + inert for non-freehand tools; `GridToggleButtonStyle` generalized to `BarToggleButtonStyle` |
| `apple/DotorixelTests/PixelPerfectStrokeTests.swift` | Seven behavior pins through the `EditorState` stroke API covering every acceptance criterion |
| `apple/DotorixelTests/EditorToolTests.swift` | Exhaustive `supportsPixelPerfect` table test |
| `apple/DotorixelTests/DockedRegionSnapshotTests.swift` | TopBar wide/x-wide baselines re-recorded + new disabled-toggle content snapshot |
| `apple/DotorixelTests/StrokeEngineTests.swift` | Fake host gained the new protocol property |

### Key Decisions

- Filter plumbing lives inside `FreehandStrokeSession` rather than a separate
  decorator (the web's ops-wrapper shape): Apple has no `DrawingOps` seam, the
  session is the only consumer, and one self-contained module reads better than
  a two-hop indirection.
- The enabled flag is snapshotted at session creation via the host seam —
  the same semantics as the web stroke engine's begin-time snapshot.
- `EditorState.pixelPerfect` keeps the web's property name for cross-shell
  vocabulary (matching `showGrid`); the host seam exposes the question-form
  `isPixelPerfectEnabled`.

### Notes

- Toggle state is in-memory only; persistence parity arrives with Phase 4
  (the web keeps it in the workspace snapshot).
- Accessibility labels are hardcoded English like the rest of TopBar;
  242 (String Catalog) localizes them.
- Snapshot baselines re-recorded on the pinned host (iPad Pro 11-inch (M5),
  iOS 26.4 simulator).
