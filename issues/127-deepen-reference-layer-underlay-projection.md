---
title: "Deepen Reference Layer Underlay projection"
status: done
created: 2026-05-25
---

## What to build

Extract the web shell's Reference Layer Underlay projection from `TabState` and colocate the shared renderer, placement overlay, and sampling coordinate interpretation in one canvas module.

Scope:

- Keep the work web-shell only; do not move projection or renderer cache ownership into Rust core.
- Let the new module own source RGBA projection caching for a tab, but keep renderer raster caching and persistence blob ownership where they already live.
- Preserve the existing no-underlay behavior as `undefined`.
- Keep source sampling, renderer rect projection, placement overlay rect projection, and navigation bounds derived from the same placement contract.
- Update domain vocabulary so "Reference Layer Underlay" is explicit and distinct from UI overlays and Reference Window images.

## Acceptance Criteria

- `TabState` no longer contains the Reference Layer source-copy cache or repeated projection assembly.
- Renderer, placement overlay, and Reference-active sampling depend on the same Reference Layer Underlay contract.
- Source-coordinate sampling and viewport/document rect projection keep existing behavior.
- Tests cover projection, cache reuse, missing/hidden Reference states, source-coordinate mapping, and rectangle/bounds helpers.
- Public naming consistently uses Reference Layer Underlay vocabulary.

## Results

| File | Description |
|------|-------------|
| `CONTEXT.md` | Added the Reference Layer Underlay domain term and relationship to Reference Layer Placement. |
| `src/lib/canvas/reference-layer-underlay.ts` | Added the web-shell projection module, per-tab source cache, coordinate mapping, rect projection, and bounds helpers. |
| `src/lib/canvas/reference-layer-underlay.test.ts` | Covered visible/hidden/no Reference projections, cache reuse, source-coordinate mapping, rect projection, and bounds helpers. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Delegated underlay projection, Reference-active sampling target mapping, and Reference navigation bounds to the new module. |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts`, `src/routes/editor/+page.svelte` | Propagated the Reference Layer Underlay getter naming through the editor boundary. |
| `src/lib/canvas/renderer.ts`, `src/lib/canvas/renderer.test.ts` | Consumed the shared underlay contract and rect projection while retaining renderer-owned raster caching. |
| `src/lib/canvas/ReferenceLayerPlacementOverlay.svelte`, `src/lib/canvas/ReferenceLayerPlacementOverlay.svelte.test.ts` | Reused the shared viewport rect projection and renamed props to the Reference Layer Underlay vocabulary. |
| `src/lib/canvas/PixelCanvasView.svelte`, `src/lib/canvas/PixelCanvasView.svelte.test.ts` | Aligned canvas view props, draft placement preview, and tests with the Reference Layer Underlay vocabulary. |
| `src/lib/canvas/sampling/adapters/reference-layer-underlay.ts`, `src/lib/canvas/sampling/adapters/reference-layer-underlay.test.ts` | Renamed the sampling adapter and kept source-image grid reads on the shared underlay contract. |

### Key Decisions

- Chose a web-shell module instead of Rust core because this projection is shell-facing and coordinates renderer, overlay, and sampling consumers.
- Kept raster cache ownership in the renderer and persistence blob ownership in `TabState`; the new projector only owns source RGBA projection caching.
- Used document-projection-first naming so non-renderer consumers can share the same contract without importing renderer types.

### Notes

- `docs/platform-status.md` is unchanged because this refactor does not alter cross-platform feature status or user-facing behavior.
- The completed task was created from an architecture deepening session rather than an existing `tasks/todo.md` item, so there was no todo row to remove.
