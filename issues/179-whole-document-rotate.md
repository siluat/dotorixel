---
title: "Rotate whole document 90° — all layers, dimension swap, reference quarter-turn"
status: done
created: 2026-06-14
parent: 176-flip-and-rotate-transforms.md
---

# Whole-document rotate 90°

## Parent

[176 — Flip & rotate transforms](176-flip-and-rotate-transforms.md)

## What to build

Extend rotation to the **no-Marquee path**: with nothing selected, Rotate 90°
turns the **whole Document**. Every Pixel Layer's pixels rotate and the
Document's `width` / `height` swap (`W×H → H×W`); Reference Layers turn with the
canvas too. This is the heaviest slice because it adds rotation to the reference
model and rendering.

Behaviour:

- With **no Marquee**, Rotate CW / CCW rotates the whole Document:
  - Each Pixel Layer's canvas is replaced by its rotated canvas; the Document
    dimensions swap. This path does **not** depend on the active layer kind — the
    whole document turns regardless of which layer is active.
  - Reference Layers rotate with the canvas: their content turns and they stay
    visually anchored where they were.
- Because all layers share a single Document `width × height`, a 90° rotate is
  only representable as a whole-Document operation — this is the documented
  reason the no-Marquee rotate target differs from the no-Marquee flip target
  (which is the active layer only, per #177).
- The dimension change triggers the same viewport / layout refresh that
  `resize-document` triggers.
- The operation is a single undoable step; redo re-applies it. Full-document
  snapshots already cover dimension changes (resize relies on this).

Reference Layer rotation (the new model work):

- Extend `ReferencePlacement` with a **quarter-turn rotation** (0 / 90 / 180 /
  270 degrees — a constrained quarter-turn, not arbitrary angles), preserving the
  existing private-field invariant style (finite position, `scale > 0`).
- On whole-Document rotate, each Reference Layer's placement is remapped into the
  rotated `H×W` frame (closest prior art: `Document::resize`, which remaps
  reference position via an anchor factor) and its quarter-turn advances.
- Reference rendering (Canvas2D web shell) applies the quarter-turn when drawing
  the reference image, so the reference appears rotated together with the pixels.

Wiring:

- The `rotate-cw` / `rotate-ccw` journal intents from #178 gain their no-Marquee
  branch (whole-Document rotate). The guard allows the no-Marquee rotate
  unconditionally (it turns everything), while the Marquee path keeps its #178
  guard.
- The **RightPanel Transform group** gains Rotate CW / CCW buttons — now
  functional with no Marquee. (SelectionActionBar already has them from #178 for
  the region path.)

## Acceptance criteria

- With no Marquee, Rotate CW / CCW from the RightPanel Transform group rotates the
  whole Document: every Pixel Layer's pixels rotate and the Document width/height
  swap.
- Reference Layers rotate with the canvas — content turns via the rendered
  quarter-turn and the reference stays visually anchored (placement remapped).
- Whole-Document rotate does not depend on the active layer kind.
- The dimension change refreshes the viewport / layout via the same path as
  `resize-document`.
- The rotate is a single undo step; undo restores prior pixels, dimensions, and
  reference placements/rotations; redo re-applies.
- A rotated Document (swapped dimensions + reference rotation) survives an
  auto-save round-trip and restores correctly.
- `ReferencePlacement` constrains rotation to quarter-turns and keeps its
  finite-position / `scale > 0` invariant.
- Rust unit tests cover: whole-canvas rotate (dimensions swap + pixel positions),
  non-square CW-then-CCW round-trip restoring pixels and dimensions; Document
  rotate turning all Pixel Layers and swapping dimensions; Reference placement
  remap + quarter-turn advance.
- Journal tests cover: no-Marquee rotate captures one snapshot, undo restores
  dimensions + pixels + references, and the dimension/viewport refresh fires.
- A persistence test (extending the existing session save/restore coverage)
  confirms the round-trip.

## Blocked by

- [178 — Rotate region 90° clockwise & counter-clockwise](178-region-rotate-90.md)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/canvas.rs` | `PixelCanvas::rotate_cw`/`rotate_ccw` — return a new canvas with swapped dimensions, built on `rotate_buffer_*` |
| `crates/core/src/reference_placement.rs` | Added private `rotation: u8` (0..=3) with `rotation()` getter and `pub fn with_rotation` (normalizes `% 4`); `new`/`auto_fit`/`fit_to_canvas` default to 0; `with_position` preserves it |
| `crates/core/src/document.rs` | `rotate_cw`/`rotate_ccw` branch on Marquee: region path unchanged, no-Marquee path runs `rotate_whole_document` (rotate every Pixel Layer + swap `width`/`height` + remap each Reference via `rotate_reference_placement`). `set_reference_placement` now preserves the layer's quarter-turn |
| `crates/core/src/layer.rs` | `ReferenceData::sample_at` inverts the quarter-turn on the integer pixel grid so a rotated reference samples the correct source pixel |
| `wasm/src/lib.rs` | `WasmReferencePlacement.rotation` getter; builder `add_reference_layer` takes a `rotation` arg for hydration |
| `src/lib/canvas/reference-layer-underlay.ts` | `documentRect`/`bounds`/`sourceCoords` are quarter-turn aware; exported `normalizedQuarterTurn` helper |
| `src/lib/canvas/renderer.ts` | Reference underlay draws rotated: translate to the bbox center, `rotate(k·90°)`, draw at un-rotated size (unrotated path unchanged) |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Rotate guard allows the no-Marquee path unconditionally; after-handler refreshes metrics/viewport (like `resize-document`) only for the dimension-swapping whole-document rotate |
| `src/lib/ui-editor/RightPanel.svelte`, `SettingsContent.svelte` | Rotate CW/CCW buttons added to the Transform group, wired through `+page.svelte` to `editor.handleRotateCw/Ccw` |
| `src/lib/session/session-storage-types.ts` | `ReferencePlacementRecord.rotation?` (optional; absence → 0) — no schema-version bump |

### Key Decisions

- **Reference rotation geometry** is derived to match the buffer-rotation pixel mapping exactly: CW remaps a footprint center by the continuous turn `(u,v) → (H−v, u)`, CCW by `(v, W−u)`; `(x, y)` is the rotated footprint's AABB top-left, and rendering rotates about the bbox center so the swapped-dimension box stays anchored.
- **Render + sampling/bounds both made rotation-correct** (chosen over render-only) so a rotated reference's eyedropper sampling and overlay/clamp bounds don't silently drift.
- **`rotation` kept as a normalized `u8`** (not a dedicated enum) to match the existing private-field invariant style and the WASM/persistence numeric boundary; illegal values are unrepresentable via private fields + `with_rotation`'s `% 4`.
- **Persistence** extends `ReferencePlacementRecord` with an optional `rotation` (absence → 0) following the established additive-field pattern — no new schema version.

### Notes

- **Renderer rotated-draw path has no unit test** — the pure geometry functions are tested with rotation, but the `ctx` rotate/draw path is verified only by reasoning (happy-dom can't assert rendered pixels; asserting `ctx` call order would couple to implementation). A visual check belongs to manual/e2e verification.
- **`placementFromScaleDrag` is rotation-naive**: manually scale-dragging a rotated reference is geometrically imperfect because it uses un-rotated natural dimensions. Rotation is preserved through the drag; full correctness is deferred to the "reference window polish (manual rotate)" backlog item.
- Whole-document rotate uses the existing full-document undo snapshot, so undo/redo of dimensions, pixels, and reference placements is covered by the same mechanism as `resize-document`.
