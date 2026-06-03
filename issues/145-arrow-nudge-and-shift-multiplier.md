---
title: "Arrow nudge + Shift 10× multiplier — auto-lift, stack into one buffer"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Arrow keys translate the selected pixels by 1 px; Shift+arrow by 10 px. The first arrow press auto-lifts the Marquee region into a Floating Selection; subsequent presses stack translations into the same buffer until something commits the Floating (tool switch, Cmd+V, Clear Canvas, Delete Layer, or pointer-down outside).

Scope:

- **Keyboard input** (`keyboard-input.svelte.ts`): `nudgeMarquee(dx, dy)` host callback fires on arrow keys with `dx` ∈ {-1, 0, 1} (1 with Shift becomes 10 by the keyboard layer).
- **Selection stroke session** (`tools/selection-tool.ts`) — or a dedicated `FloatingSelection` controller — handles nudge:
  - If no Floating Selection is active: auto-lift the Marquee region (call `lift_marquee_pixels()`, clear source pixels) and create a Floating with `{ offset: (dx, dy) }`.
  - If a Floating Selection is already active: update the existing offset (`offset.dx += dx; offset.dy += dy`); do not commit yet.
- **Commit conditions** (already implied by 142's tool-switch behavior): tool switch / pointer-down outside / Cmd+V / Clear Canvas / Delete Layer commits the current Floating with the accumulated offset.
- **`SelectionOverlay.svelte`**: re-renders on every nudge to track the new offset.
- Reference-Layer-active = silent no-op.

Implementation notes:

- Each arrow press should NOT push a separate undo snapshot. The accumulated translation commits as one journal `commit-floating-selection` on Floating resolve.
- The keyboard handler's existing `isTextInputTarget` guard applies — arrows in text inputs do not nudge.

Tests:

- Arrow with active Marquee (no Floating) auto-lifts and translates by 1.
- Shift+Arrow translates by 10.
- Multiple arrow presses stack into the same Floating buffer (single offset accumulator).
- Tool switch after nudge commits the accumulated offset with one journal entry; Undo restores pre-nudge state.
- Arrow with no Marquee is silent no-op.
- Arrow on Reference-Layer-active Document is silent no-op.
- Off-canvas nudging is clipped on commit (consistent with 142's clipping).

## Acceptance criteria

- Arrow with active Marquee auto-lifts and translates by 1 px.
- Shift+Arrow translates by 10 px.
- Subsequent arrows accumulate into the same Floating Selection.
- The accumulated offset commits as ONE journal entry when something resolves the Floating.
- Arrow with no Marquee is silent no-op.
- Arrow on Reference-Layer-active Document is silent no-op.

## Blocked by

- [142 — Selection drag-to-move](142-selection-drag-to-move.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/keyboard-input.svelte.ts` | Added arrow-key Marquee nudge routing with Shift as a 10× multiplier while preserving text-input and modifier-key guards. |
| `src/lib/canvas/editor-session/create-editor-controller.ts` | Wired keyboard nudge events into the active tab session. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Added Marquee auto-lift nudge, stacked Floating Selection offsets, Undo cancel behavior, and commit-before-document-change safeguards. |
| `src/lib/canvas/editor-session/workspace.svelte.ts` | Commits an active Floating Selection before switching tools. |
| `src/lib/canvas/keyboard-input.svelte.test.ts` | Covered arrow directions, Shift multiplier, drawing guard, and text-input guard. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Covered auto-lift, stacked nudges, silent no-ops, off-canvas clipping, Undo cancel, commit boundaries, and UI-state non-commit behavior. |
| `src/lib/canvas/editor-session/workspace.svelte.test.ts` | Covered tool-switch commit and undo restoration after an accumulated nudge. |

### Key Decisions

- Nudge is a transient Floating Selection preview until a real resolving action commits it, so repeated arrow presses do not create per-key undo snapshots.
- Undo cancels an uncommitted Floating Selection before touching document history; Escape continues to use the same cancel path.
- Document-changing commands commit a live Floating Selection first, while pure UI state changes do not.

### Notes

- `bun run check` and `bun run test` passed. The full test run covered 75 files and 1259 tests.
- Cut, paste, and action-bar flows remain follow-up Selection PRD slices.
