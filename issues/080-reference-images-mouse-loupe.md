---
title: Reference images — mouse drag-to-sample loupe parity
status: done
created: 2026-05-01
parent: 053-floating-reference-window.md
---

## What to build

Reference image color sampling currently uses two distinct paths:

- **Touch/pen**: long-press → `onSampleStart/Move/End` lifecycle → loupe shown during the drag.
- **Mouse**: pointerdown → `onSamplePixelAt` immediate commit → no loupe.

The canvas Eyedropper does not have this asymmetry — mouse pointerdown on the canvas
also enters the sampling lifecycle (`SamplingSession.start()` on first frame), so the
loupe appears on press and tracks the cursor while held. This issue brings the
reference image to the same model: **mouse press-and-drag also shows the loupe and
updates the foreground color live**, mirroring the canvas Eyedropper.

## Acceptance criteria

- Mouse pointerdown on a reference image (with eyedropper tool active, or with
  long-press-style global sampling — same gating as today) triggers
  `onSampleStart` and shows the loupe immediately, with no 400 ms wait.
- Moving the mouse while pressed updates the foreground color live and moves the
  loupe (`onSampleMove`).
- Releasing the mouse commits the sample and hides the loupe (`onSampleEnd`).
- Single mouse click (down → up without movement) still commits a sample, just like
  it does today — and the loupe appears briefly during the press, matching canvas
  Eyedropper behavior.
- Touch/pen long-press behavior is unchanged (still 400 ms threshold + onFire).
- Loupe positioning uses the mouse offset (diagonal), not the touch offset (centered
  above), since `inputSource` is `'mouse'`.
- Unit/component tests: mouse pointerdown on `ReferenceWindow` fires `onSampleStart`
  immediately; mouse pointermove fires `onSampleMove`; mouse pointerup fires
  `onSampleEnd`; touch path tests from #061/#079 still pass.

## Background — why this is a follow-up

Issue #061's note explicitly called out that "long-press is touch/pen-only, so a
desktop browser cannot exercise the new path. Mouse behavior (#060's immediate
sampling) is protected by explicit `pointerType: 'mouse'` in the existing tests."
At the time, this was correct because there was no loupe — the mouse just
committed instantly with no visual feedback.

Issue #079 added the loupe but kept the `isLongPressPointer` gate in
`ReferenceWindow.svelte`, so the loupe still only appears on touch/pen. The
canvas, however, has always shown the loupe to mouse users during sampling drags
(`canvas-interaction.svelte.ts` only branches on `pointerType === 'touch'` to
defer with a 400 ms timer; mouse and pen go straight into draw/sample).

This issue closes the parity gap so reference images and canvas behave identically
under mouse input.

## Resolved design

After grilling through the design tree, the following decisions are committed:

- **Tool gating (mouse): eyedropper-only** — mirrors canvas where sampling is
  tool-gated. Touch/pen long-press remains global (any tool) per #061's
  "no-modifier-key on touch" fallback rationale.
- **Async decode race for fast clicks: pending-commit pattern** — a `#endPending`
  boolean in `tab-state.svelte.ts` lets `referenceSampleEnd` defer commit when
  decode hasn't resolved; the in-flight `referenceSampleStart` checks the flag
  after `samplingSession.start()` and commits immediately if set. New session
  starts reset the flag, so multiple fast clicks don't leak state. No
  last-move-coords tracking — decode is fast enough that down-coord commit is
  acceptable.
- **Detector reuse for mouse: bypass** — `createLongPressDetector` stays focused
  on "hold-time + jitter tolerance"; mouse path branches in `ReferenceWindow`
  with a small `mouseSampling` boolean. Adding an "immediate-fire" mode to the
  detector would muddy its single responsibility.
- **API surface: remove `onSamplePixelAt`, add `quickSamplingEnabled: boolean`** —
  both touch short-tap and mouse press route through `onSampleStart/Move/End`
  lifecycle gated by the new boolean. Removes the dual-purpose
  (callback + presence-as-flag) overloading of `onSamplePixelAt`. Deletes
  `referenceSampleCommit`, `handleReferenceSampleCommit`, and the
  `onSamplePixel` overlay prop — single sampling code path.
- **`inputSource` plumbing** — `onSampleStart` gains a third parameter
  `inputSource: LoupeInputSource`. ReferenceWindow passes `'mouse'` from the
  mouse branch and `'touch'` from the long-press detector's `onFire`. Pen stays
  on `'touch'` per #061 (centered loupe offset; finger/hand occlusion still
  applies). Propagated through overlay → editor-controller → tab-state →
  `referenceSamplingSession.start`.
