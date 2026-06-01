---
title: "Selection drag-to-move — LiftAndDrag + commit + Undo restores Marquee position"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tools/selection-tool.ts` | Added drag-from-inside Marquee mode that starts, moves, commits, or cancels a Floating Selection through tool effects. |
| `src/lib/canvas/draw-tool.ts` | Added Floating Selection effects to the tool effect contract. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Owns transient Floating Selection state, clears source pixels during drag, renders live preview, restores on cancel, commits through the journal, and keeps snapshots free of in-flight transient pixels. |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Added one-step undoable Floating Selection commit that restores source pixels and Marquee position on undo. |
| `src/lib/canvas/SelectionOverlay.svelte` | Projects the marching-ants overlay at the active Floating Selection offset while dragging. |
| `src/lib/canvas/PixelCanvasView.svelte` | Wires Floating Selection offset into overlay and cursor affordances. |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Exposes the active tab Floating Selection offset to the editor route. |
| `src/routes/editor/+page.svelte` | Passes Floating Selection offset into desktop and mobile canvas views. |
| `src/lib/canvas/**/*.{test.ts,svelte.test.ts}` | Added coverage for selection stroke effects, commit/undo/redo, off-canvas clipping, live preview layer order, snapshot safety, overlay projection, cursor affordances, and Reference Layer no-op behavior. |

### Key Decisions

- Floating Selection state stays web-shell transient instead of being persisted; `toSnapshot()` serializes the pre-lift source pixels if a session flush happens mid-drag.
- Live preview is composited at the active Pixel Layer's stack position so upper visible layers can cover the moving selection.
- Commit restores the pre-lift baseline before capturing history, then clears the source and composites the buffer at the destination as one undoable document change.

### Notes

- Escape cancel, axis lock, keyboard nudge, clipboard, cut, paste, and Selection action bar states remain in follow-up Selection sub-issues.
- The live-preview blend path is currently implemented in the web shell; move it into shared/core rendering if Apple parity needs the same Floating Selection preview.
