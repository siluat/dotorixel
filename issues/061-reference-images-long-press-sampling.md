---
title: Reference images — long-press + drag color sampling
status: done
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Long-pressing (~500ms) on a displayed reference window, regardless of the active tool, triggers color sampling; dragging live-previews the foreground color; releasing commits. Reuses the `sampler` module from #060 and introduces a generic `long-press` gesture utility.

- **`long-press` utility** — generic pointer-gesture detector under `src/lib/`: fires after a threshold (~500ms), tolerates minor pre-threshold movement within a small radius, cancels on early release. Not tied to reference-images — designed for reuse.
- **Reference window integration** — attach long-press to the image body. On fire, switch into "sampling" mode: pointer moves update foreground color live via `sampler`; pointer up commits; pointer leave/cancel commits last value.
- **Tool independence** — works with pencil, shape, fill, etc. active. The long-press does not activate drawing; the window's pointer-absorb policy keeps the canvas inert underneath.
- **No separate confirmation UI** — live preview + release is the entire interaction.

## Acceptance criteria

- Long-pressing (~500ms) on a reference window begins sampling regardless of active tool.
- Dragging during sampling updates the foreground color live; releasing commits.
- Short press (below threshold) does not sample.
- Small pointer jitter during pre-threshold does not cancel the long-press.
- Foreground color reflects the pixel under the pointer at release time.
- Unit tests: `long-press` detector (fires after threshold, early-release cancels, movement-within-radius tolerated); integration through `sampler` produces the same RGBA as the Eyedropper path for the same coordinates.
- Component test: long-press simulation on `ReferenceWindow` updates foreground via the color state surface.

## Blocked by

- [060 — Reference images — color sampling via Eyedropper tool](060-reference-images-eyedropper-sampling.md)

## Scenarios addressed

- Scenario 7 (long-press + drag samples live; release commits)

## Results

| File | Description |
|------|-------------|
| `src/lib/gestures/long-press.ts` | New framework-agnostic long-press gesture detector. Single-pointer tracking with default 400 ms threshold and 8 px Euclidean radius (constants `DEFAULT_THRESHOLD_MS`, `DEFAULT_RADIUS_PX`). Lifecycle: `pointerDown → onFire (after threshold) → onMove → onEnd`, with `onCancel` for pre-fire termination (early release / out-of-radius / cancel). Coordinates abstracted through `PointerSnapshot` so the host owns DOM concerns. |
| `src/lib/gestures/long-press.test.ts` | 11 tests covering fire-after-threshold, early-release cancel, out-of-radius cancel, in-radius jitter tolerance, fire-with-most-recent-in-radius coords, post-fire move, post-fire commit, pointerCancel-after-fire commit, second-pointer ignored, dispose clears pending timer, no-op when idle. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Renamed `sampleReferencePixel` → `sampleReferenceCommit`. Added `sampleReferencePreview` for live foreground updates without `addRecentColor`. Both share a `#refSampleSeq` sequence counter to discard stale async results when a newer sample supersedes an in-flight one. Decode failure and transparent (`a === 0`) samples remain silent. |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Added `handleReferenceSampleStart` / `handleReferenceSampleMove` / `handleReferenceSampleEnd` thin delegates. Start/Move route to `sampleReferencePreview`; End routes to `sampleReferenceCommit`. |
| `src/lib/reference-images/ReferenceWindow.svelte` | Added `onSampleStart` / `onSampleMove` / `onSampleEnd` props. `pointerType === 'touch' \|\| 'pen'` routes through the long-press detector with `setPointerCapture`; mouse keeps the immediate `onSamplePixelAt` path from #060. Short tap on touch/pen routes through `onCancel` → `onSamplePixelAt` (the eyedropper-only path). `$effect` cleanup calls `detector.dispose()` on unmount. `.image` gets `touch-action: none` to prevent browser pan/zoom interception. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | Pass-through for the three new props, prepending `ref.blob` (matching the existing `onSamplePixel` shape). |
| `src/routes/editor/+page.svelte` | Long-press handlers are wired unconditionally (tool-independent); `onSamplePixel` (the eyedropper one-click path) remains gated by `editor.activeTool === 'eyedropper'`. Both mount sites updated. |
| `src/lib/reference-images/ReferenceWindow.svelte.test.ts` | Renamed two existing #060 tests to clarify the mouse path, then added 5 long-press tests: touch long-press fires `onSampleStart`, move during sampling, release commits via `onSampleEnd`, short tap routes to `onSamplePixelAt`, pen long-press parity, pointerCancel-after-fire still commits. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Renamed all `sampleReferencePixel` → `sampleReferenceCommit`. Added 4 tests for `sampleReferencePreview`: opaque updates foreground only (no recent color), transparent silent, decode failure silent, stale-out-of-order discarded. |

### Key Decisions

- **Detector lives outside reference-images.** Placed at `src/lib/gestures/` so it can be reused (e.g., the existing inline canvas long-press in `canvas-interaction.svelte.ts` could later adopt it). The detector has zero DOM/Svelte dependencies — it accepts pointer snapshots and emits lifecycle callbacks.
- **`pointerType === 'touch' || 'pen'` triggers the detector; otherwise mouse path.** Empty/unknown `pointerType` (test environments) falls through to the mouse path — safer default than triggering long-press unexpectedly. Existing #060 overlay tests that don't specify `pointerType` continue to work without modification.
- **Sequence-counter pattern over AbortController.** `createImageBitmap` doesn't reliably honor `AbortSignal` across browsers. A monotonically increasing `#refSampleSeq` shared between preview and commit lets the latest sample win and discards any older in-flight result.
- **Short tap on touch/pen routes through `onCancel`.** Reuses the existing #060 eyedropper one-click path: when the eyedropper tool is active, `onSamplePixelAt` is wired and a short tap commits a sample; with other tools, the prop is undefined and short taps are a no-op (matching the issue's "short press does not sample" criterion).
- **Threshold 400 ms (issue says ~500 ms).** Picked to feel responsive without colliding with deliberate gestures. Identical to the existing canvas long-press threshold for cross-component consistency.

### Notes

- **No visual verification on desktop.** Long-press is touch/pen-only, so a desktop browser cannot exercise the new path. Mouse behavior (#060's immediate sampling) is protected by explicit `pointerType: 'mouse'` in the existing tests.
- **Existing canvas long-press not refactored.** The inline detector in `canvas-interaction.svelte.ts` was left as-is per design discussion — extracting it would be a separate refactor since the canvas variant has different surrounding state (active pointers map, draw-vs-sample arbitration). The new module is structured so the canvas could adopt it later without API changes.
- **`pendingTapCoords` semantics on out-of-radius cancel.** When a touch drags outside the 8 px radius before threshold, `onCancel` fires `onSamplePixelAt` with the original down coords, not the release coords. This matches how a mouse click samples at the down point regardless of subsequent drag — and the eyedropper path is where this matters.
