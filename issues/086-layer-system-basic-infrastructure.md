---
title: "Layer system: basic infrastructure (add/delete/reorder)"
status: done
created: 2026-05-06
---

## Problem Statement

DOTORIXEL users can only draw on a single flat canvas. This creates three concrete limitations:

1. **No editing reversibility on the surface itself.** Once a pixel is drawn it overwrites the same plane, so common workflows like "keep the outline, change only the fill" become impossible.
2. **No structural slot for the upcoming Reference Layer.** The domain glossary already defines Layer as the umbrella term, but the implementation is still a flat canvas — there is nowhere natural to admit a Reference Layer variant.
3. **The animation milestone is blocked.** M4's frame/animation features must stack on top of layers. With today's flat model, M4 has no entry point.

## Solution

Replace the Rust core's single `PixelCanvas` with a **Document → Layer stack** runtime model. A Document owns the canvas dimensions, the layer stack, and the active-layer pointer; it exposes composite, resize, history, and structural mutation as first-class operations.

### Key changes

- **Data model**: single pixel buffer → Document containing N layers
- **Drawing**: applied only to the active layer
- **Rendering**: `Document.composite()` returns the source-over composited RGBA buffer
- **History**: single-canvas snapshot → whole-document snapshot
- **Persistence**: V2 single canvas → V3 Document (with migration)
- **UI**: a unified Timeline Panel docked below the canvas (Layer × Frame grid; in M3 the frame axis is one column or hidden, and grows naturally in M4). Collapsible.

This PRD changes **the web shell only**. The Apple shell preserves the single `PixelCanvas` / `HistoryManager` interface — a separate ADR records the reasoning.

## Key Scenarios

1. When the user opens a new document → "Layer 1" is auto-created and set as the active layer.
2. When the user draws with the Pencil tool → pixels are applied only to the active layer.
3. When the user clicks "add layer" in the Layer panel → "Layer 2" is inserted directly above the active layer and becomes the new active.
4. When the user deletes a layer → that layer is removed and an adjacent layer becomes active. If only one layer remains, the request is rejected with `RemoveLastLayer`.
5. When the user reorders a layer (drag or up/down buttons) → the composite reflects the new depth order immediately.
6. When the user undoes after a draw → the previous snapshot's full layer stack is restored (both structural and pixel changes).
7. When the user toggles a layer's visibility off → the layer is excluded from the composite.
8. When the user adds a layer, draws, then refreshes the page → the next session restores the same Document state (V3 persistence).
9. When an existing V2 user opens the page → the single canvas is auto-migrated to a V3 Document with one "Layer 1" (no pixel loss; history is reset).
10. When the user clicks the chevron at the bottom of the canvas → the TimelinePanel collapses (h=180 → h=32). Click again to expand. The state persists per document.
11. When a mobile user taps the 4th tab ("Timeline") → the layer interface appears. Switching to another tab implicitly closes it (the tab itself is the toggle).
12. When the user clicks a non-active row in the TimelinePanel sidebar → that layer becomes the active layer; subsequent drawing tool actions apply to it. (Selection is not undoable — see sub-issue 104.)
13. Apple shell users are unaffected by this PRD — Apple keeps the existing single `PixelCanvas` + `HistoryManager` interface.

## Implementation Decisions

### Document runtime model (Rust core)

Add a new module `crates/core/src/document.rs` with a `Document` type:

- Fields: canvas dimensions, layer stack, active layer ID, `nextLayerNumber` counter, `timelinePanelCollapsed` flag.
- Methods:
  - `add_layer()` — insert a new layer directly above the active one and set the new layer active.
  - `remove_layer(layer_id)` — delete by UUID. Returns `LayerError::RemoveLastLayer` if it would empty the stack.
  - `reorder_layer(layer_id, new_index)` — move within the stack.
  - `set_active_layer(layer_id)` — change the active pointer.
  - `composite() -> Vec<u8>` — RGBA row-major buffer (no caching).
  - `resize(width, height, anchor)` — apply the same anchor policy to every layer.
  - The previous `PixelCanvas` operations (`set_pixel`, `flood_fill`, …) are exposed on Document and delegate to the active layer.

### Layer type (Rust core)

Add a new module `crates/core/src/layer.rs` with a `Layer` type:

