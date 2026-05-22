---
title: "Reference Layer: singleton fixed-bottom underlay rework"
status: needs-triage
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
- [125 — eyedropper and Canvas Sampling remain Pixel-layer reads](125-reference-layer-eyedropper-and-sampling-try-get-pixel.md)

## User Stories Addressed

- #2, #3, #6, #8, #9, #10, #15, #17, #18, #19.
