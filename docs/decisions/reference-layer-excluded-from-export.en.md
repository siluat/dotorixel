# Reference Layer is persisted in Document but excluded from exports

## Status

Accepted (2026-05-16)

## Context

Reference Layer is a new Layer variant introduced in PRD-105. It admits a decoded source image into the Document layer stack so the user can trace over it while drawing. Two questions follow:

1. Does it belong to the Document the user persists and reloads?
2. Does it appear in the rendered/exported output the user shares (PNG, SVG, saved-work thumbnails)?

The two answers are independent and the natural choice is not the same on both.

PRD-053 (Floating reference window) carved out the role split between Reference Window and Reference Layer, stating that Reference Layer "will live inside the layer system and be part of the document". The natural implication at that time was that, being part of the document, the reference would also travel with exports — the same way every other layer does.

User intent during PRD-105 grilling contradicted that implication: a Reference Layer is a *tracing aid*, not artwork. Including the reference image in exports would defeat its purpose — the user wants the result, not the input. At the same time, Reference Layer must survive reload, tab switching, and undo/redo (it is a Document construct, not an ephemeral overlay like Reference Window). Persistence in Document is therefore required, but export inclusion is not.

PRD-053 already noted the worry of "leak[ing] references when documents are shared or exported" (in the context of rejecting Document-scoped persistence for Reference Window). The same worry now applies to Reference Layer — but is solved at the composite layer rather than by avoiding Document scope.

## Decision

Reference Layer is persisted in the Document layer stack and participates in the on-screen composite, **but is excluded from exports**.

To make this work:

- The Rust core exposes **two composite paths**:
  - `composite()` — every visible layer, used for on-screen rendering.
  - `composite_for_export()` — only Pixel Layers, used by PNG export, SVG export, and the saved-work thumbnail.
- The TS/Svelte export flow calls `composite_for_export()` everywhere the purpose is export, never `composite()`.
- The V4 schema persists Reference Layers as a discriminated-union variant so they round-trip through save/load.

The split is established at the composite level, not at the call site. A future caller cannot accidentally export the wrong composite by forgetting a flag — the export-only composite simply does not contain Reference Layer pixels.

## Considered Alternatives

### Alternative A: Reference Layer is a workspace overlay, not part of Document

Treat Reference Layer like Reference Window — workspace-scoped, not in the Document.

**Rejected because**: persistence is required. Tracing is a long-running activity that survives reloads and tab switches, and the user expects undo/redo over placement changes. A workspace overlay loses all of those properties.

### Alternative B: include Reference Layer in exports, gate by a per-layer "exported" flag

Reference Layer ships with `exported: false` by default; the user can opt-in.

**Rejected because**: opt-in is a footgun (forget to disable → reference image in shipped artwork). The default already matches the user's intent. The flag concept also leaks into Pixel Layer for no real reason, complicating the schema for a constraint only one variant needs.

### Alternative C: Reference Layer visibility doubles as export inclusion

If the reference is visible during edit, it ships in the export.

**Rejected because**: the user wants the reference visible *while* tracing. The whole point is to see it while drawing the artwork. Conflating "visible during edit" with "included in export" forces the user to toggle visibility off before every export — error-prone and disruptive to the tracing workflow.

### Alternative D: keep one composite path, filter the result post-hoc at each export call site

`encode_png` reads `composite()` then masks out Reference Layer pixels after blending.

**Rejected because**: post-hoc masking is incorrect under alpha compositing. A partly transparent Pixel Layer on top of a Reference Layer would already have mixed reference pixels into its blended output; removing them after the fact cannot recover the underlying Pixel-only result. The split must happen *during* composition, not after.

## Consequences

### Benefits

- The user's tracing workflow works out of the box — they can keep the reference visible while drawing and the final export is clean.
- Persistence guarantees the reference survives reload, tab switch, and history navigation.
- The split is encoded in two pure composite functions, both testable as unit tests against fixture documents.
- The export composite is decoupled from any per-layer flag, so future Reference Layer changes (e.g., new Reference data variants) inherit the exclusion automatically.

### Trade-offs

- Two composite paths in the Rust core. The duplication is mild — both reuse the same source-over blend kernel; the difference is purely which layer kinds the iterator yields.
- The implication in PRD-053 ("Reference Layer will be part of the document") that exports would also include the reference is now overridden. PRD-053 should be read against this ADR.
- A user might be surprised that a visible Reference Layer is not in the PNG. The Timeline Panel kind icon and (future) export-preview UI mitigate this; revisit if confusion is reported.

### Follow-up triggers

- If the user reports wanting to publish the reference *with* the artwork (e.g., for a tutorial GIF), revisit by adding a per-layer "in export" toggle rather than promoting the variant — default still off.
- The next time the Apple shell migrates to Document/Layer, propagate the two-composite split unchanged.
- If a third Layer variant arrives, the composite-iteration rule generalizes naturally — Pixel-only or kind-aware predicates per composite path.
