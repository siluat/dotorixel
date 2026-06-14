---
title: "Flip & rotate transforms — region, active layer, and whole document"
status: done
created: 2026-06-13
---

# Flip & rotate transforms

## Problem Statement

When working on a piece, the user often needs to mirror or turn pixels they've
already drawn: flip a character sprite to face the other way, mirror one half of
a symmetrical design, or rotate the whole canvas to re-orient a tile. Today
DOTORIXEL has no way to do any of this. The only options are to redraw by hand or
to manually copy/move pixels, which is slow and lossy for anything beyond a
trivial shape.

This is a core part of "the editor for serious work": every comparable pixel
editor offers flip-horizontal, flip-vertical, and 90° rotation as first-class
operations, and their absence is felt immediately by anyone iterating on real
artwork.

## Solution

Add four transform operations the user can apply from the editor:

- **Flip Horizontal** — mirror left↔right
- **Flip Vertical** — mirror top↔bottom
- **Rotate 90° clockwise**
- **Rotate 90° counter-clockwise**

The operation's **target is resolved by what's currently selected**:

- **With a Marquee active**, the transform applies to the pixels inside the
  Marquee on the active Pixel Layer. After a rotation the Marquee itself turns
  with the content (a `W×H` region becomes `H×W`).
- **With no Marquee**:
  - **Flip** applies to the entire active Pixel Layer (canvas dimensions
    unchanged).
  - **Rotate** applies to the **whole Document** — every layer turns together
    and the document's width and height swap (`W×H → H×W`).

Every transform goes through the Document Change Journal, so each is a single
undoable step.

The user reaches these operations from two places:

- The floating **SelectionActionBar** (the context bar above an active Marquee),
  for region transforms.
- A **Transform group in the RightPanel's Canvas section**, alongside resize and
  clear, for whole-layer / whole-document transforms.

Both surfaces dispatch the same four operations; the target is resolved by
Marquee state at the moment the operation runs.

## User Stories

1. As a pixel artist, I want to flip a selected region horizontally, so that I
   can mirror part of my drawing without redrawing it.
2. As a pixel artist, I want to flip a selected region vertically, so that I can
   mirror it top-to-bottom.
3. As a pixel artist, I want to rotate a selected region 90° clockwise, so that I
   can re-orient an element I've drawn.
4. As a pixel artist, I want to rotate a selected region 90° counter-clockwise,
   so that I can turn it the other way.
5. As a pixel artist drawing a symmetrical sprite, I want to draw one half,
   select it, flip a copy, and place it on the other side, so that I get perfect
   symmetry quickly. (This story is served by flip + the existing
   copy/paste/move; this PRD provides the flip half.)
6. As a pixel artist, I want to flip my entire active layer horizontally when
   nothing is selected, so that I can mirror the whole drawing in one action.
7. As a pixel artist, I want to flip my entire active layer vertically when
   nothing is selected, so that I can mirror the whole drawing top-to-bottom.
8. As a pixel artist, I want to rotate the whole canvas 90° when nothing is
   selected, so that I can change a landscape composition to portrait (or vice
   versa) and have every layer come along.
9. As a pixel artist, I want a rotation that turns the Marquee with its contents,
   so that my selection stays wrapped around the rotated pixels.
10. As a pixel artist, I want any transform to be a single undo step, so that one
    Ctrl+Z fully reverses it.
11. As a pixel artist, I want redo to re-apply a transform I undid, so that I can
    move back and forth while deciding.
12. As a pixel artist working across multiple layers, I want a whole-document
    rotation to rotate every layer consistently, so that my layers stay aligned
    after the turn.
13. As a pixel artist using a Reference Layer for tracing, I want the reference
    image to rotate together with the canvas when I rotate the whole document, so
    that it stays aligned with what I'm drawing.
14. As a pixel artist, I want transform actions to do nothing (rather than error)
    when they can't apply — e.g. flipping a region while a Reference Layer is
    active — so that the editor never surprises me with an invalid state.
