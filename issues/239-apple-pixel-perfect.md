---
title: Apple native — pixel-perfect stroke filtering + toggle
status: ready-for-agent
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
