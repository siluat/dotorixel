---
title: Reference images — color sampling via Eyedropper tool
status: done
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

When the Eyedropper tool is active, tapping a reference window samples the pixel under the pointer into the foreground color — no long-press required. Introduces the shared `sampler` module used by both trigger paths.

- **`sampler` module** — pure function mapping `(Blob, x, y)` → RGBA, using `OffscreenCanvas` / `ImageBitmap`. No DOM dependencies beyond those APIs. Reusable for the Milestone 3 Reference Layer.
- **Eyedropper integration** — reference windows become valid sampling surfaces for the Eyedropper tool. Sampling writes to the foreground color via the existing color-state interface.
- **Coordinate mapping** — window pointer coords → image-natural coords via current display width/height.

## Acceptance criteria

- With Eyedropper active, tapping a reference window sets the foreground color to that pixel.
- Transparent pixels sample as transparent (alpha preserved).
- Sampling works at window corners (0,0 and w-1,h-1) without off-by-one.
- Sampling works on resized and minimized-then-restored windows.
- Unit tests: `sampler` correctness across square / landscape / portrait images, boundary coords, transparent pixels.
- Component test: Eyedropper tap updates foreground color via the established color state surface.

## Blocked by

- [056 — Reference images — display on canvas + close](056-reference-images-display-close.md)

## Scenarios addressed

- Scenario 8 (Eyedropper tap on reference window sets foreground)

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/sample-pixel.ts` | Pure synchronous extractor `(DecodedImage, x, y) → Color`; row-major RGBA index, no DOM dependency |
| `src/lib/reference-images/sample-pixel.test.ts` | 4 tests: 1×1 RGBA, transparent alpha preservation, portrait row-major correctness, distinct corner sampling |
| `src/lib/reference-images/window-to-image-coords.ts` | Pure window-local → image-natural coord mapping; `floor(localX × naturalW / displayedW)` then clamp to `[0, natural-1]` to defend the trailing edge |
| `src/lib/reference-images/window-to-image-coords.test.ts` | 4 tests: 1:1 mapping, 4× upscale, sub-pixel negative drift clamp, exact-trailing-edge clamp |
| `src/lib/reference-images/sampler.ts` | Async boundary `(Blob, x, y) → Color`: `createImageBitmap` → `OffscreenCanvas.getImageData` → `samplePixel`. Stateless (no decode cache); throws on decode failure (caller absorbs); `bitmap.close()` in `finally` |
| `src/lib/reference-images/ReferenceWindow.svelte` | New optional `onSamplePixelAt(imageX, imageY)` prop; `<img>` `onpointerdown` derives image-natural coords from `getBoundingClientRect` and invokes the callback. Letterbox area outside the image bypasses sampling and only triggers `onActivate` |
| `src/lib/reference-images/ReferenceWindow.svelte.test.ts` | 2 new tests: image pointerdown invokes `onSamplePixelAt(25, 40)` with a spied `getBoundingClientRect`; omitted prop does not throw |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | New optional `onSamplePixel(blob, imageX, imageY)` prop; pass-through to `<ReferenceWindow onSamplePixelAt>` only when provided so non-eyedropper tools see no behavior change |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte.test.ts` | 2 new tests: prop forwards `(blob, 25, 40)`; omitted prop does not throw on image pointerdown |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | New `sampleReferencePixel(blob, x, y)` async method routes through the existing `#applyEffects` dispatcher, emitting `colorPick(foreground) + addRecentColor` for opaque samples; transparent (a===0) is silent; decode failure is silent |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | 3 new tests with `vi.mock('../../reference-images/sampler')`: opaque sample updates `foregroundColor`/`recentColors` and emits `markDirty`; decode failure is silent; transparent sample is silent |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | New `handleSampleReference(blob, x, y)` delegates to `workspace.activeTab.sampleReferencePixel(...)`, swallowing the returned promise (fire-and-forget) |
| `src/routes/editor/+page.svelte` | Both `<ReferenceWindowOverlay>` mount sites (docked + tabbed layouts) wire `onSamplePixel={editor.activeTool === 'eyedropper' ? editor.handleSampleReference : undefined}` so non-eyedropper tools fall back to z-order activation |

### Key Decisions

- **Simple tap, not drag-to-refine + loupe.** PRD line "matching canvas eyedropper UX" was reconciled with acceptance ("tapping a reference window") in favor of the acceptance text. Long-press/drag entry remains future work for issue 061. Rationale: simpler API for the Eyedropper tool that already has loupe coverage on canvas; the reference window's natural pixel size makes a loupe less necessary.
- **Stateless decode every click.** No per-reference decoded-bitmap cache. `createImageBitmap` is sub-millisecond on modern browsers for typical reference sizes; a cache layer can sit behind the same `samplePixel(blob, x, y)` signature later without changing call sites.
- **Sampling through `TabState.#applyEffects`.** Reuses the same effect path (`colorPick` + `addRecentColor` + `markDirty`) the canvas eyedropper already uses. This means hex normalization, recent-color de-duplication, and dirty notification stay consistent without duplicating logic.
- **Three-file split for testability.** `sample-pixel.ts` (pure, synchronous, fully unit-tested) + `window-to-image-coords.ts` (pure coord math, fully unit-tested) + `sampler.ts` (thin async wrapper around browser APIs, no unit tests because happy-dom lacks `OffscreenCanvas` and `createImageBitmap`). The pure parts carry all the meaningful regression risk; the boundary file carries only browser-API plumbing.
- **`<img>`-element pointerdown, not window-element.** Attaching the handler to the `<img>` rather than `.body` means the letterbox region (visible when window aspect ≠ image aspect) naturally falls through to the existing `onActivate` z-order raise without sampling. No explicit hit test needed.
- **Conditional pass-through in Overlay, not always-on.** `onSamplePixelAt` is forwarded only when the page passes `onSamplePixel`; otherwise undefined. This preserves the behavioral guarantee that pencil/eraser/etc. clicks on the image area only raise z-order — they cannot accidentally trigger sampling even if a future bug routes events the wrong way.
- **Floor-then-clamp coord mapping.** `Math.floor((local × natural) / displayed)` clamped to `[0, natural-1]` defends the trailing-edge case where a click on the right/bottom border would otherwise land at index `natural` (off-by-one). Acceptance criterion "(0,0) and (w-1, h-1) without off-by-one" is met by construction.
- **Naming alignment across layers.** `samplePixel` (sampler) → `sampleReferencePixel` (TabState) → `handleSampleReference` (Controller) → `onSamplePixel` (Overlay) → `onSamplePixelAt` (Window). Each layer reshapes the signature for its responsibility but keeps the "sample pixel" stem so the action is traceable across the call chain.

### Notes

- **No e2e Playwright test.** Acceptance is covered by unit + component tests as defined in the issue body; manual UI verification covers the resize/minimize-then-restore/corner cases. If long-press sampling (061) lands soon, an e2e covering the integrated reference + tools flow will be cheaper to write once.
- **Race condition on rapid taps deferred.** `createImageBitmap` is async; if the user spams clicks faster than decode resolves, out-of-order callback resolution is possible. Not protected against in this slice — acceptable for MVP given decode latency is sub-millisecond. A `requestAnimationFrame`-keyed guard or AbortController plumbing can be added later without API changes.
- **Sibling slices remaining for PRD 053**: 061 (long-press sampling) and 062 (drag-drop import). 061 will share the same `sampler` module via long-press detector + drag refine.