15. As a pixel artist, I want the transform buttons available right where I'm
    working: on the selection bar when I have a Marquee, and in the canvas panel
    when I don't.
16. As a pixel artist who has just pasted a Floating Selection, I want a transform
    to commit the floating pixels first and then apply, so that the result is
    predictable.
17. As a multilingual user (en/ko/ja), I want every transform button labelled in
    my language, so that the controls are clear.
18. As a pixel artist, I want rotating a region near the canvas edge to behave
    predictably (content re-centered on the region, clipped to the canvas), so
    that I'm not confused by where pixels end up.
19. As a pixel artist on a saved project, I want a transformed canvas (including a
    rotated document with swapped dimensions) to persist and restore correctly
    through auto-save, so that I don't lose the change on reload.

## Implementation Decisions

This feature deliberately reuses the existing region-operation seams
(`lift_region` / `clear_region` / `composite_region`), the Document mutator +
Reference-Layer no-op contract, the Document Change Journal intent pattern, and
the resize-document prior art for whole-document changes. The slicing into
issues is left to `/to-issues`, but the natural seams and decisions are:

### Target resolution (the central rule)

Each of the four operations resolves its target **at apply time** from Document
state, not from which UI surface fired it:

- Marquee present → **region** transform on the active Pixel Layer.
- No Marquee + flip → **active Pixel Layer** (whole layer, dimensions unchanged).
- No Marquee + rotate → **whole Document** (all layers, dimensions swap).

The asymmetry between no-Marquee flip (active layer only) and no-Marquee rotate
(whole document) is intentional and forced by the data model: all layers share a
single Document `width × height`. Flip preserves dimensions, so it can act on one
layer in isolation; a 90° rotate swaps dimensions, which is only representable if
every layer (and the Document) turns together. This is documented so it reads as
a deliberate choice, not an inconsistency.

### Rust core — pure transform functions

- **Buffer-level rotation** (new pure function, `selection.rs` or a sibling):
  rotate a row-major RGBA buffer of `W×H` into an `H×W` buffer (CW and CCW). This
  is the primitive the region path and the layer path both build on.
- **Region transforms**: reuse the existing primitives rather than writing new
  region loops where possible.
  - Region flip: in-place pixel swap within the clipped region bounds (no
    dimension change). May be expressed directly or as lift → flip buffer →
    composite at same region.
  - Region rotate: lift the region buffer, rotate it (`W×H → H×W`), clear the
    original region, then composite the rotated buffer at a **new region
    re-centered on the original region's center** and clipped to the canvas.
    Pixels that fall outside the canvas after re-centering are lost. Return the
    new (clipped) region so the Document can update its Marquee.
- **Whole-PixelCanvas transforms** (`canvas.rs`): `flip_horizontal` /
  `flip_vertical` in place (dimensions unchanged); `rotate_cw` / `rotate_ccw`
  producing a **new** `PixelCanvas` with swapped dimensions. `MAX_DIMENSION`
  (256) is symmetric across width/height, so a swap is always within bounds and
  needs no extra validation.

### Rust core — Document mutators

Add Document-level methods that encapsulate target resolution and the
Reference-Layer no-op contract, mirroring `clear_marquee_pixels` /
`composite_buffer_at`:

- `flip_horizontal()` / `flip_vertical()`: if a Marquee is set, flip that region
  on the active layer; otherwise flip the entire active layer. No-op when the
  active layer is a Reference Layer (matches the existing drawing/clear no-op
  contract).
- `rotate_clockwise()` / `rotate_counterclockwise()`:
  - Marquee set → rotate that region on the active Pixel Layer and update the
    stored Marquee to the rotated region. No-op when the active layer is a
    Reference Layer.
  - No Marquee → rotate the **whole Document**: replace each Pixel Layer's canvas
    with its rotated canvas, swap `self.width`/`self.height`, and remap every
    Reference Layer's placement into the rotated frame (see below). This path
    does **not** gate on the active layer kind — the whole document turns
    regardless of which layer is active.

