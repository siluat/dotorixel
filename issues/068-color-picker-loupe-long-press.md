---
title: Color picker loupe — long-press touch entry
status: open
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
