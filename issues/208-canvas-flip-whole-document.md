---
title: "Canvas Flip — whole-document flip with Marquee co-transform (core + WASM + web)"
status: done
created: 2026-07-04
parent: 207-tiered-canvas-marquee-transforms.md
---

## Parent

[207 — Tiered transforms PRD](207-tiered-canvas-marquee-transforms.md)

## What to build

The first Canvas Transform vertical slice, and the tracer bullet that
establishes the tier's patterns. Add a pair of **canvas-flip operations**
(horizontal / vertical) to the core `Document`: mirror **every Pixel Layer's
every Cel** in place across the canvas axis; canvas dimensions unchanged; the
Reference Layer untouched; an active Marquee mirrored across the same axis and
clipped to the canvas (always non-empty, since the source rectangle was
in-bounds). Expose the ops through the WASM binding and the TS `Document`
facade (plus the fake), route them through a new undoable journal intent, and
wire the settings sheet's and right panel's Flip buttons to dispatch the canvas
op **always** — no Marquee-presence dispatch. Give those buttons new
canvas-scoped labels (direction: "Flip Canvas Horizontal"; exact copy follows
the existing i18n patterns) in en/ko/ja.

The SelectionActionBar and the existing marquee-aware flip operations are left
untouched in this slice — narrowing them to the Marquee tier is a later slice.

Patterns this slice establishes for the rest of the PRD: canvas-op naming, the
canvas/marquee journal-intent naming, the Marquee co-transform mapping, and the
canvas-scoped label key structure.

## Acceptance criteria

- On a multi-layer, multi-frame Document, a canvas flip mirrors every Pixel
  Layer's every Cel (asserted via pixel coordinates on more than one layer and
  more than one frame); canvas dimensions are unchanged.
- Applying the same canvas flip twice restores the original Document (identity
  round-trip).
- With a Reference Layer present, a canvas flip leaves its placement (x, y,
  scale, quarter-turn) and source untouched.
- An active Marquee is mirrored across the canvas axis so it covers the same
  (now flipped) content, and remains non-empty.
- With a Marquee active, the settings-sheet / right-panel Flip buttons still
  transform the whole canvas — they never switch to region mode.
- A canvas flip is a single Document History entry: one undo restores pixels
  and Marquee together. It stops Playback and commits a pending Floating
  Selection first (the existing mutate path).
- A canvas flip applies even while the Reference Layer is the active layer.
- New canvas-scoped labels exist in en/ko/ja; SelectionActionBar labels are
  unchanged.
- The WASM structural-compatibility check stays green; the fake document
  implements the new interface.
- Existing marquee-aware flip behavior (including via the SelectionActionBar)
  is unregressed.
- `cargo build --workspace` stays green (Apple binding untouched).

## Blocked by

None — can start immediately.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | `flip_canvas_horizontal` / `flip_canvas_vertical` + shared `flip_canvas` helper (fn-pointer idiom of `flip_active_pixel_layer`); 7-test canvas-flip suite |
| `crates/core/src/selection.rs` | `MarqueeRegion::mirrored_horizontal` / `mirrored_vertical` (canvas-axis mirror, composed with existing `clip_to`) |
| `wasm/src/lib.rs` | `WasmDocument` delegations + 2 native smoke tests |
| `src/lib/canvas/canvas-model.ts` | `Document` facade methods with contract docs |
| `src/lib/canvas/fake-drawing-ops.ts` | Fake document stubs (interface parity) |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | `flip-canvas-horizontal` / `flip-canvas-vertical` intents across apply / would-change / post-commit switches |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `flipCanvasHorizontal` / `flipCanvasVertical` through `#mutate` (playback stop + Floating Selection commit) |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | `handleFlipCanvasHorizontal` / `handleFlipCanvasVertical` (old handlers kept for SelectionActionBar) |
| `src/lib/ui-editor/SettingsContent.svelte`, `RightPanel.svelte` | Flip buttons renamed to `onFlipCanvasHorizontal` / `onFlipCanvasVertical` props + canvas-scoped labels |
| `src/routes/editor/+page.svelte` | Panels wired to canvas handlers; PixelCanvasView → SelectionActionBar wiring untouched |
| `messages/{en,ko,ja}.json` | `action_transformFlipCanvasHorizontal` / `action_transformFlipCanvasVertical` |
| Tests | Journal (2), TabState (5, incl. playback stop + FS commit), component suites updated (labels + props), stories stubs renamed |

### Key Decisions

- **Verb-first naming chain established for the PRD**: core `flip_canvas_horizontal` ↔ intent `'flip-canvas-horizontal'` ↔ TabState `flipCanvasHorizontal` ↔ prop `onFlipCanvasHorizontal` ↔ key `action_transformFlipCanvasHorizontal` ↔ label "Flip Canvas Horizontal". Later slices follow: `rotate_canvas_cw` (209), `flip_marquee_horizontal` (210).
- **Journal semantics**: would-change is always `true` (active-layer-agnostic Canvas Transform); post-commit joins the `invalidateRenderAndMarkDirty` bucket — a canvas flip keeps dimensions, so no metrics sync / viewport reclamp (unlike whole-document rotate).
- **Marquee mirror math lives on `MarqueeRegion`** next to `rotated_90`/`clip_to`; the mirror is clipped after mapping, so a partially off-canvas Marquee stays valid (edge-case test included).

### Notes

- SelectionActionBar and the marquee-aware `flip_horizontal`/`flip_vertical` are intentionally untouched — narrowing them to the Marquee tier is slice 210.
- The panels' Rotate buttons still dispatch the old `rotate-cw`/`rotate-ccw` (Marquee-presence dispatch) until slice 209.
- Labels: ko "캔버스 좌우/상하 반전", ja "キャンバス左右/上下反転" — prefix pattern over the existing flip copy.
