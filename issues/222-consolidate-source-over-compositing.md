---
title: "Consolidate source-over compositing into one core primitive"
status: done
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

## Results

| File | Description |
|------|-------------|
| `crates/core/src/color.rs` | New `Color::source_over` / `source_over_scaled` primitive (the single source-over formula) + 8 unit tests |
| `crates/core/src/selection.rs` | Private `source_over` deleted; call site uses `src.source_over(dst)` |
| `crates/core/src/document.rs` | `blend_pixel_canvas_over` delegates to the primitive (skip guard preserved for bit-identity); new `composite_with_layer_patch` + `CompositePatchError` + private `apply_layer_patch`; 8 new tests |
| `wasm/src/lib.rs` | `composite_with_layer_patch` binding (uuid parse + `map_err`) + 1 marshal smoke test |
| `src/lib/canvas/canvas-model.ts` | `Document` interface gains `composite_with_layer_patch` |
| `src/lib/canvas/editor-session/floating-selection-lifecycle.ts` | `blendSourceOver` / `blendLayerPixelsOver` / `compositeFloatingSelectionIntoLayer` deleted; `previewPixels()` reduced to one core call (no per-layer reads, no TS blend) |
| `src/lib/canvas/fake-drawing-ops.ts` | Fake `Document` stubs the new method (not-implemented throw, unused by fake-based tests) |
| `src/lib/session/session-storage-types.ts` | `compositeV3` doc comment: drift now pinned by a parity test, not "tolerated" |
| `src/lib/session/composite-parity.test.ts` | New — pins `compositeV3` (f64) against the core composite (f32) to ≤ 1 per channel, exact on integer-exact fixtures |

### Key Decisions

- **Bit-identity via a preserved skip guard.** `blend_pixel_canvas_over` keeps its
  `src_a == 0` early-skip: a low-opacity layer can produce an `alpha=0 / RGB≠0`
  destination pixel, and overwriting it with a transparent source would zero the
  RGB — a byte-level divergence the existing composite suites would (silently)
  drift on. Channel formula and operation order match the originals exactly, so
  `document.rs` / `selection.rs` / floating-selection / tab-state suites pass
  unmodified.
- **Core vocabulary kept generic.** `apply_layer_patch` is a separate
  document-module helper rather than reusing `selection.rs::composite_region`,
  which is bound to `MarqueeRegion` (Selection vocabulary). Reuse would couple the
  generic patch entry to the web-only Floating Selection concept the issue
  explicitly keeps out of the core; the small clip-and-blend duplication is the
  lesser cost. Core doc comments describe the mechanism generically (no
  "Floating Selection" / "TS" in the shared core).
- **f32/f64 parity.** Preview tests use fully-opaque fixtures, so f32 and f64 round
  identically (they pass unchanged). The parity test allows ≤ 1 per channel
  because the two implementations share one formula and differ only in float
  width; a real formula drift moves a channel far more than 1 and fails.
- **`CompositePatchError::ReferenceLayerTarget`** kept as a precise, actionable
  variant (over reusing the general `LayerKindMismatch` term) — confirmed with the
  user.

### Notes

- Unknown `layer_id` and wrong patch size now return `Err` where the old TS path
  silently showed the un-patched composite. Both are unreachable in practice
  (a Floating Selection commits before its source layer can be removed, and
  `floating.buffer` always matches `sourceRegion`); the `Err`s are the boundary
  validation the issue specified.
- Out of scope as planned: schema V8 save-time composite persistence (would let
  `compositeV3` be deleted entirely) — revisit with the project file format work.
- Verified: `cargo test` (core 508 / wasm 41), `cargo fmt`, clippy (no new
  warnings), `bun run check` (0 errors), vitest (1619), full editor e2e (89).
