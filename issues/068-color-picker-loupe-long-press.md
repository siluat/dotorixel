---
title: Color picker loupe — long-press touch entry
status: done
created: 2026-04-16
parent: 063-color-picker-loupe.md
---

## What to build

Wires the existing 400ms long-press gesture (currently implemented in `canvas-interaction.svelte.ts` as a direct call to `handleLongPress`) into the sampling session controller. After this slice, long-pressing on touch with any active tool opens the loupe identically to how the Eyedropper tool press does on mouse: live preview during finger movement, commit on release, transparent / null edge cases honored (because slice 066 already taught the session those rules).

The active tool is not changed during long-press; the sampling session runs in parallel. After release, the active tool resumes seamlessly.

See parent PRD §"Implementation Decisions" → "Interaction Model" and "Modules — Modified" → `canvas-interaction.svelte.ts`.

## Acceptance criteria

- `canvas-interaction.svelte.ts` long-press handler updated: instead of calling `handleLongPress` directly, it invokes `samplingSession.start` with the pressed coordinates and commit target (left button → FG; right button → BG).
- Subsequent pointer-move events while a long-press session is active forward to `samplingSession.update`.
- The release event commits the session via `samplingSession.commit`.
- The active tool is unchanged before, during, and after the long-press session.
- Long-press input source is reported as touch so `loupe-position` (slice 067) uses the touch offset; if this slice lands before slice 067, the touch offset is approximated against the design spec value.
- Existing long-press unit / behavior tests in `canvas-interaction` updated to assert delegation to `samplingSession` rather than direct color-pick.
- Playwright E2E: simulate a touch long-press on a colored canvas pixel, drag to another colored pixel, release → FG matches the final pixel's color and the loupe was visible during the gesture.

## Blocked by

- [065 — drag-and-commit eyedropper + basic loupe](065-color-picker-loupe-drag-commit.md)

## Scenarios addressed

- Scenario 5
- Scenario 6

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/canvas-interaction.svelte.ts` | Replaced legacy one-shot `onLongPress` callback with a session-style trio (`onSampleStart` / `onSampleUpdate` / `onSampleEnd`). Added a `'sampling'` interaction state; long-press timer transitions into it when `onSampleStart` returns `true`. Sampling branch in `pointerMove` forwards canvas coords; `pointerUp`, `pointerLeave`, `blur`, and two-touch pointerdown all tear the session down via `onSampleEnd`. |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | Removed the legacy `long-press` suite; replaced with two new suites (`sampling — long-press entry` and `sampling — during session`) asserting delegation to the sampling callbacks, the 400ms threshold, cancellation on move/end-before-timer, and update/commit propagation during the session. |
| `src/lib/canvas/editor-state.svelte.ts` | Removed `handleLongPress` (direct `get_pixel` → FG/BG assignment). Added `handleSampleStart` / `handleSampleUpdate` / `handleSampleEnd` that delegate to `samplingSession`, choose `commitTarget` from the mouse button, set `inputSource: 'touch'` only for actual touches, and short-circuit when the active tool is already `eyedropper`. |
| `src/lib/canvas/editor-state.svelte.test.ts` | Replaced the long-press suite with `EditorState — sampling session (touch long-press)` covering FG/BG commit, transparent-no-commit, `isActive` lifecycle, touch vs pen input source, update re-sampling, recent-color append, active-tool preservation, eyedropper short-circuit, and no-undo-snapshot invariant. |
| `src/lib/canvas/PixelCanvasView.svelte` | Replaced `onLongPress` prop with the three new session props; wired them through `createCanvasInteraction`. |
| `src/routes/editor/+page.svelte` | Both docked and tab-layout `PixelCanvasView` usages switched to the new three-handler wiring. |
| `e2e/editor/drawing.test.ts` | Added `touch long-press opens loupe and drag-release commits final pixel color`. Dispatches raw PointerEvents (the desktop chromium project has no native touch long-press), verifies the loupe shows on press + stays visible mid-drag + hides on release, and asserts the final FG matches the release pixel's color, not the press-point color. |

### Key Decisions

- **Session delegation over session injection.** `canvas-interaction` does not import `samplingSession`; it calls three framework-agnostic callbacks that `EditorState` wires to the session. This keeps `canvas-interaction` free of domain types (`CanvasCoords` aside) and preserves its "structural core" status per CLAUDE.md Architecture.
- **Eyedropper tool short-circuits the long-press path** by returning `false` from `onSampleStart`. The active-tool path already drives sampling through the normal drawing lifecycle, so a parallel long-press would double-start. Returning `false` leaves the pending touch draw intact rather than suppressing it, matching the "no behavior change for the Eyedropper user" requirement.
- **Commit on any session-ending event.** `pointerLeave`, `blur`, and a second touch all call `onSampleEnd` (not a new `cancel`). This is safe because `samplingSession.commit()` already returns `NO_EFFECTS` when the center is null/transparent, so "commit on exit" matches "cancel" behavior for invalid targets without adding a second code path.
- **`inputSource: 'touch'` only for real touches.** `pen` (Apple Pencil) falls back to `'mouse'` so the loupe uses the smaller cursor offset. Touch devices get the larger finger-offset from the design spec.

### Notes

- The desktop Playwright chromium project does not emit real touch events, so the E2E simulates the gesture by dispatching `PointerEvent`s with `pointerType: 'touch'` directly. The first run failed because `pointermove` was dispatched on `window`, which routes to `canvasInteraction.windowPointerMove` (pinch/pan only — no sampling branch). Dispatching on the canvas element correctly reaches the in-canvas `pointerMove` handler. This pairing is load-bearing; future refactors of either listener must keep the sampling branch on the canvas-scoped path.
- No manual browser touch verification was performed — the project does not currently have a touch-capable test device in the loop. Regression coverage relies on the new E2E plus the unit tests. If a real-device regression surfaces, add a manual-test checkpoint to future touch-input PRs.