### Reference Layer behaviour under whole-document rotation

`ReferencePlacement` currently has only `{ x, y, scale }` — **no rotation field**.
A correct whole-document rotation must turn reference images with the canvas, so
this PRD extends the model:

- Add a **quarter-turn rotation** to `ReferencePlacement` (0 / 90 / 180 / 270
  degrees — a constrained quarter-turn, not arbitrary angles), preserving the
  existing private-field invariant style (finite position, `scale > 0`).
- On whole-document rotate, each Reference Layer's placement is remapped: its
  position is transformed into the new `H×W` frame so the image stays visually
  anchored where it was, and its rotation is advanced by the quarter-turn. The
  closest prior art is `Document::resize`, which already remaps reference
  placement position via an anchor factor.
- Reference rendering (Canvas2D web shell; Metal later) must apply the quarter-
  turn when drawing the reference image. This rendering change is the heaviest
  sub-area and a natural final slice; until it lands, whole-document rotation
  should remain behind that slice rather than shipping a visually-wrong
  intermediate state.

### WASM facade

Expose the four Document methods on `WasmDocument` following the existing
pass-through pattern (`lift_marquee_pixels`, `clear_marquee_pixels`,
`composite_buffer_at`). The region-rotate path needs the updated Marquee
reflected back to TS; follow however the current code surfaces Marquee changes
after a mutation (the journal re-reads `document.marquee()` after apply).

### Document Change Journal — intents

Add four no-payload intents to `UndoableDocumentIntent`:

- `flip-horizontal`
- `flip-vertical`
- `rotate-cw`
- `rotate-ccw`

For each:

- **Apply** (`#applyUndoableDocumentIntent`) calls the matching `WasmDocument`
  method; target resolution lives in Rust, so the TS case is a thin call
  returning `{ changed: true }`, consistent with `clear-marquee-pixels`.
- **Guard** (`#willChangeUndoableDocument`):
  - flip → active layer kind is `pixel` (covers both region and whole-layer; a
    Reference active layer no-ops and must not capture a snapshot).
  - rotate → if a Marquee is present, active layer kind is `pixel`; if no Marquee,
    always allowed (whole-document rotate turns everything).
- **After** (`#afterUndoableDocumentChanged`) fires the existing
  render-invalidation + dirty-marking. Whole-document rotate changes dimensions,
  so it must also trigger whatever viewport/layout refresh `resize-document`
  currently triggers.
- Each intent captures exactly one undo snapshot before mutation, exactly like
  the existing intents. Full-document snapshots already handle dimension changes
  (resize relies on this), so undo/redo of a rotated document is covered by the
  existing mechanism.

### TS dispatch + Floating Selection

Add TabState methods (`flipHorizontal`, `flipVertical`, `rotateClockwise`,
`rotateCounterclockwise`) that, like `resize`, first call
`#commitIdleFloatingSelection()` and then commit the corresponding intent.
Transforms therefore act on committed pixels; transforming a live Floating
Selection in place is out of scope.

Wire these through the `KeyboardInputHost` / EditorController host interface only
as far as needed for the UI handlers; **keyboard shortcuts for transforms are out
of scope** (see Out of Scope).

### UI surfaces

- **SelectionActionBar**: add Flip H, Flip V, Rotate CW, Rotate CCW actions
  (Lucide icons `FlipHorizontal`, `FlipVertical`, `RotateCw`, `RotateCcw`)
  following the existing `SelectionAction` array pattern. These are the region
  entry points.
- **RightPanel → Canvas section**: add a Transform group (sibling to
  `CanvasSizeControl` and the Clear button) with the same four actions, as the
  whole-layer / whole-document entry points. Because target is resolved by
  Marquee state, these buttons transparently act on the region when a Marquee
  happens to be active.

### i18n

