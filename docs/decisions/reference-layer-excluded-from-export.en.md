# Reference Layer is a persisted underlay but excluded from pixel outputs

## Status

Accepted (2026-05-16)

Amended (2026-05-22): Reference Layer is rendered as a viewport underlay, not through `Document.composite()`.

## Context

Reference Layer is introduced in PRD-105. It lets the user keep a tracing reference with the Document so the reference survives reload, tab switching, and undo/redo.

Two questions are separate:

1. Does the reference belong to the persisted Document?
2. Does the reference become part of artwork pixels, exports, or saved-work thumbnails?

The answer to the first is yes: tracing setup is long-running state. The answer to the second is no: the reference is input, not artwork.

The original version of this ADR solved export exclusion by adding two Rust composite paths: an on-screen composite that included Reference Layers and an export composite that excluded them. That was technically coherent, but it violated the later clarified product expectation: the Reference Layer should display the original image as-is behind the pixel canvas, not be resampled into the document pixel buffer.

## Decision

Reference Layer is persisted with the Document and is visible in the editor, but it is not part of any document pixel output.

To make this work:

- The web renderer draws the Reference Layer source image as a viewport underlay using its placement.
- The renderer then draws the Pixel Layer composite over that underlay.
- `Document.composite()` returns Pixel Layers only.
- `composite_for_export()` may remain as an explicit export path, but it is also Pixel-only.
- PNG export, SVG export, and saved-work thumbnails never include Reference pixels.
- V4 persistence stores the singleton Reference Layer data so it round-trips through save/load.

The split is now at the render-path level, not only the composite-function level. Reference is Document state for editing, but it is not document-pixel state.

## Considered Alternatives

### Alternative A: Reference Layer is a workspace overlay, not part of Document

Treat Reference Layer like Reference Window: workspace-scoped and not persisted with the Document.

**Rejected because**: persistence is required. Tracing is a long-running activity that survives reloads and tab switches, and placement changes should participate in undo/redo.

### Alternative B: include Reference Layer in exports

Reference is visible while editing and ships in PNG/SVG/thumbnails.

**Rejected because**: a Reference Layer is a tracing aid, not artwork. Including it in exports would leak the input image into the user's output.

### Alternative C: Reference Layer participates in `Document.composite()`, export uses `composite_for_export()`

Blend Reference into the on-screen document RGBA buffer, but keep exports Pixel-only.

**Rejected because**: this resamples the original source image into the document's pixel grid before it reaches the viewport. On small pixel canvases, the reference becomes visibly pixelated/downsampled. The user's expectation is an original-image underlay behind the pixel art, not a sampled layer inside the artwork buffer.

### Alternative D: keep one composite path, filter Reference pixels at export call sites

`encode_png` reads a mixed composite and tries to remove Reference pixels afterward.

**Rejected because**: post-hoc masking is incorrect under alpha compositing. A partly transparent Pixel Layer over a Reference Layer would already have mixed reference colors into the blended output.

## Consequences

### Benefits

- The editor displays the original reference image rather than a pixel-grid resample.
- Export and thumbnail paths stay clean because Reference pixels never enter artwork pixel buffers.
- Persistence still gives the user durable tracing setup.
- The render contract is easier to reason about: Reference underlay first, Pixel composite second.

### Trade-offs

- On-screen rendering needs one additional shell-level draw step before the Pixel composite.
- Existing Rust composite work that included Reference Layers must be reworked or removed.
- Tests must distinguish viewport rendering from document-pixel composition.

### Follow-up Triggers

- If users ask to publish a reference together with artwork, revisit with an explicit export option. Default remains off.
- Reference color sampling must continue to use explicit source-image sampling paths rather than `Document.composite()`.
- When the Apple shell adopts Document/Layer, port the same underlay-first render contract instead of a Reference-in-composite path.
