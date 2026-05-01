---
title: Reference images — long-press sampling loupe
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/sampling/ports.ts` | Renamed `CanvasSamplingPort` → `SamplingPort` and updated doc to reflect the realized adapters (canvas, reference, in-memory test) — the "future adapters" speculation is now concrete |
| `src/lib/canvas/sampling/sample-grid.ts` | Updated to `SamplingPort`; parameter `canvas:` → `port:` and doc "canvas coordinates" → "pixel coordinates" so the wording fits both pixel sources |
| `src/lib/canvas/sampling/adapters/in-memory.ts` | Updated to `SamplingPort`; doc generalized |
| `src/lib/canvas/sampling/session.svelte.ts` | `getSamplingPort: () => SamplingPort` |
| `src/lib/reference-images/decode-reference-blob.ts` | New: decode a reference Blob once into a synchronous RGBA buffer (`createImageBitmap` → `OffscreenCanvas.getImageData`). Lets the loupe path read ~81 pixels/move synchronously without paying `createImageBitmap` per move |
| `src/lib/reference-images/sampling-port.ts` | New: `createReferenceSamplingPort(DecodedImage): SamplingPort` adapter so `SamplingSession` drives a loupe over a reference image with no duplicated grid/position/clamp logic |
| `src/lib/reference-images/sampling-port.test.ts` | New: dimension exposure + RGBA pixel reads from the wrapped buffer |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Added `referenceSamplingSession: SamplingSession`; new lifecycle `referenceSampleStart/Move/End` for the long-press loupe path; renamed `sampleReferenceCommit` → `referenceSampleCommit` for vocabulary alignment with the lifecycle methods; `#refSampleSeq` race defense covers both decode-supersession and ghost-session prevention (release before decode resolves) |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | 9 new tests covering reference loupe lifecycle (start/move/end/commit, transparent center, decode failure, slow-decode supersession, ghost-session) |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | New `referenceSamplingSession` getter; renamed `handleSampleReference` → `handleReferenceSampleCommit`; new lifecycle delegators `handleReferenceSampleStart/Move/End` |
| `src/routes/editor/+page.svelte` | Single page-level `<Loupe>` instance rendered conditionally on `editor.referenceSamplingSession.position` (position: fixed → DOM placement irrelevant, serves both docked and tabs layouts); `<svelte:window>` `pushReferencePointer`/`handleWindowResize` pump screen coords into the session so quadrant flip + viewport clamping reuse the canvas implementation; `ReferenceWindowOverlay` wired to the new lifecycle handlers |

### Key Decisions

- **Decode once per long-press session (Open question option b).** The loupe reads dozens of pixels per pointer move; paying `createImageBitmap` per sample (as the existing `sampler.samplePixel` does for the one-click path) is wasteful in a hot loop. Decode runs once on long-press start; subsequent moves read RGBA synchronously from the cached buffer.
- **Reuse `SamplingSession` via port adapter (Open question option a).** Aligns with the abstraction #078 was already preparing. Renamed `CanvasSamplingPort` → `SamplingPort` to reflect the realized abstraction. One session field per tab; `#referencePort` is swapped per long-press so the same session machinery drives both canvas and reference loupes.
- **Single `<Loupe>` instance at page root.** `position: fixed` makes DOM placement irrelevant. One conditional render serves both docked and tabs layouts and avoids duplicating the markup per shell.
- **Domain vocabulary unification.** Aligned all reference-image sampling methods on the `referenceSample*` prefix (`sampleReferenceCommit` → `referenceSampleCommit`, `handleSampleReference` → `handleReferenceSampleCommit`) so the mouse-commit method and long-press lifecycle methods share one naming convention. Trimmed unused params (`_blob`, `_imageX`, `_imageY`) from `referenceSampleMove`/`End` per "delete unused completely" guideline.

### Notes

- Long-press detector's post-fire termination always routes through `onEnd` (clean release or cancel — both commit per W3C "leave/cancel commits last value"). Pre-fire `onCancel` is the short-tap path that delegates to the immediate one-click Eyedropper via `onSamplePixelAt`.
- Ghost-session prevention: `referenceSampleEnd` bumps `#refSampleSeq` before checking `isActive`, so an in-flight decode resolved after release is discarded by its own sequence guard.
- `CanvasCoords` type still used by `sample-grid.ts` even though the port may wrap a reference image. Renaming would touch the entire codebase; deferred as out-of-scope.