- Fields: `id: Uuid`, `name: String`, `pixels: PixelCanvas` (reused), `visible: bool`, `opacity: f32`.
- Layer is a flat type at M3. When Reference Layer arrives, it becomes an umbrella enum and the present variant is renamed Pixel Layer. This PRD keeps the flat shape; the enum transition belongs to a follow-up PRD.

### Composite

- Source-over (Normal alpha-over). Algorithm: alpha-composite from the bottom layer upward.
- Layers with `visible == false` are skipped.
- `opacity` multiplies into the layer alpha.
- No caching at M3 — every frame composites N layers.
- Performance trigger: measure after M3 ships; if needed, introduce a "above-active / below-active" two-group cache as a follow-up issue.

### History update

Extend `Snapshot` in `crates/core/src/history.rs` from a single canvas pixel buffer to a **full Document snapshot**:

- The snapshot includes the entire layer stack and `nextLayerNumber`.
- `push_snapshot` captures the whole Document.
- `undo` / `redo` restore the whole Document (structural + pixel changes alike).
- `DEFAULT_MAX_SNAPSHOTS=100` is preserved.

### Identifiers

- Layer IDs are UUID v4 generated on the TS side via `crypto.randomUUID()` and passed into Rust.
- Rationale: avoids adding a UUID-generation dependency to the Rust core, and keeps the same pattern available for Apple later (Foundation's `UUID`).

### Default layer name

- Pattern: `"Layer N"` (en) / `"레이어 N"` (ko) / `"レイヤー N"` (ja) — driven by Paraglide messages.
- N comes from the monotonic counter `nextLayerNumber` stored on the Document.
- The counter is never decremented on delete — e.g. "Layer 1, 2, 3" → delete 2 → next add becomes "Layer 4".
- A new Document is created with one "Layer 1" and `nextLayerNumber=2`.
- V2 → V3 migration produces "Layer 1" and `nextLayerNumber=2`.

### WASM facade

Add a `Document` binding in `wasm/`. The interface mirrors a single canvas in shape (`composite()` → an ImageData-compatible RGBA buffer). The existing `PixelCanvas` binding is preserved per the public-API decision recorded in the ADR.

### Persistence (V2 → V3 migration)

- Add `DocumentSchemaV3` in `src/lib/session/session-storage-types.ts`.
- V3 is at the Document level: dimensions + layers (each with id/name/pixels/visible/opacity) + activeLayerId + nextLayerNumber + timelinePanelCollapsed.
- Migration: wrap V2's single pixel buffer as a single layer inside V3 (no pixel loss; dimensions preserved).
- History is dropped during migration — V2 history is in single-canvas shape and is incompatible with the Document shape. The session starts with an empty history immediately after migration.
- The `viewports` field on workspace records and other persistence shapes are unchanged.
- **Wiring scope** — declaring the schema is not enough. The read/write path must also be on V3: `SessionStorage`'s `DocumentRecord` / `StoredDocument` / `getAllSavedDocuments`, IndexedDB `DB_VERSION` upgrade with a V2→V3 cursor migration, `tab-state.toSnapshot()` serializing per-layer pixels + per-layer metadata + activeLayerId + nextLayerNumber + timelinePanelCollapsed, and hydration building the multi-layer document via `WasmDocumentBuilder`. Owned by sub-issue **103**.

### TabState integration

- Replace `pixelCanvas: PixelCanvas` in `src/lib/canvas/editor-session/tab-state.svelte.ts` with `document: Document`.
- `samplingSession`, `toolRunner`, and `tabViewport` operate via the active layer (interfaces change minimally).
- `documentId` is preserved.
- **Document is the sole source of truth** — the transitional `pixelCanvas` field that mirrors the active layer is removed in this PRD, not left to evolve organically. The main canvas renderer receives the RGBA buffer returned by `document.composite()` (all visible layers, source-over from the bottom up), not just the active layer's pixels. Tools mutate the active layer through `document.set_pixel` / `document.apply_tool` / `document.flood_fill`. Owned by sub-issue **102**.

### UI: unified Timeline Panel

- Add a new `TimelinePanel.svelte` docked below the canvas.
- Structure: a left-side layer sidebar (each row: visibility toggle + name + delete + reorder handles) and a right-side frame area (one column or hidden in M3; expanded in M4).
- Collapsible: a chevron in the top-right toggles between expanded (h=180) and collapsed (h=32).
- Default: expanded.
- Persistence: `timelinePanelCollapsed: boolean` on Document, included in the V3 schema.
- Mobile: the 4th tab ("Timeline") is the entry point — the tab itself is the toggle, with no separate collapse control.
- Pixel-level visual design is split out as a follow-up design task. This PRD only fixes the placement and structural decision. The follow-up design task should reference the comparison area in the `.pen` file (container ID `sTEPj`) when detailing Candidate A as the full design.

### Apple shell impact

- **This PRD makes no changes to the Apple shell.** Apple is currently mid-Phase-1 catchup; the layout is designed on top of a single-canvas assumption. A separate ADR (`docs/decisions/web-document-layer-apple-preserved.en.md`) records the split decision.
- The point at which Apple migrates to Document/Layer is a Phase 2 or separate PRD decision.

### Core placement rationale

`Document` / `Layer` / `composite` satisfy the Core Placement criteria:

- A complex algorithm (source-over composition; deep-cloning history snapshots) lives in one authoritative place.
- The model is stable today but is also where future evolution (Reference Layer, Cel model) will originate.
- Both shells will eventually share the model — the M3 web/Apple split is an Apple-Phase-1 timing decision, not a permanent fork.

## Testing Decisions

Test principle: verify external behavior only, not implementation details.

### Strongly recommended

- **Rust `Document` add/delete/reorder** — inline unit tests in `crates/core/src/document.rs`.
  - Verify: the at-least-one-layer invariant (`RemoveLastLayer` error), UUID identity, reorder index integrity, active-pointer relocation on delete.
  - Prior art: inline tests for `set_pixel`, `flood_fill`, `resize_with_anchor` in `crates/core/src/canvas.rs`.
- **Rust source-over composite** — `composite()` known-input/known-output pixel comparisons.
  - Verify: transparent/opaque boundaries, opacity, visibility off.
- **TS V2 → V3 migration** — Vitest unit in `src/lib/session/`.
  - Verify: no pixel loss, dimensions preserved, single-layer wrap, `nextLayerNumber=2`.

### Recommended

- **Rust `nextLayerNumber` counter** — monotonic, never reused after delete.
- **Rust `HistoryManager` Document snapshot** — extend the existing `history.rs` tests.
  - Prior art: existing push/undo/redo sequence patterns in `crates/core/src/history.rs`.
- **TS Document × TabState integration** — Vitest unit in `tab-state.svelte.ts`.
- **E2E** — one Playwright flow covering "add layer → draw → save → reload" end-to-end (regression defense around M3 release).

### Lightly recommended

- **WASM facade binding** — a Rust unit smoke test verifying that the bound methods can be called.

### Deferred

- **TimelinePanel component tests** — added once the pixel-level design is finalized in the follow-up design task.

## Rejected Alternatives

### Migrate the Apple shell to Document/Layer in this PRD

Update both shells in the same PRD.

**Rejected because**: Apple is in the middle of Phase 1 catchup, with the structural transition from Pebble UI to docked layout still in flight. Changing the data model at the same time blurs Apple Phase 1's priority and increases PR-merge risk. Apple also has no UI (LayerPanel, TimelinePanel) to surface a layer system yet, so adding the data model alone would be dead code. Recorded in a separate ADR; revisit in Phase 2 or a separate PRD.

### Candidate B (RightPanel section + 4th tab on mobile, layer-only)

Fits the existing docked layout naturally, but when M4's unified timeline arrives, the RightPanel Layers section and the mobile Layers tab would have to be retired. With M4 already on the near roadmap, the build-then-retire cost is higher than building the unified shape from the start.

### Candidate C (LayerPanel docked below the canvas, layer-only)

Position is M4-friendly, but a layer-only panel without a frame axis at M3 still pays a transformation cost to add the frame axis at M4. With M4 close, building the unified-timeline shape from the start is the cleaner path. The collapsible idea from C is absorbed into Candidate A.

### Composite caching at M3

A two-group cache split by "above active / below active". **Rejected**: at canvas max 256×256 and typical layer counts this is an unmeasured optimization and over-engineering. Measure after M3 ships; if needed, introduce as a follow-up issue.

### Derive next layer number by parsing names (max + 1)

No counter on Document; instead parse numbers from existing layer names and pick max + 1.

**Rejected because**: as soon as the user renames "Layer 2" → "Hair", "Skin", … (rename arrives in a follow-up), parsing breaks and the counter degrades. An explicit `nextLayerNumber` field is safer.

### Cel model (Aseprite-style)

Layer + per-frame Cel separation.

**Rejected because**: the Frame concept does not exist at M3, and a single pixel buffer per Layer is sufficient. When Frame arrives in M4, revisit Cel as the natural data-model evolution.

## Out of Scope

- **Layer rename** — M3 covers add/delete/reorder only; rename is a follow-up issue.
- **Layer opacity slider UI** — the data model carries an `opacity` field, but only the visibility toggle is exposed in the M3 UI; the slider is a follow-up.
- **Layer groups / folders** — not in M3 scope; revisit later.
- **Composite caching** — none in M3; introduce after measurement.
- **Apple shell Document/Layer migration** — Phase 2 or a separate PRD.
- **Reference Layer / Pixel Layer split (umbrella enum transition)** — separate PRD ("Reference Layer type" todo).
- **Cel model (per-frame layer content)** — revisit at M4.
- **TimelinePanel pixel-level design** — follow-up design task.
- **Frame axis UI activation** — M4. M3 either renders one frame column or hides it.
- **`HistoryManager` memory measurement / compression** — keep the current policy; measurement is a follow-up.

## Follow-up sub-issues (post-decomposition gaps)

The initial decomposition (087–101) covered the data model, history, design, and the first add-layer slice, but several implementation paths required to make layers user-visible, selectable, and durable were not assigned to a sub-issue:

- **102 — Render path: switch main canvas to `document.composite()`**. With only 094 in place, the renderer still reads `tab-state.pixelCanvas` (a mirror of the active layer), so additional layers exist in the document but never appear on screen. Without 102, the composite results from 095/096/097 cannot be visually verified.
- **103 — V3 multi-layer pixel persistence wiring**. `DocumentSchemaV3` and `migrateV2ToV3` are declared in `session-storage-types.ts`, but `SessionStorage` and `tab-state.toSnapshot()` are still on V2 — refreshing the page collapses every multi-layer document back to a single layer and discards every layer's name, visibility, opacity, and id. Required before any M3 release that exposes the layer system to users.
- **104 — Activate layer on row click**. The Rust core and WASM facade already expose `set_active_layer` (087, 089), but no sub-issue surfaces it as a UI affordance. Without 104 the user can only draw on whichever layer is left active by automatic transitions (add / delete) — a usability blocker once the stack has more than one layer. Build before 095 / 096 / 097 so those slices know to `stopPropagation` on their nested per-row buttons.

All three are blockers for the rest of PRD-086 to be more than data-model bookkeeping.

## Further Notes

- The Document/Layer domain terms were already added to `CONTEXT.md` during the grill phase. If new terms are needed during PRD adoption, extend `CONTEXT.md` incrementally.
- The comparison area in the `.pen` file (container ID `sTEPj`, position `x=-430, y=28063`) is preserved as a visual record of the adoption decision. The follow-up design task should treat it as the reference when detailing Candidate A.
- A companion ADR has been written: `docs/decisions/web-document-layer-apple-preserved.en.md` (rationale for the web/Apple split).
- Existing modules likely impacted (concrete file paths are confirmed at implementation time):
  - Existing files: `crates/core/src/canvas.rs`, `crates/core/src/history.rs`, `wasm/`, `src/lib/canvas/canvas-model.ts`, `src/lib/canvas/editor-session/tab-state.svelte.ts`, `src/lib/canvas/tool-runner.svelte.ts`, `src/lib/canvas/renderer.ts`, `src/lib/session/session-storage-types.ts`, `src/lib/canvas/workspace-snapshot.ts`, `src/lib/ui-editor/RightPanel.svelte`, `src/routes/editor/+page.svelte`
  - New files: `crates/core/src/document.rs`, `crates/core/src/layer.rs`, `src/lib/ui-editor/TimelinePanel.svelte` (or equivalent location)
