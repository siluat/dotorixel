---
title: "Reference Layer type — tracing reference for pixel artwork"
status: needs-triage
created: 2026-05-16
---

## Problem Statement

Pixel art creators commonly trace over a reference — a photo, a sketch, an existing artwork — to guide proportions, colors, and silhouettes. DOTORIXEL today offers Reference Window (PRD-053), but that is a sampling/preview affordance: it is workspace-scoped, does not survive reload, never interleaves with the user's layers, and cannot sit *behind* a partly transparent paint layer. There is no way to set up a reference once, refine it across sessions, and use it as a stable tracing backdrop while drawing.

PRD-086 (Layer system: basic infrastructure) explicitly left the `Reference Layer / Pixel Layer split (umbrella enum transition)` as a follow-up — the layer system was designed with this extension in mind. This PRD fills that slot.

## Solution

Introduce a new Layer variant — **Reference Layer** — that lives in the Document's layer stack alongside the existing painting layer (now formally **Pixel Layer**). A Reference Layer carries a decoded source image plus a placement (position + uniform scale) describing where the source projects onto the document. The user can:

- Import a reference image as a Reference Layer from a dedicated Timeline Panel icon.
- Move, scale, hide, reorder, and delete a Reference Layer the same way they manage Pixel Layers.
- Reset the placement to the source image's natural size, keeping the center point.

A Reference Layer is **visible on screen but excluded from exports** (PNG, SVG, saved-work thumbnails). It survives reload, tab switching, and undo/redo — it is a Document construct, not an ephemeral overlay. The export-exclusion rationale is recorded in `docs/decisions/reference-layer-excluded-from-export.en.md`.

### Key shape changes

- **Type model**: `Layer` becomes the umbrella with `kind: LayerKind::Pixel(...) | LayerKind::Reference(...)`. Existing layers become Pixel Layers.
- **Composite paths**: `Document.composite()` blends every visible layer (on-screen). New `Document.composite_for_export()` blends Pixel Layers only.
- **Persistence**: V4 schema with a discriminated-union `LayerRecord`. V3→V4 migration wraps every existing layer as `kind: 'pixel'`.
- **Timeline Panel**: a Reference Layer import icon sits next to the Pixel `+`; rows show a kind icon; the active Reference Layer exposes a "Restore original size" inline action.
- **Viewport overlay**: when a Reference Layer is active, an overlay with handles lets the user drag-resize and move its placement. Drag-release commits via a single Document mutation.

## User Stories

1. As a pixel artist, I want to import a reference image as a layer in my document, so that the trace target persists across sessions instead of disappearing every reload.
2. As a pixel artist, I want the reference image to render behind my paint layers in the on-screen composite, so that I can trace over it without juggling external tools.
3. As a pixel artist, I want the reference image **not** to appear in my exported PNG or SVG, so that I publish only my own artwork.
4. As a pixel artist, I want the reference image to be excluded from the saved-work thumbnail, so that my work browser reflects what I drew, not what I traced.
5. As a pixel artist, I want a dedicated, obvious entry point for adding a Reference Layer (separate from the Pixel "+"), so that I do not confuse it with adding a normal paint layer.
6. As a pixel artist, I want the "add Pixel Layer" button to stay a single click, so that the more frequent action does not get slower because of a less frequent one.
7. As a pixel artist, I want to drag the Reference Layer's handles to move and resize it, so that I can align it visually with the work.
8. As a pixel artist, I want one click on "Restore original size" to return the reference to its natural pixel dimensions (preserving the center point), so that I can recover an unscaled view after experimenting.
9. As a pixel artist, I want to undo a placement change (drag-resize, move, "Restore original size") with the usual shortcut, so that I can experiment freely without losing prior state.
10. As a pixel artist, I want a hidden Reference Layer to be excluded from both the on-screen composite and the export, so that visibility behaves consistently with Pixel Layers.
11. As a pixel artist, I want each layer row in the Timeline Panel to show a distinct icon for Pixel vs Reference, so that I can tell at a glance which is which.
12. As a pixel artist, I want to be able to set a Reference Layer as the active layer (e.g., to move it), so that active-layer behavior is consistent across kinds.
13. As a pixel artist, when a Reference Layer is active and I select a drawing tool, I want the tool to silently no-op with clear UI feedback (not an error toast, not a stray pixel), so that mis-clicks are harmless and the reason is obvious.
14. As a pixel artist, I want eyedropper and Canvas Sampling Sessions to read from the active layer regardless of kind, so that sampling behavior stays consistent.
15. As a pixel artist, I want to reorder a Reference Layer up or down in the stack like any other layer, so that I can place it behind or in front of paint layers as needed.
16. As a pixel artist, I want the reference image to be sampled with nearest-neighbor rather than smooth interpolation, so that the trace target keeps a crisp pixel-art aesthetic at any scale.
17. As a pixel artist, I want my Reference Layers to survive a page reload, so that my work-in-progress doesn't reset every session.
18. As a returning user with an existing V3 document, I want my old document to open without losing any layers, so that the V4 migration is transparent.
19. As a pixel artist, I want a Reference Layer's display name to default to the imported file's name, so that I can identify the reference at a glance instead of seeing a generic "Reference 1".
20. As a pixel artist, I want layer-level operations (delete, reorder, visibility toggle) to behave the same way for Reference Layers as for Pixel Layers, so that I do not need to remember kind-specific exceptions.
21. As a pixel artist, I want the Reference Layer import to reuse the same file decoder as the Reference Window flow, so that supported formats stay consistent across the two features.
22. As a pixel artist, I want a Reference Layer's source dimensions and natural size to be preserved across reloads, so that "Restore original size" always returns to the same baseline.

