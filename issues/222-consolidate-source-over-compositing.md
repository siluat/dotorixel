---
title: "Consolidate source-over compositing into one core primitive"
status: ready-for-agent
created: 2026-07-05
---

## Problem Statement

Straight-alpha source-over blending is implemented four times:

1. `crates/core/src/document.rs:1283` — `blend_pixel_canvas_over` (layer
   composite, folds layer opacity in as `f32`).
2. `crates/core/src/selection.rs:253` — `source_over(src, dst)` (Marquee region
   composite, `Color` → `Color`).
3. `src/lib/canvas/editor-session/floating-selection-lifecycle.ts:40` —
   `blendSourceOver` + `blendLayerPixelsOver` + `compositeFloatingSelectionIntoLayer`
   (~60 lines), used by `previewPixels()` to re-run the whole layer composite in
   TS so the transient Floating Selection buffer can be overlaid.
4. `src/lib/session/session-storage-types.ts:346` — `compositeV3` (saved-work
   thumbnails), whose doc comment concedes the drift: "the Rust core renders
   the in-editor canvas via a parallel implementation, so minor numeric
   differences here are tolerated."

Two extra costs beyond duplication:

- `previewPixels()` runs on every Floating Selection drag tick and crosses the
  WASM boundary once per layer (`layers_metadata()` + `layer_pixels_at()` per
  visible layer — a full canvas-sized buffer copied out per layer per tick),
  then blends in TS.
- The thumbnail copy's correctness is enforced by nothing — the tolerance is a
  comment, not a test.

Constraint discovered during grilling: the persistence read path
(`session-storage.ts` → `session-storage-types.ts`) is **WASM-free by
construction**, and the landing route (saved-work browser) builds thumbnails
through it. Routing thumbnails through core would put the wasm bundle + init
on the landing route.

## Solution

### 1. One blend primitive on `Color` (core-internal dedup, bit-identical)

Per rust-conventions ("methods belong on the type"):

```rust
// crates/core/src/color.rs
impl Color {
    pub fn source_over(self, dst: Color) -> Color; // delegates with opacity 1.0
    pub fn source_over_scaled(self, dst: Color, src_opacity: f32) -> Color;
}
```

- `selection.rs`'s private `source_over` is deleted; call sites use
  `src.source_over(dst)`.
- `document.rs`'s `blend_pixel_canvas_over` keeps its chunk loop but builds
  `Color`s and calls `source_over_scaled` (Copy 4-byte struct, inlined —
  zero-cost; flood fill already does per-pixel `Color` round-trips).
- Numeric contract: layer opacity stays `f32` through the blend — never
  pre-multiplied into a quantized `u8` alpha. Output must be bit-identical to
  today; the existing document.rs / selection.rs test suites are the behavior
  pins and must pass unchanged.

### 2. Core patch-composite entry; delete the TS blend functions

```rust
// crates/core/src/document.rs
pub fn composite_with_layer_patch(
    &self,
    layer_id: Uuid,
    patch: &[u8],
    patch_width: u32,
    patch_height: u32,
    dest_x: i32,
    dest_y: i32,
) -> Result<Vec<u8>, /* actionable error */>
```

