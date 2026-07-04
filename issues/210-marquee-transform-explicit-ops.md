---
title: "Marquee Transform — explicit region ops, drop the Marquee-presence dispatch (core + WASM + web)"
status: done
created: 2026-07-04
parent: 207-tiered-canvas-marquee-transforms.md
---

## Parent

[207 — Tiered transforms PRD](207-tiered-canvas-marquee-transforms.md)

## What to build

The closing slice: with the settings sheet and right panel now dispatching the
Canvas Transform ops (208 / 209), narrow the original flip/rotate operations to
the **Marquee Transform tier**. Remove the Marquee-presence dispatch and the
now-unreachable no-Marquee branches (the old active-cel flip and the
whole-document rotate path inside the legacy ops), and align the operation and
journal-intent names with the Marquee Transform domain term. The
SelectionActionBar dispatches these marquee ops explicitly. A marquee op stays
a no-op without a Marquee or while a Reference Layer is active — and a no-op
must not push a History entry or mark the Document dirty.

Align the facade doc comments and the fake document with the two-tier contract,
and update the platform-status Flip/transform row's note to describe the tiers.

## Acceptance criteria

- The SelectionActionBar's flip/rotate transform only the Marquee region of the
  active Pixel Layer's active-frame Cel — existing region behavior is
  unregressed (flip keeps the Marquee position; rotate re-centers the `H×W`
  block, clips to the canvas, and updates the Marquee to wrap it).
- A select-all Marquee plus a marquee flip mirrors a single layer's active
  Cel — the old single-cel flip capability remains achievable.
- A marquee op without a Marquee, or while a Reference Layer is active, leaves
  the Document unchanged and pushes no undo entry / dirty mark.
- No transform operation changes scope based on Marquee presence — the
  Marquee-presence dispatch is gone from the core, and the unreachable legacy
  branches are deleted.
- Journal intents are cleanly split into canvas and marquee variants; the WASM
  structural-compatibility check stays green; the fake document matches.
- The platform-status Flip/transform row describes the Canvas / Marquee
  Transform tiers; facade doc comments match the CONTEXT.md vocabulary.
- `cargo build --workspace` stays green (Apple binding untouched).

## Blocked by

- [208 — Canvas Flip](208-canvas-flip-whole-document.md)
- [209 — Canvas Rotate](209-canvas-rotate-explicit-op.md)
  (the trigger surfaces must already be on the canvas ops before the legacy
  ops can be narrowed to the Marquee tier)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | `flip_horizontal`/`flip_vertical`/`rotate_cw`/`rotate_ccw` → `flip_marquee_*`/`rotate_marquee_*`; Marquee-presence dispatch and unreachable no-Marquee branches (`flip_whole` param, whole-document rotate fallback) deleted; marquee ops are structural no-ops without a Marquee or on a Reference Layer. Tests: no-op + select-all acceptance tests added; 6 no-marquee tests deleted (covered by the canvas suite); 2 uncovered ones ported as canvas tests (reference source/dims preservation, four-turn round-trip with a reference); frames grid-invariant test converted to canvas ops |
| `wasm/src/lib.rs` | 4 bindings renamed, doc comments aligned; 4 marquee smoke tests added |
| `src/lib/canvas/canvas-model.ts` | Facade methods renamed; doc comments state the two-tier contract in CONTEXT.md vocabulary |
| `src/lib/canvas/fake-drawing-ops.ts` | Fake document stubs renamed to match the facade |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Intents split: `flip-marquee-*`/`rotate-marquee-*` alongside `*-canvas-*`; all 4 marquee ops share the `marquee && pixel` guard (no snapshot/dirty on no-op); rotate-marquee joined the no-metrics-sync after-change group |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `flipMarqueeHorizontal`/`flipMarqueeVertical`/`rotateMarqueeCw`/`rotateMarqueeCcw` |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Handlers renamed (`handleFlipMarqueeHorizontal` etc.) |
| `src/routes/editor/+page.svelte` | SelectionActionBar wiring points at the marquee handlers |
| `crates/core/src/layer.rs` | `canvases_mut()` doc comment: stale "whole-Document transforms (rotate)" → "Canvas Transforms" (flip uses it too since 208) |
| `docs/platform-status.md` | Flip/transform row describes the Canvas / Marquee Transform tiers |
| `CONTEXT.md` | Marquee Transform definition now states the no-op contract (no History entry, no dirty mark) |

### Key Decisions

- **Naming `flip_marquee_horizontal`** (`<verb>_<scope>_<axis>`), mirroring `flip_canvas_horizontal` and `clear_marquee_pixels` — confirmed with the user over `marquee_flip_horizontal`.
- **Shell renames included** (TabState methods + controller handlers) since canvas/marquee variants share one namespace there; **SelectionActionBar/PixelCanvasView props kept** (`onFlipHorizontal` etc.) — inside the component everything is Marquee-scoped, so the short names stay unambiguous.
- **No-op enforcement is layered, not duplicated**: the core op defines the semantics (returns without touching the Document); the journal's `#willChange` guard owns the shell policy (no History snapshot, no dirty mark). Both are required by the acceptance criteria and serve different owners.

### Notes

- `PixelCanvas::flip_horizontal`/`rotate_cw` (buffer primitives) intentionally keep their names — only `Document`-level ops carry tier names.
- Whole-document rotation survives as the internal `rotate_whole_document`, now reachable only through `rotate_canvas_*`.
- Closes the PRD: with 206/208/209, no transform operation changes scope based on Marquee presence anywhere in the product.
