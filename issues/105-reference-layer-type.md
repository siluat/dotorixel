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
23. As a pixel artist importing a reference much larger than my canvas (e.g., a photo), I want the import to auto-fit aspect-preservingly so I can see the whole reference at once, instead of seeing a tiny center slice and being stuck on where to start.
24. As a pixel artist resizing my canvas while a Reference Layer is in place, I want the placement to follow my chosen anchor (e.g., center anchor keeps the reference centered), so that anchor selection means the same thing for both layer kinds.
25. As a pixel artist using a precise reference, I want to nudge the active Reference Layer 1 pixel at a time with arrow keys (10 pixels with Shift), so that I can align it to my work without resorting to mouse precision.
26. As a pixel artist who wants a clean integer scale, I want Shift while dragging a corner handle to snap to integer scale multiples (1x, 2x, 3x ...), so that the reference renders crisply under nearest-neighbor sampling.
27. As a pixel artist who just attempted to draw on a Reference Layer, I want to see a "not allowed" cursor (and the kind icon in the Timeline Panel) instead of an error toast, so that I recognize "wrong layer kind" without being interrupted by a dialog.
28. As a pixel artist importing a large file, I want the new layer row to appear immediately with a loading indicator, so that I get clear feedback that my click was received before the decode finishes.
29. As a pixel artist who picked an unsupported or corrupt file by mistake, I want a brief error toast and no leftover row, so that the failure is visible but doesn't clutter my workspace.
30. As a pixel artist whose storage quota is near full, I want the failed import to roll back cleanly with a clear toast about disk space, so that I know what to do (delete other references / documents) instead of being silently failed.
31. As a pixel artist on a touch device (tablet browser), I want the placement handles to be comfortably finger-sized regardless of canvas zoom, so that I can adjust the reference without zooming in just to hit a handle.
32. As a pixel artist who eyedrops outside the projected reference area, I want nothing to happen (no false color committed), so that I don't accidentally pick up a color from a layer I didn't intend.

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
- `set_reference_placement(id, placement)` — atomic placement update used by drag-release commits, keyboard nudges, and "Restore original size".
- `resize_with_placement(width, height, anchor)` — extends the existing resize to also transform every Reference Layer's placement by the same 9-anchor factor (`placement.x += (new_w − old_w) × anchor_x_factor`, same for y; `placement.scale` unchanged). Pixel Layers continue to use the existing anchor-based crop/extend.
- `layer_kind_at(index)`, `layer_source_pixels_at(index)`, `layer_source_dimensions_at(index)`, `layer_placement_at(index)` — kind-aware accessors that return `Option<...>` when called against the wrong variant.
- `try_get_pixel(x, y) → Option<Color>` — sampling-aware accessor. For a Pixel Layer active: returns `Some(color)` inside document bounds, `None` outside. For a Reference Layer active: returns `Some(color)` when `(x, y)` is inside the source's projected footprint, `None` otherwise. Used by eyedropper and Canvas Sampling Sessions; the existing throwing `get_pixel` is kept for callers that genuinely require in-bounds and would treat OOB as a bug.
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

- **Drawing tools** (pencil, brush, eraser, bucket, shape, move): when the active layer is a Reference Layer, the tool runner silently no-ops. Feedback is **passive**: the canvas cursor switches to `not-allowed` (⊘) while a drawing tool is selected and the active layer is Reference; the Reference Layer's kind icon in the Timeline Panel and the visible placement overlay supply the context. No toast, no dimmed tool buttons (tool selection is independent of active layer — buttons must remain immediately usable as soon as the user switches active to a Pixel Layer).
- **Non-drawing tools** (eyedropper, Canvas Sampling Session): operate on the active layer regardless of kind via `Document.try_get_pixel`. For Pixel Layer active: standard sampling. For Reference Layer active: the projected source pixel is read through the same nearest-neighbor sampler used for composite. **Out-of-source-footprint clicks (or out-of-document clicks) are a silent no-op** — no color is committed to FG/BG and the recent-color list is not updated. This rule applies uniformly to both kinds: the meaning of "sampling outside the active layer's available pixels" is "do nothing".
- **Active-layer selection** works regardless of kind. Switching active in the Timeline Panel is not undoable.
- **Mobile / touch parity**: cursor feedback is desktop-only (no cursor on touch). On touch, the active Reference Layer's overlay (always visible) is the primary indicator that drawing tools will no-op — the placement handles and outline say "this layer is a Reference, not a drawing surface".

### Import entry point (Timeline Panel)