## Implementation Decisions

### Modules

The work splits across these modules:

- **Rust core — `Layer` umbrella refactor** (`crates/core/src/layer.rs`)
- **Rust core — `ReferencePlacement` value type** (new module; deep)
- **Rust core — nearest-neighbor sampler** (new; deep)
- **Rust core — `Document` extensions** (`crates/core/src/document.rs`)
- **WASM facade extensions** (`wasm/`)
- **TS canvas-model interface** (`src/lib/canvas/canvas-model.ts`)
- **Session storage V4 schema + migration** (`src/lib/session/session-storage-types.ts`)
- **Reference Layer import action** (new; reuses `src/lib/reference-images/decode-reference-blob.ts`)
- **Timeline Panel UI extensions** (`src/lib/ui-editor/TimelinePanel.svelte` or equivalent)
- **Placement viewport overlay** (new component)
- **Export call-site updates** (PNG, SVG, saved-work thumbnail)

The four candidates for unit tests in isolation — `ReferencePlacement`, the nearest-neighbor sampler, `LayerKind` enum branching, and the V3→V4 migration — are all pure / deep modules.

### Type model (Rust core)

`crates/core/src/layer.rs` becomes:

- `Layer { id: Uuid, name: String, visible: bool, opacity: f32, kind: LayerKind }`
- `LayerKind::Pixel(PixelData) | LayerKind::Reference(ReferenceData)`
- `PixelData` owns the current `PixelCanvas` pixel buffer.
- `ReferenceData` owns the decoded source RGBA buffer, its natural width/height (preserved for "Restore original size"), and a `ReferencePlacement`.

The umbrella enum makes illegal states unrepresentable: pixel-mutation operations are routed through Document and take a `&mut PixelData`. The Rust style rule "Enums with data for variant types" (`.claude/rules/rust-conventions.md`) is the direct motivation.

### `ReferencePlacement` value type (Rust core)

A new pure value type. Concrete fields settled during implementation (likely `{ x, y, scale }` with `f32` for sub-pixel placement), with methods:

- `restore_to_natural(natural_width, natural_height)` — reset width/height to natural while preserving the center point.
- `with_position(x, y)` / `with_scale(scale)` — value-type builders.

No IO, no dependency on Document. Tested in isolation.

### Nearest-neighbor sampler (Rust core)

Free function (or inherent method) that, given `source_rgba`, `source_dimensions`, a `ReferencePlacement`, and a document `(x, y)`, returns the source pixel at that document coordinate or `None` if `(x, y)` is outside the source's projected footprint. Integer-floor sampling appropriate for pixel art. Pure function with no Document coupling.

