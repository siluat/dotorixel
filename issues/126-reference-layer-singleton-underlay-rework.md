---
title: "Reference Layer: singleton fixed-bottom underlay rework"
status: done
created: 2026-05-22
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Rework the already-landed Reference Layer foundation to match the amended PRD: Reference is a singleton fixed-bottom original-image underlay, not a reorderable layer that participates in `Document.composite()`.

This issue must land before the user-facing import flow in 118.

Scope:

- Rust Document:
  - enforce at most one Reference Layer per Document;
  - expose set/replace singleton Reference image semantics;
  - keep Reference fixed below all Pixel Layers;
  - reject/no-op reorder attempts that would move Reference or move Pixel Layers below it;
  - make `Document.composite()` Pixel-only;
  - keep `composite_for_export()` Pixel-only or collapse it to an explicit alias if that is cleaner;
  - keep placement, visibility, delete, and active selection semantics needed by the Timeline/overlay.
- Renderer/session bridge:
  - expose enough Reference source + placement data for the web shell to draw the original image as a viewport underlay;
  - ensure render invalidation updates both underlay and Pixel composite when Reference placement/visibility changes;
  - do not depend on Reference pixels existing in `Document.composite()`.
- Persistence:
  - normalize V4 storage/hydration to at most one Reference Layer;
  - preserve the Reference source blob, natural dimensions, placement, visibility, and name;
  - keep Reference fixed bottom-most after hydrate.
- Tests:
  - replace old "Reference contributes to composite" tests with "Reference absent from composite";
  - assert singleton replacement rather than append;
  - assert fixed-bottom order and reorder constraints;
  - assert export/thumbnail remain Pixel-only;
  - assert existing V3 documents still migrate as Pixel-only.

## Acceptance Criteria

- Repeated set/import operations cannot produce two Reference Layers in one Document.
- Replacing Reference updates source/name/natural dimensions and resets placement to auto-fit.
- `Document.composite()` returns the same pixels with or without a visible Reference Layer.
- Export and saved-work thumbnail pixels are unchanged by Reference visibility.
- Pixel Layer reorder cannot place any Pixel Layer below Reference.
- Reference row/order data exposed to the shell is always bottom-most.
- The web renderer has a distinct underlay draw path for the original Reference image.
- Existing Pixel Layer behavior and persistence are unchanged.
- Regression tests cover singleton, fixed-bottom, Pixel-only composite, and hydrate/dehydrate normalization.

## Blocked By

None — this is the correction slice unblocking amended PRD-105.

## Blocks

- [118 — Timeline Panel set/replace Reference image import flow](118-reference-layer-timeline-panel-add-icon-and-import-flow.md)
- [120 — placement overlay shell](120-reference-layer-placement-overlay-shell.md)
- [124 — drawing tools no-op + cursor](124-reference-layer-drawing-tools-no-op-and-cursor.md)
- [125 — eyedropper and Canvas Sampling sample active layers explicitly](125-reference-layer-eyedropper-and-sampling-try-get-pixel.md)

## User Stories Addressed

- #2, #3, #6, #8, #9, #10, #15, #17, #18, #19.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | Reworked Reference Layer as a singleton fixed-bottom underlay, normalized hydrated stacks, made `Document.composite()` Pixel-only, and locked reorder behavior around the Reference underlay. |
| `crates/core/src/canvas.rs`, `crates/core/src/export.rs`, `crates/core/src/history.rs`, `crates/core/src/layer.rs`, `crates/core/src/pixel_perfect.rs`, `crates/core/src/reference_placement.rs`, `crates/core/src/reference_sampler.rs`, `crates/core/src/tool.rs` | Applied rustfmt cleanup required for `cargo fmt --check -p dotorixel-core`. |
| `wasm/src/lib.rs` | Updated WASM contract docs and tests for singleton bottom Reference semantics and Pixel-only composite buffers. |
| `src/lib/canvas/renderer.ts`, `src/lib/canvas/renderer.test.ts`, `src/lib/canvas/PixelCanvasView.svelte`, `src/routes/editor/+page.svelte` | Added a distinct original-image Reference underlay render path below the Pixel composite. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts`, `src/lib/canvas/editor-session/editor-controller.svelte.ts`, `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | Exposed renderer-facing Reference underlay data, committed Reference placement changes with undo/dirty/render invalidation, and guarded Reference reorder no-ops. |
| `src/lib/session/session-storage-types.ts`, `src/lib/session/session-storage.ts`, `src/lib/session/session-storage-types.test.ts`, `src/lib/session/session-persistence.test.ts`, `src/lib/canvas/document-hydration.test.ts` | Normalized V4 persistence and hydration to one bottom-most Reference Layer while preserving source data and placement. |
| `src/lib/ui-editor/TimelinePanel.svelte`, `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Removed the reorder affordance from Reference rows while preserving Pixel Layer reorder controls. |
| `src/lib/canvas/canvas-model.ts`, `CONTEXT.md`, `docs/platform-status.md` | Updated public contracts and domain/platform docs to describe Reference as a singleton viewport underlay outside document-pixel buffers. |

### Key Decisions

- Kept the newest persisted Reference Layer when normalizing invalid multi-Reference stacks so replacement semantics are deterministic.
- Collapsed `composite_for_export()` to an explicit alias of Pixel-only `composite()` because Reference pixels no longer enter document-pixel buffers.
- Drew Reference with the original source RGBA in the shell renderer instead of rasterizing it through the Rust composite path.

### Notes

- The parent PRD remains open; import UI, placement overlay interaction, drawing cursor feedback, and sampling no-op follow-ups are separate remaining slices.