A dedicated Reference Layer icon sits next to the existing `+` (Pixel Layer add). Single-click opens the file picker; the chosen file is decoded via `decode-reference-blob.ts` and added through `add_reference_layer`. The Pixel `+` path is unchanged — the more frequent action retains its single-click affordance.

**Drag-and-drop policy** — file drops onto the canvas continue to create **Reference Window** per PRD-053 (Drop Batch mechanics unchanged). Reference Layer is created **only** via the dedicated Timeline Panel icon. Rationale: Reference Window and Reference Layer serve different use cases (sampling/preview vs. tracing); drop is a fast, low-commitment gesture that matches the Reference Window mental model, while the explicit icon click signals the deliberate trace-setup intent. A future "promote Reference Window to Reference Layer" action can bridge the two without changing the drop semantics — listed as Out of Scope.

**Clipboard paste** — not supported in v1 for either Reference Window or Reference Layer. Reference Window's paste is already deferred (`tasks/todo.md` Review backlog); adding paste only for Reference Layer would be asymmetric. Both gain paste together in a future iteration.

### Initial placement on import

`add_reference_layer` computes the initial `ReferencePlacement` as **auto-fit, aspect-preserving**:

```text
scale  = min(canvas_width / source_width, canvas_height / source_height, 1.0)
center = (canvas_width / 2, canvas_height / 2)
```

- When `source ≤ canvas` in both dimensions, `scale = 1.0` and the reference shows at native size, centered.
- When `source > canvas` in either dimension, the reference is scaled down so the longest axis fits, centered. Aspect ratio is preserved by construction.
- `Document.add_reference_layer` always computes this on the Rust side, so the TS caller only needs to supply source RGBA + dimensions + name. The placement is not a caller responsibility.
- "Restore original size" (decided previously) resets `scale = 1.0` while preserving the current center point — regardless of whether the natural size exceeds the canvas. The user opts in to native-size view when needed.

### Canvas resize × placement (Document.resize)

`Document.resize(width, height, anchor)` extends its 9-anchor policy to Reference Layer placements:

```text
anchor_x_factor ∈ {0, 0.5, 1.0}  // left, center, right
anchor_y_factor ∈ {0, 0.5, 1.0}  // top, center, bottom

placement.x += (new_width  − old_width)  × anchor_x_factor
placement.y += (new_height − old_height) × anchor_y_factor
placement.scale  // unchanged
```

- For top-left anchor (factor = 0), placement coordinates are unchanged — the simple case stays simple.
- For center anchor, the reference's center stays at the new canvas center after resize.
- For bottom-right anchor, the reference shifts the full delta — its bottom-right corner stays anchored.
- When the new canvas is smaller and the reference's projected footprint extends past the new bounds, the composite naturally clips (same policy as Pixel Layer cropping). The source RGBA buffer is **never modified**; the user can move the reference back into view with the overlay or arrow nudge.
- "Restore original size" after a resize re-centers at the **current** canvas center (not the pre-resize center), consistent with the "center preserved" rule.

### Viewport placement overlay

When the active layer is a Reference Layer, the canvas viewport renders a placement overlay with three interaction zones:

| Zone | Pointer action | Cursor |
|---|---|---|
| Four **corner handles** | Drag — uniform scale around the opposite corner anchor | `nwse-resize` / `nesw-resize` (per corner) |
| **Body** (inside placement, outside handles) | Drag — translate (move) | `move` |
| **Outside placement** | Tool default | Tool cursor |

Edge-midpoint handles are intentionally **omitted** — placement is uniform-scale only (no non-uniform stretch), so an edge handle would be a misleading affordance.

**Shift-modifier — integer scale snap.** While dragging a corner handle with Shift held, the effective scale snaps to integer multiples (`1.0, 2.0, 3.0, ...`). Useful for pixel-aligned reference renders under nearest-neighbor sampling.

**Keyboard nudge.** When the active layer is Reference and focus is on the canvas / overlay (not on the Timeline Panel or other UI):

- `↑ ↓ ← →` — translate placement by 1 pixel in the respective direction.
- `Shift + ↑ ↓ ← →` — translate by 10 pixels.
- Each nudge pushes a separate Document snapshot. Nudges are not coalesced (every nudge is a precise, undoable step).

**Commit semantics.** Pointer-drag previews in real time; on release the new placement commits via `set_reference_placement` and pushes a single Document snapshot to history. Pointer-cancel or `Escape` during drag drops the preview without committing. Keyboard nudge commits per key event (no drag-in-progress concept).