### Document API extensions (Rust core)

In `crates/core/src/document.rs`:

- `add_reference_layer(id, name, source_rgba, source_width, source_height, placement)` — appends a Reference Layer and sets it active.
- `set_reference_placement(id, placement)` — atomic placement update used by drag-release commits and "Restore original size".
- `layer_kind_at(index)`, `layer_source_pixels_at(index)`, `layer_source_dimensions_at(index)`, `layer_placement_at(index)` — kind-aware accessors that return `Option<...>` when called against the wrong variant.
- `composite_for_export()` — Pixel-only composite (export path).
- `composite()` — extended to include Reference Layers in the on-screen blend via the nearest-neighbor sampler.

Drawing methods (`set_pixel`, `flood_fill`, `apply_tool`) that already mutate the active layer remain unchanged in signature; internally they assert the active layer is a Pixel Layer and either return a `LayerKindMismatch` error or a clear "no pixels mutated" result depending on the call. The TS tool runner translates that into a silent no-op for the user.

### Composite paths

- `Document.composite()` — every visible layer blended source-over from the bottom up. Pixel Layers use direct RGBA copy; Reference Layers use the nearest-neighbor sampler at each output pixel.
- `Document.composite_for_export()` — only Pixel Layers blended source-over.
- Export call sites (PNG, SVG, saved-work thumbnail) call `composite_for_export()` exclusively. On-screen renderer calls `composite()`.

The split is encoded at the composite level, not at the call site — see the ADR for the rationale.

### WASM facade (`wasm/`)

`WasmDocument` exposes each new Document method as a 1:1 binding. No business logic in this layer.

### TypeScript canvas-model (`src/lib/canvas/canvas-model.ts`)

The `Document` interface gains the new method signatures. `wasm-sync.test.ts` continues to enforce structural compatibility at compile time.

### Persistence: V3 → V4 (`src/lib/session/`)

- `LayerRecord = PixelLayerRecord | ReferenceLayerRecord` discriminated union, discriminated by `kind: 'pixel' | 'reference'`.
- `ReferenceLayerRecord` stores the source blob (preferred — keeps storage compact) and re-decodes on hydrate via `decode-reference-blob.ts`. Natural width/height and placement are stored alongside.
- `migrateV3ToV4()` wraps every V3 layer as `{ kind: 'pixel', ...existing }`. History is dropped during migration (legacy snapshots have no kind information; the user starts with an empty history immediately after migration — same precedent as V2→V3).
- IndexedDB `DB_VERSION` bumped to V4 with a V3→V4 cursor migration.

### Tool behavior

- **Drawing tools** (pencil, brush, eraser, bucket, shape, move): when the active layer is a Reference Layer, the tool runner silently no-ops. UI affordance — a non-draw cursor and/or muted tool-button state — communicates the state. No toast, no error.
- **Non-drawing tools** (eyedropper, Canvas Sampling Session): operate on the active layer regardless of kind. A Canvas Sampling Session against a Reference Layer reads the projected source pixel through the same nearest-neighbor sampler used for composite.
- **Active-layer selection** works regardless of kind.

### Import entry point (Timeline Panel)

A dedicated Reference Layer icon sits next to the existing `+` (Pixel Layer add). Single-click opens the file picker; the chosen file is decoded via `decode-reference-blob.ts` and added through `add_reference_layer`. The Pixel `+` path is unchanged — the more frequent action retains its single-click affordance.

### Viewport placement overlay

