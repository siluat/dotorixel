---
title: "Constrain latch mid-stroke toggle — immediate in-flight refresh"
status: done
created: 2026-06-11
parent: 168-touch-modifier-alternatives.md
---

## Parent

[168 — Touch modifier alternatives — touch-reachable Shift-constrain](168-touch-modifier-alternatives.md)

## What to build

Keyboard-Shift parity for mid-stroke latch toggles. Pressing or releasing Shift during a stroke fires a modifier-change notification so the in-flight shape re-resolves *immediately*, even while the pointer is stationary. After issue 169 the Constrain latch already affects subsequent draw samples (tools live-read the held state), but a stationary pointer shows no change until it moves.

End-to-end behavior:

- Toggling the Constrain latch while a stroke is in progress fires the same modifier-change path keyboard Shift uses: the in-flight shape or Floating Selection snaps to its constraint (toggle on) or returns to free-form (toggle off) without any pointer movement.
- Toggling while idle (no active stroke) fires no notification — it only flips the latch.
- Touch demo: start dragging a rectangle with one finger, tap the Constrain toggle with a second finger (the strip sits outside the canvas, so this does not collide with two-finger pinch detection on the canvas) → the rectangle snaps to a square immediately; tap again → free-form immediately.

Covers parent user stories 10 and 11.

## Acceptance criteria

- Toggling the latch during an active stroke triggers the same modifier-change notification path as keyboard Shift, and the in-flight result re-resolves with the pointer stationary.
- Toggling the latch while no stroke is active does not fire the modifier-change notification.
- The behavior matches keyboard Shift's existing mid-stroke semantics for both directions (constrain on, constrain off).
- Tests mirror the existing keyboard mid-stroke modifier tests: notification fired on toggle-while-drawing, not fired on toggle-while-idle, and a shape session re-resolves its constraint across the notification.

## Blocked by

None - can start immediately (169 shipped via PR #266)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | `toggleConstrain` fires `activeTab.modifierChanged()` when a stroke is active — the same seam keyboard Shift enters |
| `src/lib/canvas/editor-session/editor-controller.svelte.test.ts` | Mid-stroke latch tests mirroring the keyboard ones: on/off pixel re-resolve with a stationary pointer, notification fired while drawing, not fired while idle |

### Key Decisions

- **Orchestration on the controller command, not the latch.** `ConstrainLatch` stays a pure state holder; `EditorController.toggleConstrain` does the flip-then-notify, mirroring how `keyboard-input` guards `notifyModifierChange` behind `isDrawing`. Both UI entry points (touch strip re-tap, docked toolbar) route through this one command, so no per-toolbar wiring was needed.
- **No new seam.** The toggle reuses `activeTab.modifierChanged()` — the path keyboard Shift already takes — so every downstream re-resolver (shape snapshot redraw, Marquee preview, Floating Selection axis lock) works unchanged.

### Notes

- The `isDrawing` guard at the command implements the spec's "idle toggle fires no notification" contract; downstream `tool-runner.modifierChanged()` would no-op anyway, but the non-firing itself is part of the acceptance criteria (verified by spy, mirroring the keyboard tests).
- Selection-tool re-resolve is covered transitively: the latch enters the same notification path keyboard Shift uses, whose downstream behavior existing stroke-engine / shape-tool / selection-tool tests already pin.
- Completes parent PRD 168 — the latch now has full keyboard-Shift parity (live-read per sample from 169 + immediate mid-stroke refresh from this issue).
