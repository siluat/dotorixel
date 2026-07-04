---
title: "Canvas Rotate — explicit whole-document op with Marquee co-transform (core + WASM + web)"
status: done
created: 2026-07-04
parent: 207-tiered-canvas-marquee-transforms.md
---

## Parent

[207 — Tiered transforms PRD](207-tiered-canvas-marquee-transforms.md)

## What to build

Following the patterns established by issue 208, add a pair of **canvas-rotate
operations** (CW / CCW) that always turn the whole Document — every Pixel
Layer's every Cel rotated, canvas width/height swapped — with no
Marquee-presence dispatch, and **co-rotate an active Marquee** through the same
quarter-turn into the swapped dimensions, clipped to the new canvas (new
behavior: today a Marquee diverts rotate into region mode). The Reference
Layer's existing rotate-along behavior is **kept unchanged** in this slice —
excluding it is issue 206's job, layered on top of this op.

Expose the ops through the WASM binding and the TS `Document` facade (plus the
fake), route them through new undoable journal intents, wire the settings
sheet's and right panel's Rotate buttons to them, and add canvas-scoped labels
(direction: "Rotate Canvas Right"; exact copy follows the existing i18n
patterns) in en/ko/ja. The SelectionActionBar and the existing marquee-aware
rotate operations are left untouched.

## Acceptance criteria

- With a Marquee active, the settings-sheet / right-panel Rotate buttons rotate
  the whole Document: every Pixel Layer's every Cel turns and the canvas
  width/height swap — never region mode.
- An active Marquee is carried through the same quarter-turn into the swapped
  dimensions, covers the same (now rotated) content, and remains non-empty.
- Four consecutive canvas rotates (CW×4 or CCW×4) restore pixels, dimensions,
  and the Marquee (identity round-trip).
- A canvas rotate is a single Document History entry: one undo restores pixels,
  dimensions, and Marquee together. It stops Playback and commits a pending
  Floating Selection first.
- A canvas rotate applies even while the Reference Layer is the active layer.
- The Reference Layer still turns with the canvas exactly as before — the
  existing whole-document rotate reference tests stay green (issue 206 changes
  this afterwards).
- New canvas-scoped labels exist in en/ko/ja; SelectionActionBar labels are
  unchanged.
- The WASM structural-compatibility check stays green; the fake document
  implements the new interface.
- Existing marquee-aware rotate behavior (including via the SelectionActionBar)
  is unregressed.
- `cargo build --workspace` stays green (Apple binding untouched).

## Blocked by

- [208 — Canvas Flip](208-canvas-flip-whole-document.md) (establishes the
  canvas-op, journal-intent, co-transform, and label patterns)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | `rotate_canvas_cw` / `rotate_canvas_ccw` + shared `rotate_canvas` helper reusing `rotate_whole_document` (dimension swap + Reference remap kept); 6-test canvas-rotate suite |
| `crates/core/src/selection.rs` | `MarqueeRegion::rotated_cw(canvas_h)` / `rotated_ccw(canvas_w)` — canvas-turn mapping (distinct from self-centered `rotated_90`), composed with existing `clip_to` |
| `wasm/src/lib.rs` | `WasmDocument` delegations + 2 native smoke tests |
| `src/lib/canvas/canvas-model.ts` | `Document` facade methods with contract docs |
| `src/lib/canvas/fake-drawing-ops.ts` | Fake document stubs (interface parity) |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | `rotate-canvas-cw` / `rotate-canvas-ccw` intents across apply / would-change / post-commit switches |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `rotateCanvasCw` / `rotateCanvasCcw` through `#mutate` (playback stop + Floating Selection commit) |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | `handleRotateCanvasCw` / `handleRotateCanvasCcw` (old handlers kept for SelectionActionBar) |
| `src/lib/ui-editor/SettingsContent.svelte`, `RightPanel.svelte` | Rotate buttons renamed to `onRotateCanvasCw` / `onRotateCanvasCcw` props + canvas-scoped labels |
| `src/routes/editor/+page.svelte` | Panels wired to canvas handlers; PixelCanvasView → SelectionActionBar wiring untouched |
| `messages/{en,ko,ja}.json` | `action_transformRotateCanvasCw` / `action_transformRotateCanvasCcw` |
| `.claude/skills/verify/SKILL.md` | New project verify skill: dev-server + agent-browser GUI drive recipe (created during runtime verification) |
| Tests | Journal (2, incl. one-undo restore of pixels+dimensions+Marquee), TabState (4: canvas scope + undo, CCW, FS pre-commit, playback stop), component suites updated (labels + props), stories stubs renamed |

### Key Decisions

- **Core reuses `rotate_whole_document`**: `rotate_canvas` captures the pre-rotation extents, delegates the turn (so the Reference remap is inherited unchanged), then carries the Marquee. Issue 206 only has to remove the remap inside `rotate_whole_document`'s reference arm / route around it.
- **Marquee co-rotate math on `MarqueeRegion`**: CW `(x,y,w,h)@W×H → (H−y−h, x, h, w)`, CCW `→ (y, W−x−w, h, w)`, clipped after mapping. CW×4 is exact identity (no truncation).
- **Journal semantics differ from flip**: would-change is `true` (even a Reference-only document changes — the Reference still turns in this slice); post-commit always runs metrics sync + viewport reclamp (a canvas rotate always swaps dimensions), joining the `resize-document` bucket rather than flip's render-only bucket.

### Notes

- Kept-behavior pinned by test: `rotate_canvas_cw_still_turns_the_reference_layer_with_the_canvas` — issue 206 starts by flipping this test to "stays fixed".
- SelectionActionBar and marquee-aware `rotate_cw`/`rotate_ccw` are intentionally untouched — narrowing them to the Marquee tier is slice 210 (now unblocked).
- Labels: ko "캔버스 오른쪽/왼쪽 회전", ja "キャンバス右/左回転" — prefix pattern over the existing rotate copy, matching 208's flip labels.
- Runtime-verified in the browser (agent-browser): canvas rotate with active Marquee (never region mode, co-rotate coordinates exact), one-undo restore, CW×4 identity, SelectionActionBar region rotate unregressed, ko labels/tier split.
