---
title: Reference images — long-press sampling loupe
status: open
created: 2026-04-28
parent: 053-floating-reference-window.md
---

## What to build

When long-press sampling activates on a reference image (#061), display a magnification loupe similar to the canvas Eyedropper's. The loupe shows the pixel under the pointer and its 8-neighbor grid so the user can sample precisely without their finger occluding the target.

- **Loupe overlay on reference image** — reuse `Loupe.svelte` (or its grid + position primitives) so visual parity with the canvas Eyedropper is automatic.
- **Live grid driven by `sampler`** — read a 3×3 (or wider) RGBA neighborhood around `(imageX, imageY)` from the reference blob, feeding it into the same loupe `grid` shape that `samplingSession` produces today.
- **Position via existing `loupe-position`** — feed pointer viewport coords + viewport dims; quadrant logic and touch/mouse offsets reuse the canvas implementation.
- **Lifecycle wiring** — show on `onSampleStart` (long-press fire), update on `onSampleMove`, hide on `onSampleEnd`/`onCancel`. Mouse path (immediate Eyedropper one-click) does not show a loupe — matches the canvas behavior where loupe only appears during the sampling drag, not on a single click.

## Acceptance criteria

- During reference image long-press sampling, a loupe appears showing the pixel under the pointer and its neighborhood.
- Loupe position respects viewport edges (no clipping) using the same offset rules as the canvas loupe.
- Touch input centers the loupe horizontally above the pointer; mouse offsets it diagonally.
- Releasing the long-press hides the loupe at the same moment the sample commits.
- Unit tests: loupe grid extraction from a reference blob produces the expected RGBA values; lifecycle (show on start, update on move, hide on end/cancel).

## Background — why this is a follow-up

Issue #061 specified "live preview = foreground color updates continuously; release commits; no separate confirmation UI" without explicit mention of a loupe. The canvas Eyedropper has a loupe to address finger occlusion + sub-pixel precision; reference images have the same problem but the loupe was not part of the original 061 scope. Adding it on the back of #061 keeps the original PR focused.

## Open questions

- **Sampler grid extraction shape** — the existing `sampler.ts` returns a single `Color` from `(blob, x, y)`. To feed the loupe we either:
  - (a) extend `sampler` to return a small RGBA window (`samplePixelGrid(blob, cx, cy, radius)`), or
  - (b) decode the bitmap once per session into a cached `ImageData` and read pixels synchronously per move.
  Option (b) saves repeated `createImageBitmap` calls but introduces caching that the current `#refSampleSeq` race-defense skirts. Decide before coding.
- **Reuse vs reference-specific component** — `samplingSession` is currently canvas-tab-scoped. Two options:
  - (a) Make `samplingSession` accept any `SamplingPort` (the deepen-loupe-session refactor in #078 already moved toward this) and instantiate a second session for reference images.
  - (b) Build a thin reference-only `ReferenceLoupe` view that consumes the existing `loupe-position` + grid primitives without going through `SamplingSession`.

## Blocked by

- [061 — Reference images: long-press + drag color sampling](061-reference-images-long-press-sampling.md) (done)
- [078 — Deepen SamplingSession — port-injected session with reactive position](078-deepen-loupe-session.md) (done) — provides the abstraction that makes (a) above feasible.

## Related

- Sibling slice of PRD [053 — Floating reference image windows](053-floating-reference-window.md).
