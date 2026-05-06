---
title: "Layer system: Rust core — Document/Layer + composite + add/delete/reorder"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the Rust core's `Document` runtime model and `Layer` type. Implement source-over composite and the structural mutations (`add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`) on Document. The new modules are not yet wired through the WASM binding or the TS shell, so this slice is dead-code from the user's point of view — main is unaffected.

Scope:

- New module `crates/core/src/document.rs` with a `Document` type:
  - Fields: canvas dimensions, layer stack, active layer ID, `nextLayerNumber`, `timelinePanelCollapsed` flag.
  - `add_layer()` — insert directly above the active layer; the new layer becomes active.
  - `remove_layer(layer_id)` — UUID-keyed delete. Returns `LayerError::RemoveLastLayer` if the stack would become empty. On successful delete, an adjacent layer becomes active.
  - `reorder_layer(layer_id, new_index)` — move within the stack; clamp/validate the index.
  - `set_active_layer(layer_id)` — change the active pointer.
  - `composite() -> Vec<u8>` — RGBA row-major buffer, no caching. Source-over (Normal alpha-over). Skips `visible == false`. Multiplies `opacity` into the layer alpha.
  - `resize(width, height, anchor)` — apply the same anchor policy to every layer.
- New module `crates/core/src/layer.rs` with a `Layer` type:
  - Fields: `id: Uuid`, `name: String`, `pixels: PixelCanvas`, `visible: bool`, `opacity: f32`.
- Pixel-mutating delegations on Document (`set_pixel`, `flood_fill`, …) that route to the active layer. The single `PixelCanvas` public API is preserved unchanged.

## Acceptance criteria

- `Document::new(width, height)` creates a Document with one default layer and `nextLayerNumber=2`.
- `Document::add_layer` inserts directly above the active layer and sets the new one active.
- `Document::remove_layer` returns `LayerError::RemoveLastLayer` when the stack has only one layer.
- `Document::remove_layer` on a multi-layer stack relocates the active pointer to an adjacent layer.
- `Document::reorder_layer` rearranges the stack and the composite reflects the new depth order.
- `Document::composite` renders source-over for known input layers (transparent/opaque boundary, opacity, visibility off).
- `nextLayerNumber` is monotonic — never decreases on delete.
- No changes to `PixelCanvas` public API; existing tests keep passing.

## Blocked by

None — can start immediately.

## Scenarios addressed

- Partial coverage of Scenario 1, 2 (data-model groundwork, no UI yet).

## Results

| File | Description |
|------|-------------|
| `crates/core/Cargo.toml` | Added `uuid = "1"` (prod, type only) and `uuid = { version = "1", features = ["v4"] }` (dev, for test UUID generation) |
| `crates/core/src/lib.rs` | Registered `pub mod document` / `pub mod layer`, re-exported `Document`, `LayerError`, `Layer` |
| `crates/core/src/layer.rs` (new) | `Layer { id, name, pixels, visible, opacity }` with `pub` fields and `Layer::new` constructor; defaults visible=true, opacity=1.0 |
| `crates/core/src/document.rs` (new) | `Document` with private fields + getters: `width`, `height`, `layers`, `active_layer_id`, `next_layer_number`, `is_timeline_panel_collapsed`. Mutators: `add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`, `composite`, `set_pixel`, `resize`. `LayerError { LayerNotFound, RemoveLastLayer }` implements `Display + Error`. Source-over alpha compositing in private `blend_layer_over` helper. 21 inline unit tests covering all acceptance criteria + active-layer preservation across reorder |

### Key Decisions

- **Core is layer-name-agnostic.** PRD 086 ties layer naming to Paraglide i18n in the TS shell. Rust takes `name: String` as a parameter on `add_layer`/`Document::new` — the shell is responsible for formatting `next_layer_number` into a localized string. This keeps `crates/core` framework-free (per CLAUDE.md "Core logic is self-contained").
- **UUID dependency split between `[dependencies]` and `[dev-dependencies]`.** Production code uses `uuid` as a type only (no v4 generation, per PRD — IDs come from the TS shell). Tests need to fabricate UUIDs, so v4 is enabled only in `[dev-dependencies]`. This isolates the random-number dependency tree from the WASM/UniFFI build.
- **`Document` fields are private with getters; `Layer` fields are public.** Mirrors the existing `PixelCanvas` precedent (private fields, getter methods) for the more complex aggregate. `Layer` is a value-bag type without invariants beyond what its constructor provides, so public fields preserve struct-literal ergonomics.
- **`reorder_layer` silently clamps `new_index`** to `[0, len-1]` rather than returning an error. PRD didn't specify; clamping is the friendlier choice for drag-handle UIs that may overshoot. Documented in the doc comment.
- **`remove_layer` active relocation**: prefer the layer immediately below; fall back to the layer immediately above when removing the bottom layer. Counter (`next_layer_number`) does not decrement — it is monotonic across the document's lifetime.
- **`composite` returns straight (non-premultiplied) RGBA.** Matches the existing `PixelCanvas::pixels()` convention; `opacity` multiplies into source alpha; `visible=false` layers are skipped entirely.

### Notes

- This slice is dead-code from the user's point of view; main is unaffected. The next slice (#088 — Rust HistoryManager Document snapshot support) is now unblocked, followed by #089 (WASM Document facade).
- Tests reach into `doc.layers[0].pixels = PixelCanvas::with_color(...)` for setup convenience (allowed because tests are a child module). Verification is done via the public surface (`composite`, `layers()[i].pixels.get_pixel`). A dedicated test fixture API was not added because it would be production code purely for tests.
- Independent post-implementation audit ran against `.claude/rules/rust-conventions.md` and `CLAUDE.md`; addressed three findings: added doc comments to all non-trivial public methods (`canvas.rs` parity), renamed `timeline_panel_collapsed()` → `is_timeline_panel_collapsed()` (boolean-as-question + project precedent), added `reorder_layer_preserves_active_layer_id` regression test.
- Final state: 21 new tests, 257 total core tests passing, clippy clean on new files, `cargo build --workspace` clean.