**Constraints.** Minimum projected size is 8×8 pixels — below that, the reference becomes invisible and the user is stranded. Maximum is unbounded (overflow allowed; "Restore original size" recovers).

**Screen-space handle sizing.** Handles are rendered at a constant pixel size on screen regardless of canvas zoom — they never shrink to invisibility on zoom-out, never balloon on zoom-in. Visual size: ~12px (desktop) and ~16px (touch). Hit area is extended with invisible padding so that touch interactions clear the 44pt minimum target (iOS HIG). The pointer kind (`pointerType === 'touch'`) determines which sizing applies, leveraging existing PointerEvents infrastructure.

### History scope

Add, remove, reorder, visibility toggle, placement drag-resize commit, **keyboard nudge (per key event)**, and "Restore original size" all push Document snapshots through the existing `HistoryManager`. Active-layer selection is not undoable (consistent with PRD-086). Drag preview frames are not pushed — only the drag-release commit becomes a single snapshot.

### Loading, failure, and storage-quota states

The import flow has three non-happy paths; each gets a deliberate UX response.

**Decode in progress (large files, ~500ms–1s).** Two simultaneous signals:

1. The new Reference Layer row appears in the Timeline Panel **immediately**, in a skeleton/spinner state. The user sees their click was received.
2. The Reference Layer import icon enters a disabled + spinner state to block duplicate triggers.

Both clear when the decode completes (success) or fails (failure path below). Decoding does not block other UI — drawing on a Pixel Layer continues to work during the decode.

**Decode failure (unsupported format, corrupt file).** The skeleton row is removed, the import icon returns to its normal state, and a brief error toast is shown via Paraglide messages (e.g., `reference_layer_import_failed`). The exact wording and supported-format list mirrors Reference Window's existing behavior — confirm during implementation that Reference Window's failure path uses a toast (vs. silent fail or modal); whatever it does, Reference Layer matches.

**Storage quota exceeded (IndexedDB write fails).** The new layer is rolled back — the in-memory add is reverted before it appears outside the skeleton — and a toast is shown explaining the cause and remedy (e.g., `storage_quota_exceeded`). Deeper handling (pre-check, usage indicator, in-app cleanup) is out of scope here and is owned by the existing backlog item (`tasks/todo.md` Review backlog: "IndexedDB quota exceeded error handling"). Reference Layer just amplifies the trigger frequency; the architectural solution is shared.

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
- **`Document.try_get_pixel` semantics across kinds** — Rust unit test: Pixel Layer in-bounds returns `Some`, OOB-document returns `None`; Reference Layer in-source-footprint returns `Some`, outside footprint returns `None`. Establishes the sampling contract eyedropper relies on.
- **`Document.resize_with_placement` across 9 anchors** — Rust unit test asserting placement coordinates transform correctly for each of the 9 anchor combinations, for both canvas grow and canvas shrink. Pixel Layer behavior remains unchanged; Reference Layer placement follows the same anchor factor table.
- **Initial placement = auto-fit aspect-preserving** — Rust unit test on `add_reference_layer` asserting the computed `scale` and `center` for cases: source ≤ canvas (scale = 1.0), source > canvas in one axis, source > canvas in both axes with different aspect ratios.
- **Tool no-op on Reference Layer** — TS Vitest on `tool-runner` with a stubbed Document where the active layer is a Reference Layer; assert no pixel mutation occurs and no error is surfaced.
- **Active-layer selection across kinds** — TS Vitest on `tab-state` asserting activation works for both kinds and editing tools silently no-op when a Reference Layer is active.
- **Keyboard nudge → single snapshot per event** — TS Vitest or Rust integration: each arrow-key fire pushes one snapshot; consecutive nudges do not coalesce. `Shift+arrow` translates 10px.

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

### Drag-and-drop creates a Reference Layer instead of a Reference Window

Make drop the default Reference Layer entry; reduce the icon's importance.

