---
title: "Selection drag-to-move — LiftAndDrag + commit + Undo restores Marquee position"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

The core move interaction: drag inside an existing Marquee → lift selected pixels into a transient Floating Selection buffer → translate → release commits the buffer back at the new offset as one undoable step. Undo restores both the pixel state and the Marquee position.

Scope:

- **Selection stroke session** (`tools/selection-tool.ts`): add the `LiftAndDrag` mode. When a drag begins inside the existing Marquee:
  - On stroke `start`: snapshot the active layer pixels (for restoration on cancel), call `lift_marquee_pixels()` (introduced in 136) to get the floating buffer, immediately `clear_marquee_pixels()` so the source region appears transparent.
  - On `draw`: update the Floating Selection's current offset (transient TS state) and trigger render invalidation so the overlay tracks.
  - On `end` (release): commit via `commit-floating-selection: { sourceRegion, destOffset, buffer }` journal intent. The intent composites the buffer at the destination and updates the Marquee position to wrap the buffer's new location.
- **Document Change Journal**: new `commit-floating-selection` intent. Captures one undo snapshot covering source-clear, destination-composite, **and the Marquee position change**. Undo restores all three; Redo re-applies.
- **`SelectionOverlay.svelte`**: extend to track the Floating Selection's current offset. When a Floating Selection is active, the marching ants render at `{ marquee.x + floating.dx, marquee.y + floating.dy, marquee.width, marquee.height }` — the ants follow the buffer as it moves.
- **Floating Selection state**: lives in TS (transient, not persisted). A `FloatingSelection` interface holding `{ buffer: Uint8Array, sourceRegion: MarqueeRegion, offset: { dx, dy } }`. Owned by the active tab's editor session.
- **Cursor**: `grabbing` while `LiftAndDrag` is in progress; restored to `move` (inside) / `crosshair` (outside) on commit.
- **Out-of-canvas clipping**: when the destination offset pushes part of the buffer past the canvas edge, the commit clips at canvas boundaries.

Tests:

- Selection stroke session: drag-from-inside enters `LiftAndDrag`; source region clears immediately; release commits.
- Journal: `commit-floating-selection` captures one undo snapshot. Undo restores source pixels, destination pixels, AND Marquee position.
- Redo re-applies the move.
- Off-canvas drag is clipped on commit.
- Floating Selection on Reference-Layer-active Document no-ops (matches PRD-105 / 138).
- Selection stroke session: a fresh stroke after a previous commit operates on the new Marquee position.

## Acceptance criteria

- Drag from inside Marquee lifts pixels into a Floating buffer and clears source immediately.
- Drag preview shows the marching-ants outline tracking the offset.
- Release commits one journal entry capturing source clear + destination composite + Marquee position update.
- Undo restores source pixels, destination pixels, and the Marquee position in a single step.
- Redo reverses Undo.
- Off-canvas pixels are clipped on commit.

## Blocked by

- [136 — Region pixel transformations (lift/clear/composite) + Delete keyboard](136-region-pixel-transformations-and-delete.md)