When the active layer is a Reference Layer, the canvas viewport renders an 8-handle overlay (corners + edge midpoints, mirroring Reference Window's resize affordance). Pointer drag previews the new placement in real time; on release the new placement commits via `set_reference_placement` and pushes a Document snapshot to history. Cancel-on-escape (or pointer-cancel) drops the preview without committing.

### History scope

Add, remove, reorder, visibility toggle, placement drag-resize commit, and "Restore original size" all push Document snapshots through the existing `HistoryManager`. Active-layer selection is not undoable (consistent with PRD-086).

### Naming convention

Pixel Layers continue to use `nextLayerNumber` ("Layer N", localized). Reference Layers default to the imported file's display name (e.g., `panda.png`). No `nextReferenceLayerNumber` counter — file names already serve as identifiers, and rename arrives as a shared follow-up. If the file name is empty or unavailable, fall back to `"Reference"` (localized).

### Opacity & rename UX

Opacity is already on `Layer`; the slider UI is the same follow-up for both kinds (per PRD-086 out-of-scope). Rename is also a follow-up shared with PRD-086.

### Apple shell

This PRD makes no changes to the Apple shell. Apple still preserves the single `PixelCanvas` interface per `docs/decisions/web-document-layer-apple-preserved.en.md`. Reference Layer support on Apple arrives in a future Phase.

### Core placement rationale

`LayerKind`, `ReferencePlacement`, the nearest-neighbor sampler, and the two composite paths satisfy the Core Placement criteria:

- A complex multi-variant model (kind enum + composite branching) lives in one authoritative place.
- The model is shared between the on-screen render path and the export path — divergence here would be a footgun.
- Both shells will eventually share this model — the current web/Apple split is a phasing decision, not a permanent fork.

## Testing Decisions

Test principle: verify external behavior only — input/output of pure modules, observable composite results, observable migration output. No tests pin internal field layouts or implementation steps.

The user has asked for unit tests on **all four** deep-module candidates.

### Deep-module unit tests (1st priority)

- **`ReferencePlacement`** — Rust inline tests in `crates/core/src/layer.rs` (or a dedicated `reference_placement.rs`).
  - Verify: `restore_to_natural` preserves the center, builders are value-pure, identity placement is a no-op.
  - Prior art: inline `#[cfg(test)] mod tests` in `crates/core/src/canvas.rs`.
- **Nearest-neighbor sampler** — Rust inline tests.
  - Verify: 1:1 mapping; integer scale-up (2x, 3x); scale-down by half; sub-pixel offsets snap to integer source coords; out-of-source coordinates return `None`; edge pixels (last row/column).
  - Table-driven inputs over small fixture RGBA buffers.
- **`LayerKind` enum branching** — Rust inline tests in `crates/core/src/document.rs`.
  - Verify: pixel-mutation API against a Reference Layer returns the documented error (or no-op), kind-aware accessors return `None` for the wrong variant, mixed-kind documents preserve every layer's kind across snapshot round-trips.
- **V3 → V4 migration** — Vitest unit in `src/lib/session/`.
  - Verify: every V3 layer becomes a `kind: 'pixel'` V4 layer with the same pixels/name/visibility/opacity; no pixel loss; `nextLayerNumber` preserved; documents with no layers are not migrated (defensive); the migration is idempotent on already-V4 input.
  - Prior art: existing V2→V3 migration tests in the same directory.

### Recommended integration coverage

- **`Document.composite_for_export()` excludes Reference Layers** — Rust unit test with a Document of mixed kinds; assert the export composite equals the Pixel-only composite.
- **`Document.composite()` includes Reference Layers** — Rust unit test asserting a visible Reference Layer contributes to the on-screen blend; a hidden one does not.
- **Tool no-op on Reference Layer** — TS Vitest on `tool-runner` with a stubbed Document where the active layer is a Reference Layer; assert no pixel mutation occurs and no error is surfaced.
- **Active-layer selection across kinds** — TS Vitest on `tab-state` asserting activation works for both kinds and editing tools silently no-op when a Reference Layer is active.

### Lightly recommended

- **WASM facade smoke test** — Rust unit calling each new bound method against a constructed Document, asserting no panic and the expected return shape.

### Deferred

- **Placement overlay component test** — added after the placement UI is finalized.
- **E2E** — a single Playwright flow ("import reference → trace → export PNG → assert reference absent → reload → reference restored") becomes regression defense before public release.

## Rejected Alternatives

### Reference Layer participates in exports (PRD-053's implied position)

Treat Reference Layer like every other layer; include it in PNG/SVG/thumbnails.

**Rejected because**: the user's intent is tracing, not publishing. The reference is an input, not artwork; including it in exports defeats the workflow. ADR `reference-layer-excluded-from-export.en.md` records the rationale.

### Per-layer "export inclusion" toggle (default-off)

Add a `exported: boolean` to every Layer; Reference defaults to `false`.

**Rejected because**: the flag leaks into Pixel Layer for no benefit, and the user-facing default already matches intent. Revisit only if a user reports wanting to publish the reference with the artwork.

### Workspace-scoped Reference Layer (overlay, not in Document)

Persist Reference Layer outside the Document.

**Rejected because**: tracing is a long-running activity that must survive reload and tab switching, and placement changes must participate in undo/redo. A workspace overlay forfeits all of those.

### Rasterize Reference Layer to a Pixel Layer (v1 feature)

A one-click action to bake the Reference Layer into a Pixel Layer at the current placement.

**Rejected for v1**: the use case (committing a traced reference to permanence) is rare in a tracing workflow; once a user has finished tracing they delete the Reference Layer. Revisit if demand emerges.

### Image-scale sample interpolation (bilinear / bicubic)

Smooth Reference Layer sampling when scaled.

**Rejected**: pixel art relies on crisp, integer-aligned references. Smooth interpolation muddies the trace target. Nearest-neighbor matches user intent.

### Shared `nextReferenceLayerNumber` counter

Maintain a monotonic counter for Reference Layer naming (parallel to `nextLayerNumber`).

**Rejected**: file names already identify the reference at a glance ("panda.png"); a counter would be less informative. If file name is unavailable, fall back to a localized "Reference".

### Restore size via per-axis width/height inputs

Expose a numeric width/height pair the user types to scale the reference.

**Rejected for v1**: a single button ("Restore original size") + handle-drag covers 95% of the workflow without an extra input surface. Revisit if precise placement is requested.

## Out of Scope

- **Rasterize (convert Reference Layer to Pixel Layer pixels)** — explicitly excluded; revisit on demand.
- **Reference Layer rename** — shared with the Pixel Layer rename follow-up (PRD-086).
- **Reference Layer opacity slider UI** — shared with the Pixel Layer opacity slider follow-up (PRD-086).
- **Apple shell Reference Layer support** — Apple still preserves the single-canvas model; arrives in a future Phase.
- **Per-layer "include in export" toggle** — Reference is unconditionally excluded.
- **Reference Window ↔ Reference Layer cross-conversion** — independent features.
- **Image format support extensions** — supported set is whatever `decode-reference-blob.ts` already accepts.
- **Source-image cache compaction / mipmaps** — source RGBA stored at native dimensions and resampled at composite time; no LOD pyramid.
- **Reference Layer rotation or non-uniform scale** — v1 placement is position + uniform scale only.
- **Composite caching** — keep PRD-086's "no caching" policy; measure if needed.

## Further Notes

- PRD-053 stated that Reference Layer "will live inside the layer system and be part of the document" (`issues/053-floating-reference-window.md:19`), with the natural implication that it would behave like every other layer in exports. This PRD overrides that implication. The ADR `docs/decisions/reference-layer-excluded-from-export.en.md` records the rationale.
- `CONTEXT.md` has been updated with Pixel Layer, Reference Layer, and Reference Layer Placement entries; the umbrella-placeholder note on Layer has been replaced with the realized split.
- The Rust style rules in `.claude/rules/rust-conventions.md` apply directly — particularly "Enums with data for variant types" (motivates `LayerKind`) and "Derive traits when their semantics are unambiguous" (placement equality and clone for snapshots).
- Existing modules likely impacted:
  - Rust core: `crates/core/src/layer.rs`, `crates/core/src/document.rs`, `crates/core/src/history.rs` (snapshot already structural; covers umbrella automatically).
  - WASM: `wasm/` Document facade.
  - TS canvas-model: `src/lib/canvas/canvas-model.ts`, `src/lib/canvas/tool-runner.svelte.ts`.
  - Session storage: `src/lib/session/session-storage-types.ts`, V3→V4 migration tests.
  - UI: Timeline Panel components, viewport overlay (new), all export call sites (PNG, SVG, saved-work thumbnail).
  - Reference decoder: `src/lib/reference-images/decode-reference-blob.ts` (reused).
- The PRD-086 sub-issue pattern (`087-…104`) is a precedent for how this PRD will decompose. Sub-issues are not created in this document — they are produced by the next `/to-issues` invocation.