Add message keys for the four labels (and a section/group label if needed) across
`messages/en.json`, `messages/ko.json`, `messages/ja.json`, following the
`action_*` snake_case convention used by `action_selectionCopy` et al. Suggested
keys: `action_transformFlipHorizontal`, `action_transformFlipVertical`,
`action_transformRotateCw`, `action_transformRotateCcw`, `section_transform`.

## Testing Decisions

Good tests here assert **observable pixel/dimension/Marquee outcomes**, not
internal call sequences. Follow the prior art established by issue #136 (region
operations) and the existing journal tests.

- **Rust core (unit, `cargo test`)** — the highest-value, lowest-cost seam:
  - Buffer rotation primitive: known small buffers rotated CW/CCW land in the
    expected positions; CW∘CW∘CW∘CW (or CW then CCW) is identity.
  - Region flip: pixels mirror within the region; outside-region pixels untouched;
    1×1 region, region flush against each canvas edge, and partially off-canvas
    region all behave.
  - Region rotate: `W×H` content lands re-centered as `H×W`, clipped at canvas
    bounds; the returned region matches; edge/partial-overlap cases.
  - Whole-canvas flip: full-buffer mirror; double-flip is identity.
  - Whole-canvas rotate: dimensions swap; pixels land correctly; a non-square
    canvas round-trips (CW then CCW restores original pixels and dimensions).
  - Document mutators: region vs whole-layer vs whole-document target resolution;
    **Reference-active no-op** for flip and region-rotate; whole-document rotate
    turns all Pixel Layers and swaps Document dimensions; Reference placement
    remaps and its quarter-turn advances.
- **TS Document Change Journal (Vitest)** — mirror the `clear-marquee-pixels`
  tests: each intent captures exactly one snapshot, undo restores prior
  pixels/dimensions/Marquee, redo re-applies; the guard suppresses a snapshot
  when the operation can't apply (Reference active for flip); region rotate
  leaves the Marquee wrapped around the rotated region; whole-document rotate
  fires the dimension/viewport refresh.
- **Component (Vitest + @testing-library/svelte)**: SelectionActionBar and the
  RightPanel Transform group render the four actions and invoke their handlers;
  labels resolve through Paraglide.
- **Persistence**: a rotated document (swapped dimensions) survives an auto-save
  round-trip — extend or follow the existing session save/restore tests rather
  than adding a bespoke harness.

## Out of Scope

- **Keyboard shortcuts** for transforms — the obvious bindings collide with
  browser/editor defaults (Ctrl+H = history, Ctrl+V = paste), so shortcuts are
  deferred to a follow-up that can choose a coherent scheme.
- **180° rotation** as a distinct command — it equals Flip H + Flip V and can be
  added cheaply later if demand appears.
- **Arbitrary-angle rotation** and any non-quarter-turn transform (skew, scale,
  free transform).
- **Transforming a live Floating Selection in place** — transforms commit the
  floating selection first.
- **Whole-document flip** (flipping every layer together with no Marquee) — by
  decision, no-Marquee flip targets the active layer only; a whole-document flip
  variant can be added later.
- **Arbitrary reference-image rotation** beyond the quarter-turns needed to keep
  references aligned through document rotation.
- **Apple (SwiftUI/Metal) shell parity** — this PRD targets the web shell; the
  Rust core transforms are shared, but native UI wiring is tracked separately
  under the Apple Native phases.

## Further Notes

- The Rust core transform functions are pure and shell-agnostic, so the Apple
  shell can adopt them later with only native UI wiring — this keeps the
  cross-platform door open per the Core Placement criteria (complex, shared,
  pixel-level logic is exactly what the core is for).
- `/to-issues` should consider sequencing roughly as: (1) Rust buffer/region/
  canvas transform primitives + unit tests; (2) Document mutators + WASM facade +
  journal intents for flip and region/whole-layer (no Reference rotation yet);
  (3) UI surfaces + i18n for the above; (4) whole-document rotate including
  `ReferencePlacement` quarter-turn + reference rendering. Slice 4 is the heaviest
  and gates the no-Marquee rotate UX.
