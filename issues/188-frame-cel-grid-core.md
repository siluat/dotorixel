---
title: "Frame cel-grid + frame operations — Rust core"
status: done
created: 2026-06-18
parent: 186-frame-management.md
---

# Frame cel-grid + frame operations — Rust core

## Parent

[186 — Frame management (add/delete/duplicate/reorder) — M4 entry](186-frame-management.md)

## What to build

The foundational Rust-core slice of PRD 186: introduce **Frames** as a temporal
axis on the Document and convert each Pixel Layer from a single canvas into one
**Cel** per frame, while keeping every existing single-frame behavior identical.
No shell consumer yet — this lands dead-code-tolerant, as the layer-system core
slice (087) did.

- `Document` gains an ordered, always-non-empty `frames` axis and an
  `active_frame_id` pointer (mirrors the layer-stack non-empty invariant and the
  active-layer pointer).
- A `Frame` is **identity-only** (`Frame { id }`) — no persistent name or
  counter; frames display as their 1-based ordinal. Per-frame duration is out of
  scope.
- The `Pixel` layer kind holds one Cel (a `PixelCanvas`) **per frame** instead of
  a single canvas; the `Reference` layer kind is unchanged and **frame-independent**
  (no cels, renders identically under every frame). The cel container is an
  implementation choice constrained by the **grid invariant**: for every Pixel
  Layer and every Frame there is exactly one Cel — a Pixel Layer's cel keys equal
  the Document's frame ids, no missing and no extra cels. An empty frame is
  transparent cels, not absent cels.
- Frame operations mirror the existing layer operations (UUID-keyed,
  active-pointer-preserving):
  - `add_frame` — insert a new frame **after the active frame**, seed a
    transparent cel for every Pixel Layer, make it active.
  - `duplicate_frame` — insert after the active frame, clone every Pixel Layer's
    active-frame cel, make it active.
  - `remove_frame` — drop the frame and its cel from every Pixel Layer; reject the
    last remaining frame (`FrameError::RemoveLastFrame`); if the active frame was
    removed, relocate active to an adjacent frame (down, else up) — same policy as
    `remove_layer`.
  - `reorder_frame` — move within `frames`, clamp/validate the index, preserve
    active by id.
  - `set_active_frame` — change the active pointer.
- Existing Document operations reroute through the active-frame cel:
  `composite` / `composite_for_export` blend each visible Pixel Layer's
  active-frame cel; drawing (`set_pixel`, `flood_fill`,
  `restore_active_layer_pixels`, `flip_*`, `rotate_*`) targets the active layer's
  active-frame cel; `add_layer` seeds a transparent cel for every existing frame;
  `resize` applies the anchor to every cel of every Pixel Layer; `Document::new`
  creates one layer **and one frame** with that layer's single transparent cel.
- New `FrameError` (`RemoveLastFrame`, `FrameNotFound`) implementing
  `Display + Error`, mirroring `LayerError`. Core stays framework-free and
  i18n-agnostic (frames carry no localized strings).
- CONTEXT.md gains **Frame**, **Cel**, and **Active Frame** entries (per the PRD's
  Domain vocabulary), and the existing "avoid frame for Layer" note is reconciled
  (Layer and Frame are orthogonal axes).

## Acceptance criteria

- `Document::new` yields exactly one frame and one cel per layer; behavior for a
  one-frame document is unchanged from before this slice.
- `add_frame` inserts after the active frame and seeds a transparent cel for every
  Pixel Layer; the new frame becomes active.
- `duplicate_frame` reproduces the source frame's full composite (every layer's
  cel copied) and becomes active.
- `remove_frame` rejects the last remaining frame with `FrameError::RemoveLastFrame`;
  otherwise removes the cel from every Pixel Layer and relocates active to an
  adjacent frame when the active frame was removed.
- `reorder_frame` rearranges frames and preserves the active frame by id;
  out-of-range indices are clamped/validated.
- `composite` reflects the active frame and changes when the active frame changes;
  drawing writes only the active-frame cel (other frames unchanged).
- `add_layer` seeds cels across all frames; `resize` maps every cel of every Pixel
  Layer with the same anchor; the Reference Layer remains frame-independent
  throughout.
- The grid invariant holds after every mutation (add/duplicate/remove/reorder
  frame, add/remove layer, resize).
- Drawing with a Reference Layer active stays a no-op (no cel).
- Inline Rust unit tests assert external behavior (composite output,
  frame/active-frame metadata, error variants) — never the private cel container.
- CONTEXT.md documents Frame, Cel, and Active Frame and reconciles the
  layer-avoidance note.

## Blocked by

None - can start immediately. (Design slice 187 is complete.)

## Results

| File | Description |
|------|-------------|
| `crates/core/src/frame.rs` | New module: identity-only `Frame { id }` and the `Frame::INITIAL` constant (the nil-UUID frame a Document is born with). |
| `crates/core/src/layer.rs` | New `Cels` type encapsulating `HashMap<frame_id, PixelCanvas>`; `LayerKind::Pixel(PixelCanvas)` → `Pixel(Cels)`; `Layer::new` seeds the initial-frame cel. |
| `crates/core/src/document.rs` | `frames` axis + `active_frame_id`; `FrameError` (`RemoveLastFrame`, `FrameNotFound`); `add_frame`/`duplicate_frame`/`remove_frame`/`reorder_frame`/`set_active_frame` + `frames()`/`active_frame_id()`; all pixel ops routed through the active-frame cel; `resize`/whole-document `rotate_*` map every cel of every frame. 25 new behavior tests. |
| `crates/core/src/lib.rs` | Register `frame` module; export `Frame`, `FrameError`. |
| `wasm/src/lib.rs` | Builder keys each reconstructed layer's sole cel to `Frame::INITIAL` (compile-keep; public WASM signatures unchanged). |
| `CONTEXT.md` | Add **Frame**, **Cel**, **Active Frame** entries; reconcile the Layer "avoid: frame" note as orthogonal axes. |
| `docs/platform-status.md` | New **Frame cel-grid** row under Layers (Core ✅, Web/Apple ⬜). |

### Key Decisions

- **`Frame::INITIAL` (= `Uuid::nil()`) as the single initial/single-frame id.** The core cannot mint v4 UUIDs in non-test code (`uuid/v4` is a dev-dependency), so the initial frame uses a named nil constant rather than a random id. This centralizes the coupling in one place and keeps `Document::new`, `from_layers`, and `Layer::new` at their existing 4-arg signatures (zero churn across ~100 call sites). WASM uses it as the agreed placeholder; caller-supplied frame ids arrive with 189.
- **Whole-document rotate (no Marquee) turns every cel of every frame**, not just the active one — the only behavior that preserves the dimension invariant (every cel matches the Document's W×H). The issue grouped `rotate_*` under "active-frame cel"; that applies to the Marquee path only.
- **Cel container is an encapsulated `Cels` type.** Tests assert external behavior (composite output, frame/active-frame metadata, error variants) and verify the grid invariant by switching frames and exercising the panicking accessors — never by inspecting the private cel map.

### Notes

- Dead-code-tolerant and single-frame-preserving: all 417 prior core tests still pass (442 total core + 18 wasm). No shell consumer yet; public WASM signatures unchanged, so no web-shell TS changes.
- `from_layers` establishes a single initial frame. Multi-frame reconstruction, an explicit `frames` parameter, and grid-invariant boundary validation are deferred to 190 (schema V6).
- Unblocks **189** (Frame WASM binding + Change Journal intents) and **190** (Document schema V6) — both depend on this slice.
