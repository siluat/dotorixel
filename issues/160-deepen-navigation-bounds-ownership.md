---
title: "Deepen Navigation Bounds into a single viewport owner"
status: done
created: 2026-06-07
---

## What to build

Make a tab's viewport the single owner of **Navigation Bounds** (defined in CONTEXT.md)
so that *every* viewport mutation is clamped to the same reachable region — the union of
the canvas rectangle and, when the active Layer is a Reference Layer, its visible underlay
footprint.

Today the clamp is applied inconsistently per trigger: panning and the post-document-change
reclamp are content-aware, but zooming does not clamp at all, zoom-fit centers on the canvas
only, and a viewport-size change never reclamps. A leftover canvas-only reclamp on the
viewport module has no production callers. With an oversized Reference Layer active, the
canvas can drift out of reach via zoom or resize in ways panning already prevents.

After this change, navigation-bounds clamping lives at one sink inside the per-tab viewport
module, fed by an injected "current navigation bounds" reader. `TabState` stops owning the
clamp orchestration and only supplies the projection-coupled active-Reference footprint. The
pure bounds computation (canvas ∪ footprint) becomes a standalone, directly-tested function.
The Reference footprint enters as an input, so the later reference-geometry consolidation
(architecture review candidate #4) can swap its source without touching this module.

Scope:

- Web-shell only; no Rust core or Apple changes (the core `clamp_pan_to_document_bounds`
  op is reused as-is).
- Extract a pure `navigationBounds(canvas, referenceFootprint | null)` function with its
  own unit tests.
- Route pan, zoom, zoom-fit, grid toggle, viewport set, viewport-resize, and the
  post-document-change reclamp through one clamp; remove the canvas-only reclamp.
- Preserve the "only re-apply when pan actually moves" guard, so a viewport-size change
  marks the tab dirty only when the clamp truly relocates pan (persisted state changed).
- Do not clamp the viewport adopted at construction (a restored snapshot is taken as-is);
  it self-corrects on the first real viewport-size measurement.
- Behavior change (intended, already decided): zoom, zoom-fit, and resize now respect the
  Reference footprint, matching panning.

## Acceptance criteria

- `navigationBounds` returns canvas-only bounds when no footprint; the union when the
  footprint extends beyond the canvas; canvas bounds when the footprint is inside it.
- With a Reference Layer active whose footprint exceeds the canvas, zoom, zoom-fit, and
  viewport-resize all clamp pan to the expanded region (not just panning).
- Leaving the Reference Layer reclamps pan back to the canvas region.
- A viewport-size change that does not move pan does not mark the tab dirty; one that
  relocates pan does.
- No production code path uses a canvas-only reclamp.
- `svelte-check` clean; workspace + reference-images suites pass; new pure-function and
  viewport-module tests cover the above; the two TabState navigation-bounds integration
  tests shrink to thin guards.

## Blocked by

None — can start immediately. (Architecture review candidate #4, reference-geometry
consolidation, is a follow-up enabled by the footprint-as-input seam, not a prerequisite.)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/navigation-bounds.ts` | New pure `navigationBounds(canvas, footprint \| null)` → canvas ∪ footprint; framework-free, directly tested |
| `src/lib/canvas/editor-session/tab-viewport.svelte.ts` | Single clamp sink: `apply` clamps, `reclamp` is nav-bounds + pan-moved guard, `setViewportSize` triggers reclamp; canvas-only reclamp removed; footprint reader injected |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Dropped clamp orchestration (3 methods); supplies projection-coupled `#activeReferenceFootprint()` only |
| `src/routes/editor/+page.svelte` | `untrack` the viewport-size sync effect to break an infinite update loop |
| tests | `navigation-bounds` (3 cases); rewritten `tab-viewport` suite (footprint clamp / reclamp guard / construction adopted as-is); TabState integration tests shrunk to thin guards |

### Key Decisions

- **footprint reader injection** over a "navigation bounds reader": `TabViewport` takes `() => footprint | null` and computes `navigationBounds` itself, so `TabState` supplies only the projection-coupled footprint and the reference-geometry consolidation seam stays open.
- **Intended behavior change**: zoom, zoom-fit, and viewport-resize now respect the Reference footprint, matching panning.
- **Construction adopted as-is**: a restored viewport snapshot is not clamped at construction; it self-corrects on the first viewport-size measurement.
- **Type dedup**: unified the anonymous `CanvasDimensions` shape; kept `NavigationBounds` / `ReferenceLayerUnderlayBounds` / `DocumentRect` separate (distinct domain meanings, cross-module decoupling).

### Notes

- **Infinite-loop fix (dev/prod gap)**: routing `setViewportSize` through `reclamp` made it read and write viewport state, turning the DOM-measurement `$effect` that calls it into an infinite update loop — the exact failure that had deferred the earlier attempt (see db5eabc). Fixed with `untrack`. Not unit-testable (Svelte effect reactivity); covered indirectly by the e2e editor specs, with no dedicated regression guard.
- `clampPan` (canvas-only) is now unused in production but kept on the `ViewportOps` interface — tests still use it to compute canvas-only expected values.
- Verified: `svelte-check` clean · unit 1352 passed · e2e 86 passed.
