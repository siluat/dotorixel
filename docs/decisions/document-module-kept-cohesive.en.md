# Document is kept as one cohesive core module, not split by concern

## Status

Accepted (2026-06-14)

## Context

An `/improve-codebase-architecture` review flagged `crates/core/src/document.rs` as a 3,297-LOC "god-module" and proposed splitting its public interface into separate `LayerStack` / `ActiveLayerOps` / `DocumentCompositing` types.

On inspection, the line count is misleading:

- **~962 LOC is implementation; ~2,335 LOC is inline tests** (107 test functions; `#[cfg(test)]` begins at line 963).
- The implementation is a cohesive ~960-line module: 7 cohesive fields (`width`, `height`, `layers`, `active_layer_id`, `marquee`, `next_layer_number`, `timeline_panel_collapsed`) and ~42 load-bearing public methods.
- Transforms are already factored — `flip_horizontal`/`flip_vertical` share `flip_active_pixel_layer` via `fn`-pointer parameterization; `rotate_*` split into `rotate_active_marquee` / `rotate_whole_document`; Marquee-region transforms reuse `selection.rs` primitives (`lift_region` / `clear_region` / `composite_region`).

## Decision

Keep `Document` as one cohesive module. Do not split its public interface by concern.

The framing that motivated the split does not hold:

- **The file size is dominated by tests, not implementation sprawl.** Thorough coverage (107 tests) is a health signal. Future reviews must measure *implementation* LOC (exclude `#[cfg(test)]`) before calling a module oversized.
- **Depth is a property of the interface, and the interface is fixed by the binding boundary.** The WASM binding exposes `Document` to the web as a single object; the entire web consumer base (`TabState`, `DocumentChangeJournal`, `document-layer-projection`, `FloatingSelectionLifecycle`) calls it as `document.X`. A public 3-type split would ripple across every call site for **zero interface-depth gain** — an internal-only split leaves the interface (and therefore the depth) unchanged.
- **The implementation is already cohesively organized**, and the granular `layer_*_at(index)` accessors are a deliberate performance choice (read one layer's buffer without materializing all layers), not interface bloat.

## Considered Alternatives

### Alternative A: Split the public interface into LayerStack / ActiveLayerOps / DocumentCompositing

**Rejected because**: `Document` crosses the WASM/TS boundary as one object. Splitting the public type ripples through every web call site, and because depth is an interface property, an internal-only reorganization would not deepen the module at all.

### Alternative B: Extract internal seams (private submodules `Document` delegates to) for implementation locality

**Rejected for now**: the implementation is only ~960 lines and already cohesive; the most plausible target (transforms) is already cleanly factored. The marginal locality gain does not justify the churn. This is the first tool to reach for **if** the implementation later grows past a genuinely unnavigable size.

## Consequences

### Benefits

- Future architecture reviews stop re-suggesting a `document.rs` split on line count alone.
- The single-object `Document` contract at the binding boundary stays simple for every web consumer.

### Follow-up Triggers

- Revisit if the **implementation** (excluding tests) grows past a genuinely unnavigable size, the binding boundary stops treating `Document` as a single object, or Apple's eventual Document/Layer migration introduces real cross-concern entanglement. The first tool then is an internal-seam extraction, not a public-interface split.
- Independent of this decision: if the ~2,335-LOC inline test module becomes hard to navigate, splitting it into per-concern test files is a test-organization choice, not an architecture change.