Contract (matches today's TS preview semantics exactly):

- Composites the **Active Frame** (no frame parameter — the Floating Selection
  exists only on the active frame; YAGNI).
- The patch is source-over'd onto a copy of the target layer's active-frame
  Cel at `(dest_x, dest_y)` with out-of-bounds rows/columns clipped, **then**
  the patched layer participates in the normal composite at its layer opacity.
- Invisible layers skipped, as in `composite()`.
- `Err` (actionable messages) on: unknown `layer_id`, `patch.len() !=
  patch_width * patch_height * 4`, target is a Reference Layer.
- Core vocabulary stays generic ("layer patch") — the web-only Floating
  Selection concept does not enter the core.

Consumers:

- `wasm/src/lib.rs`: one mirror method (uuid parse + `map_err` only).
- `floating-selection-lifecycle.ts`: `blendSourceOver`,
  `blendLayerPixelsOver`, `compositeFloatingSelectionIntoLayer` deleted;
  `previewPixels()` shrinks to
  `floating ? document.composite_with_layer_patch(…) : document.composite()`.
- Boundary crossings per drag tick: N layer-buffer copies out → 1 patch copy
  in + 1 result out.

### 3. Thumbnails stay in TS, drift becomes tested instead of tolerated

- `compositeV3` / `compositeForExportSummary` remain (landing stays WASM-free —
  a deliberate property worth keeping; ±1 rounding on thumbnails does not
  justify shipping wasm to the entry route).
- New **parity test**: feed the same layer stacks through the core
  `composite()` (vitest already instantiates real WASM documents) and through
  `compositeV3`; assert per-channel difference ≤ 1 (Rust `f32` vs JS `f64`
  rounding), with exact equality on simple fixtures. Formula drift (wrong
  math) produces differences ≫ 1 and fails.
- Update `compositeV3`'s doc comment: differences are no longer "tolerated"
  but guarded by the parity test.

### Explicitly out of scope / future direction

- **Persist the composite at save time (schema V8)**: the editor (where WASM
  lives) would write summary pixels into the record on save; the gallery would
  read them verbatim and `compositeV3` could be deleted entirely (4 → 1). Not
  in this issue — it couples schema migration (old records can't be backfilled
  in a WASM-free upgrade context → nullable field + fallback), storage growth,
  and the existing IndexedDB-quota backlog item. Revisit when the project file
  format work (tasks/todo.md, Milestone 4) reshapes the schema anyway.
- No Apple changes (ADR: Apple stays on single PixelCanvas; it has no layer
  composite).
- No new CONTEXT.md term — "source-over" is standard graphics vocabulary and
  the patch entry is core API surface, not domain language.

## Test plan

- `color.rs`: unit tests for `source_over(_scaled)` — transparent src leaves
  dst, transparent dst copies src, `out_a == 0` yields `Color::TRANSPARENT`,
  opacity scaling, rounding pins.
- `document.rs` / `selection.rs`: existing suites unchanged (bit-identical
  refactor — they are the pins).
- `document.rs`: new tests for `composite_with_layer_patch` — clipping at all
  four edges, patch-then-opacity ordering, invisible-layer skip, the three
  `Err` modes, and equivalence with `composite()` when the patch is fully
  transparent.
- `wasm`: one marshal smoke test (per the replace-don't-layer doctrine — no
  behavior re-testing at the facade).
- `session/`: the parity test described above.
- `floating-selection-lifecycle` / `tab-state` preview tests survive unchanged
  (output-identical).

## Acceptance criteria

- One source-over formula exists in the tree: `Color::source_over(_scaled)`.
  `selection.rs::source_over` and the three TS blend functions are gone;
  `blend_pixel_canvas_over` delegates to the primitive.
- `previewPixels()` performs no per-layer pixel reads and no TS blending.
- Existing document.rs, selection.rs, floating-selection-lifecycle, and
  tab-state suites pass without modification.
- Parity test pins `compositeV3` against the core composite (≤ 1 per channel);
  its doc comment references the test instead of tolerating drift.
- Landing route remains WASM-free (no wasm import reachable from
  `session-storage.ts` / `routes/+page.svelte`).
- `cargo test`, unit suites, and e2e editor specs pass.

## Blocked by

None — independent of issue 221 (no file overlap; either may land first).

## Notes

- 2026-07-05: Produced by the `/improve-codebase-architecture` review
  (candidate #4 of 11) followed by a grilling pass. Decision tree resolved
  with the user: core patch-composite entry over TS-helper consolidation or
  status quo; thumbnails stay TS with a parity test (landing WASM-free
  preserved) over gallery-WASM or save-time persistence; primitive as `Color`
  methods per rust-conventions with `f32` opacity through the blend; single
  specialized `composite_with_layer_patch` (active frame, clipping, actionable
  errors) over a stateless buffer-composite fn or an index/frame-parameterized
  general form.
