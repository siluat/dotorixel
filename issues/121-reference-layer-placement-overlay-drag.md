---
title: "Reference Layer: placement overlay — drag-to-move (body) + drag-to-scale (corner handles)"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Add pointer interaction to the placement overlay. When the Move tool is active, the body translates the Reference underlay placement; the four corner handles uniformly scale the placement around the opposite corner regardless of the selected tool. Pointer-drag previews live in real time without committing; on release a single Document snapshot commits via `set_reference_placement`. Escape / pointer-cancel during drag drops the preview without committing.

Scope:

- Three interaction zones:
  - **Corner handles**: drag to uniform-scale around the opposite corner anchor. Cursors `nwse-resize` / `nesw-resize` per corner.
  - **Body**: drag to translate only while the Move tool is active. Cursor `move` only in that state.
  - **Outside placement**: tool default; no overlay interaction.
- Live preview: during drag, the overlay rectangle and Reference underlay re-render from a local draft placement. `Document.composite()` is not involved.
- On release, push one Document snapshot and call `set_reference_placement`.
- Escape / pointer-cancel during drag drops the draft placement and restores the committed placement with no snapshot.
- Minimum projected size: clamp to 8x8 document pixels.
- Maximum size: unbounded; footprint overflow is allowed and clipped by the viewport/document frame. While the Reference Layer is active, viewport pan bounds include the projected Reference footprint so the actual corner handles remain reachable by panning.
- Touch hit-area extension: invisible padding around handles clears the 44pt iOS HIG target.

## Acceptance Criteria

- With the Move tool active, drag on body translates the Reference underlay; release commits one snapshot.
- With a non-Move tool active, drag on body does not translate the Reference underlay and pushes no snapshot.
- Drag on a corner handle scales uniformly around the opposite corner; release commits one snapshot.
- Cursors per zone match the scope above.
- Pointer-cancel or Escape during drag reverts preview and pushes no snapshot.
- Drag preview is live: both overlay and underlay reflect the in-progress placement.
- Preview/commit do not require Reference pixels in `Document.composite()`.
- Minimum projected size 8x8; corner-drag below the floor clamps.
- When the projected footprint extends beyond the visible document bounds, pan can move to the projected footprint so the actual corner handles remain reachable.
- Touch hit-area is at least 44pt around each handle.
- Edge-midpoint handles are not rendered.
- The committed placement matches the previewed placement at release.

## Blocked By

- [120 — placement overlay shell](120-reference-layer-placement-overlay-shell.md)

## User Stories Addressed

- #11, #13, #25.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/viewport.rs` | Added document-bounds pan clamping so active Reference footprints can expand navigation bounds without moving handles away from their actual corners. |
| `wasm/src/lib.rs`, `src/lib/canvas/viewport.ts`, `src/lib/canvas/wasm-backend.ts` | Exposed the document-bounds pan clamp through the web viewport backend. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Expanded pan bounds to include the active visible Reference footprint, reclamped when Reference state changes, and made Reference underlay projection react immediately to render changes. |
| `src/lib/canvas/PixelCanvasView.svelte` | Added live draft placement preview, Move-tool-only body translation, direct corner scaling, drag cancellation, and touch/pan/pinch preservation. |
| `src/lib/canvas/ReferenceLayerPlacementOverlay.svelte` | Added handle hit zones and Move-only body cursor while keeping handles anchored to the true projected corners. |
| `src/routes/editor/+page.svelte` | Wired placement commits from the canvas view back to the active Reference Layer. |
| `src/lib/canvas/PixelCanvasView.svelte.test.ts`, `src/lib/canvas/ReferenceLayerPlacementOverlay.svelte.test.ts`, `src/lib/canvas/editor-session/tab-state.svelte.test.ts`, `src/lib/canvas/viewport.test.ts`, `e2e/editor/layers.test.ts` | Added regression coverage for drag preview, commit/cancel behavior, Move-tool gating, handle reachability, and immediate fit-to-canvas visibility. |
| `issues/105-reference-layer-type.md`, `issues/124-reference-layer-drawing-tools-no-op-and-cursor.md` | Updated the PRD and follow-up issue to reflect Move-tool body drag and expanded pan bounds. |

### Key Decisions

- Body drag is limited to the Move tool; corner handles remain direct placement controls regardless of the selected tool.
- Viewport pan/navigation bounds expand to include the active Reference footprint instead of pinning resize handles inside the visible document area.
- Reference fit-to-canvas and placement projections subscribe to render changes so the result is visible immediately.

### Notes

- Keyboard nudge and non-Move drawing-tool cursor/no-op polish remain in sibling issues. Shift integer-scale snapping was later cancelled in issue 122.