- **Test strategy** — three layers (`tab-state.svelte.test.ts` for state
  machine, `ReferenceWindow.svelte.test.ts` for component, light delegation
  tests in `editor-controller.svelte.test.ts`) + manual desktop verification
  via `bun run dev`. No new Playwright e2e — vitest covers the loupe DOM and
  state-level color updates adequately.

## Blocked by

- [061 — Reference images: long-press + drag color sampling](061-reference-images-long-press-sampling.md) (done)
- [079 — Reference images — long-press sampling loupe](079-reference-images-long-press-loupe.md) (done) — provides the loupe lifecycle this issue extends to mouse.

## Related

- Sibling slice of PRD [053 — Floating reference image windows](053-floating-reference-window.md).
- Mirrors canvas Eyedropper sampling lifecycle in
  `src/lib/canvas/canvas-interaction.svelte.ts:219-240` and
  `src/lib/canvas/tools/eyedropper-tool.ts`.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Added `inputSource: LoupeInputSource` parameter to `referenceSampleStart`; introduced `#endPending` flag so a release before async decode resolves still commits via the in-flight start; removed `referenceSampleCommit` (single sampling path now). |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Added `inputSource` parameter to `handleReferenceSampleStart`; removed `handleReferenceSampleCommit`; trimmed unused `_blob` parameter from `handleReferenceSampleMove` after overlay cleanup. |
| `src/lib/reference-images/ReferenceWindow.svelte` | Added `quickSamplingEnabled` prop replacing the dual-purpose `onSamplePixelAt` callback-as-flag; mouse pointerdown (when `quickSamplingEnabled`) now engages the `onSampleStart`/`Move`/`End` lifecycle with `inputSource: 'mouse'`; touch short-tap routes through the same lifecycle; added `draggable="false"` on the `<img>` to prevent native HTML5 drag from intercepting mouse pointermove. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte` | Replaced `onSamplePixel` (instant-commit) with the lifecycle prop trio + `quickSamplingEnabled` forwarding; dropped redundant `blob` parameter from `onSampleMove`/`onSampleEnd`. |
| `src/routes/editor/+page.svelte` | Replaced `onSamplePixel={editor.activeTool === 'eyedropper' ? editor.handleReferenceSampleCommit : undefined}` with `quickSamplingEnabled={editor.activeTool === 'eyedropper'}` at both docked and tabs sites. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Replaced `referenceSampleCommit` tests with pending-commit-pattern coverage (release-before-decode commits, decode failure stays silent, new start clears pending, `inputSource` plumbed to loupe positioning). |
| `src/lib/reference-images/ReferenceWindow.svelte.test.ts` | Removed `onSamplePixelAt` tests; added mouse start/move/up/single-click + `quickSamplingEnabled` gating + touch short-tap unification + `draggable="false"` regression-defense. |
| `src/lib/reference-images/ReferenceWindowOverlay.svelte.test.ts` | Updated forwarding tests to assert `quickSamplingEnabled` + `inputSource` plumbing on `onSampleStart`. |

### Key Decisions

- **Tool gating (mouse): eyedropper-only** — mirrors canvas Eyedropper. Touch/pen long-press remains tool-independent (per #061's no-modifier-key fallback rationale).
- **Async decode race: pending-commit pattern** — a `#endPending` boolean lets `referenceSampleEnd` defer commit when decode hasn't resolved; the in-flight `referenceSampleStart` checks the flag after `samplingSession.start()` and commits immediately if set. New session starts reset the flag, so multiple fast clicks don't leak state.
- **Detector reuse: bypass for mouse** — `createLongPressDetector` stays focused on hold-time + jitter tolerance; mouse path branches in `ReferenceWindow` with a small `isMouseSampling` flag. Keeps the detector single-responsibility.
- **API surface: remove `onSamplePixelAt`, add `quickSamplingEnabled`** — both touch short-tap and mouse press route through the same `onSampleStart`/`Move`/`End` lifecycle gated by the boolean. Single sampling code path; no callback-as-flag overloading.
- **`inputSource` plumbing** — `onSampleStart`'s third argument flows ReferenceWindow → overlay → editor-controller → tab-state → `referenceSamplingSession.start`. Mouse passes `'mouse'`; touch/pen long-press passes `'touch'` (centered loupe offset still applies to pen per #061).

### Notes

- The `<img draggable="false">` fix surfaced during desktop manual verification: native HTML5 drag was hijacking `pointermove` so the loupe never tracked the cursor. happy-dom doesn't simulate native drag, so a vitest-only suite would have shipped this regression. Added an attribute-presence test as the regression line.
- PRD 053 (Floating reference image windows) was already closed when issue 079 finished. This issue is a desktop-parity follow-up under that lineage; the PRD remains `done`.
