---
title: "Rotate region 90° clockwise & counter-clockwise"
status: done
created: 2026-06-14
parent: 176-flip-and-rotate-transforms.md
---

# Rotate region 90° (CW & CCW)

## Parent

[176 — Flip & rotate transforms](176-flip-and-rotate-transforms.md)

## What to build

Add **90° rotation of the selected region** (clockwise and counter-clockwise) for
the active Pixel Layer, extending the transform pipeline established in #177.
This slice handles the **Marquee path only**; whole-document rotation (no
Marquee) arrives in #179.

Behaviour:

- With a **Marquee active** on a Pixel Layer, rotating 90° turns the region's
  content: a `W×H` region's pixels are rotated into an `H×W` block,
  **re-centered on the original region's center** and clipped to the canvas
  (pixels that fall outside the canvas are lost). The Marquee updates to wrap the
  new `H×W` region.
- Implement via the existing region seams: lift the region buffer, rotate the
  buffer (`W×H → H×W`), clear the original region, composite the rotated buffer at
  the new re-centered region, and return the new (clipped) region so the Document
  can update its Marquee.
- With the active layer being a **Reference Layer**, region rotate is a silent
  no-op.
- With **no Marquee**, rotate is a no-op in this slice (it captures no snapshot);
  the no-Marquee path is wired in #179.
- Each rotation is a single undoable step; redo re-applies it.

New journal intents `rotate-cw` / `rotate-ccw` (no payload; guarded to
Marquee-present + active Pixel Layer in this slice). Entry point: **rotate buttons
in the SelectionActionBar** (Lucide `RotateCw` / `RotateCcw`). RightPanel rotate
buttons are intentionally **not** added yet — they would be dead without the
no-Marquee path, and arrive in #179. i18n keys added across en / ko / ja
(e.g. `action_transformRotateCw`, `action_transformRotateCcw`).

## Acceptance criteria

- Rotate CW and CCW are available from the SelectionActionBar when a Marquee is
  active on a Pixel Layer.
- A `W×H` region's pixels rotate into an `H×W` block re-centered on the region's
  center and clipped to the canvas; the Marquee updates to the new region.
- The lift → rotate → clear → composite round-trip is correct: content that moves
  out of the original footprint leaves transparency behind, and a CW then CCW of
  the same region restores the original pixels and Marquee.
- With a Reference Layer active, region rotate is a silent no-op.
- With no Marquee, rotate is a no-op (no snapshot captured) in this slice.
- Each rotation is a single undo step; undo restores prior pixels and Marquee,
  redo re-applies.
- Button labels are localized in en / ko / ja.
- Rust unit tests cover: buffer rotate CW/CCW, CW∘CCW identity, CW×4 identity;
  region rotate re-centering and clipping, the returned region, and edge /
  partial-overlap cases.
- Journal tests cover: one snapshot per rotation, undo restores pixels + Marquee,
  and the Reference-active / no-Marquee guards suppress the snapshot.
- Component tests cover: the SelectionActionBar rotate actions render and invoke
  their handlers with localized labels.

## Blocked by

- [177 — Flip horizontal & vertical](177-flip-horizontal-vertical.md)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/canvas.rs` | `rotate_buffer_cw` / `rotate_buffer_ccw` (W×H → H×W) + tests (CW/CCW, CW∘CCW identity, CW×4 identity) |
| `crates/core/src/selection.rs` | `MarqueeRegion::rotated_90()` — dimension swap re-centered on the region center + tests (re-center, involution) |
| `crates/core/src/document.rs` | `rotate_cw` / `rotate_ccw` + `rotate_active_marquee` helper (lift → rotate → clear → composite → Marquee update) + tests (re-center, clip, round-trip, Reference/no-Marquee no-op) |
| `wasm/src/lib.rs` | `WasmDocument::rotate_cw` / `rotate_ccw` |
| `src/lib/canvas/canvas-model.ts`, `fake-drawing-ops.ts` | `Document` interface + fake gain `rotate_cw` / `rotate_ccw` |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | `rotate-cw` / `rotate-ccw` intents; guard = Marquee present + active Pixel Layer; render+dirty follow-up |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `rotateCw` / `rotateCcw` handlers (commit idle floating selection, drawing-guard) |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | `handleRotateCw` / `handleRotateCcw` |
| `src/lib/canvas/SelectionActionBar.svelte`, `PixelCanvasView.svelte`, `src/routes/editor/+page.svelte` | Rotate buttons (Lucide `RotateCw` / `RotateCcw`) wired through to the two PixelCanvasView instances |
| `messages/{en,ko,ja}.json` | `action_transformRotateCw` / `action_transformRotateCcw` |
| `*.test.ts` (journal, tab-state, SelectionActionBar) | Intent/undo/guard, handler, and component render+invoke+i18n coverage |

### Key Decisions

- **Re-centering is its own inverse.** `rotated_90()` uses truncating integer division (`(W − H) / 2`), so a CW then CCW of the same region restores the original Marquee exactly — locked in by a Rust involution test and an in-app undo check.
- **Marquee-only slice.** RightPanel/Settings rotate buttons and the no-Marquee path were intentionally left out (they would be dead without whole-document rotate); SelectionActionBar is the sole entry point. The new Marquee becomes the canvas-clipped rotated region.
- **i18n wording.** "Rotate Right / Rotate Left" (ko 오른쪽/왼쪽 회전, ja 右回転/左回転) over "Clockwise/Counter-clockwise" for casual-user clarity and parity with flip's direction-named labels.

### Notes

- The pre-existing SelectionActionBar right-edge clamp test was retuned (viewport 360→400, expected 78→42px) because two extra buttons widened the bar — behavior unchanged, only the fixture geometry.
- #179 (whole-document rotate) is now unblocked; it adds the no-Marquee branch to these same `rotate-cw` / `rotate-ccw` intents and makes the RightPanel rotate buttons functional.
- Verified in-app (dev server): horizontal strip → vertical column, Marquee `7×3 at (7,7)` → `3×7 at (9,5)`, undo restores both. Production build not separately exercised (CI's responsibility per testing conventions).
