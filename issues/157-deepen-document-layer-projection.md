---
title: "Deepen Document Layer Projection"
status: done
created: 2026-06-06
---

## What to build

Extract the web shell's Document Layer read model into a dedicated projection module so rendering, timeline UI, sampling, and Document Change Journal callers share one layer traversal contract.

Scope:

- Keep the work web-shell only; do not move projection ownership into Rust core.
- Include Reference Layer Underlay projection and source RGBA cache ownership in the same projection module.
- Keep snapshot serialization and codec work out of scope.
- Preserve existing Reference Layer visibility, sampling, fit-to-canvas, navigation bounds, and layer reorder behavior.
- Update domain vocabulary so "Document Layer Projection" is distinct from UI views and generic helpers.

## Results

| File | Description |
|------|-------------|
| `CONTEXT.md` | Added the Document Layer Projection domain term and relationship to Document, Layer, and Reference Layer Underlay. |
| `src/lib/canvas/document-layer-projection.ts` | Added a stateful web-shell projection that reads layer stack order, panel order, active layer facts, stack index lookups, and visible Reference Layer Underlay in one contract. |
| `src/lib/canvas/document-layer-projection.test.ts` | Covered stack/panel order, active layer facts, hidden/no Reference states, and Reference source cache reuse/clearing. |
| `src/lib/canvas/reference-layer-underlay.ts` | Reduced the module to the Reference Layer Underlay data contract and geometry helpers. |
| `src/lib/canvas/reference-layer-underlay.test.ts` | Kept geometry helper coverage after moving Document traversal coverage to the projection tests. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Delegated Reference-active sampling, Reference navigation bounds, fit-to-canvas stack lookup, and public underlay reads to the Document Layer Projection. |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Reused the projection for layer kind, stack index, active layer, and reorder-boundary decisions. |
| `src/lib/canvas/editor-session/document-change-journal.test.ts` | Added a test projection adapter for Journal tests with partial fake Documents. |
| `src/routes/editor/+page.svelte` | Reused the projection for active layer state, Reference Layer active checks, Timeline rows, and Reference Layer existence checks. |

### Key Decisions

- Chose a web-shell module instead of Rust core because the projection is a shell-facing read model and owns a tab-local source RGBA cache.
- Included Reference Layer Underlay projection because render, sampling, navigation, and timeline callers need the same layer traversal facts.
- Kept snapshot serialization out of scope so persistence continues to read raw Document state directly.

### Notes

- This architecture deepening did not originate from a `tasks/todo.md` row, so there is no todo item to remove.
- `docs/platform-status.md` is unchanged because this refactor does not alter cross-platform feature status or user-facing behavior.