**Rejected because**: drop and trace-setup are different commitment levels. Drop is fast and low-commitment (peek at a reference); trace-setup is deliberate. Changing drop semantics also breaks the existing Reference Window muscle memory and adds a Drop Batch behavior mismatch (drop creates *many* references at once, which would create many tracing layers — almost never the user's intent). A future "promote Reference Window to Reference Layer" action bridges the two without changing drop.

### Initial placement = always natural size (Aseprite / Photoshop pattern)

Imported reference always starts at its native pixel size, centered.

**Rejected because**: DOTORIXEL canvases are small (max 256×256) and references are typically large photos. Starting at native size on a 64×64 canvas shows only a 64×64 center slice — the user can't see what they're tracing or where to begin adjusting. Auto-fit on import makes the whole reference visible immediately; native size is one click away via "Restore original size".

### Edge-midpoint handles with non-uniform (1-axis) scale

Add 4 edge handles that stretch only one axis.

**Rejected because**: non-uniform scale distorts the reference, which defeats the purpose of tracing. Pixel art references work best at native aspect; the placement model is deliberately uniform-scale-only. Edge handles with uniform scale would be a misleading affordance (they'd "feel" like 1-axis stretchers but behave identically to corners).

### Multi-touch pinch-to-scale on the placement overlay

Two-finger pinch on the overlay scales the reference.

**Rejected for v1**: pinch is already bound to canvas zoom — gesture disambiguation (was the user pinching the overlay or the canvas?) requires a tap-target detection layer with edge cases. The added value is small (corner-handle drag + Restore + keyboard already cover the workflow). Revisit if a touch-first usage pattern emerges.

### Eyedropper fall-through to composite at out-of-source coords

When sampling outside a Reference Layer's projected footprint, sample the composite color at that point.

**Rejected because**: the "active layer is sampling port" rule (decided in the layer-system grill) means the sampler reads what the *active* layer holds, not what's visually composited. Fall-through would surprise users with a color from a layer they didn't choose, and the natural extension ("which lower layer to sample from?") opens a separate decision tree with no good answer. Silent no-op is the consistent behavior — Pixel Layer + click on a transparent pixel already does the same thing.

### Aggressive drawing-tool no-op feedback (toast + dimmed tool buttons)

When a Reference Layer is active, dim drawing-tool buttons and show a first-click toast.

**Rejected because**: dimming tool buttons implies the *tool* is disabled, but the tool is fine — only the active *layer* doesn't accept marks. A user who momentarily clicks a drawing tool then re-activates a Pixel Layer should find the tool immediately usable, not have to wait for a UI state to recover. Toasts on every Reference activation become noise within minutes. A `not-allowed` cursor at the action site, plus the Reference kind icon in the Timeline Panel and the visible placement overlay, communicates the state without interruption.

## Out of Scope

- **Rasterize (convert Reference Layer to Pixel Layer pixels)** — explicitly excluded; revisit on demand.
- **Reference Layer rename** — shared with the Pixel Layer rename follow-up (PRD-086).
- **Reference Layer opacity slider UI** — shared with the Pixel Layer opacity slider follow-up (PRD-086).
- **Apple shell Reference Layer support** — Apple still preserves the single-canvas model; arrives in a future Phase.
- **Per-layer "include in export" toggle** — Reference is unconditionally excluded.
- **Reference Window ↔ Reference Layer cross-conversion** — independent features. A future "promote Reference Window to Reference Layer" action is possible but not in v1.
- **Drag-and-drop creating a Reference Layer** — drop continues to create Reference Window per PRD-053. Promote-from-window action is the planned bridge if/when demand emerges.
- **Clipboard paste import (for Reference Layer)** — kept symmetric with Reference Window, which already has paste deferred (`tasks/todo.md` Review backlog). Both gain paste together later.
- **Multi-touch pinch-to-scale on the placement overlay** — would conflict with the existing canvas-zoom pinch gesture. All v1 placement edits go through 1-pointer drag, keyboard nudge, or "Restore original size".
- **Global "hide all Reference Layers" toggle** — per-layer visibility is sufficient for v1. Revisit if "preview without references" becomes a frequent ask.
- **Duplicate-import dedup** — importing the same file twice produces two independent Reference Layers. No content-hash dedup in v1.
- **Multi-layer selection / multi-select operations** — Timeline Panel operates on one active layer at a time, consistent with PRD-086.
- **Crop / mask within a Reference Layer** — placement is full-source + position + uniform scale only. No region selection inside the reference.
- **Image format support extensions** — supported set is whatever `decode-reference-blob.ts` already accepts.
- **Source-image cache compaction / mipmaps** — source RGBA stored at native dimensions and resampled at composite time; no LOD pyramid.
- **Reference Layer rotation or non-uniform scale** — v1 placement is position + uniform scale only.
- **Composite caching** — keep PRD-086's "no caching" policy; measure if needed.
- **Deep IndexedDB quota handling (pre-check, usage indicator, in-app cleanup)** — owned by the existing backlog item (`tasks/todo.md` Review backlog). PRD-105 only handles the import-time error toast and rollback.

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
