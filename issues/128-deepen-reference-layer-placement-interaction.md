---
title: "Deepen Reference Layer Placement Interaction"
status: done
created: 2026-05-25
---

## What to build

Extract Reference Layer Placement Interaction from `PixelCanvasView` into a dedicated web-shell interaction Module that owns draft placement, drag/nudge updates, cancel, and commit semantics while leaving DOM pointer capture and gesture forwarding in the canvas view.

Scope:

- Keep work web-shell only; no Rust core or Apple changes.
- Preserve existing Reference Layer Placement behavior for body drag, corner scale, keyboard nudging, Escape/pointer cancel, touch forwarding, panning/pinch forwarding, and Eyedropper forwarding.
- Add the domain term **Reference Layer Placement Interaction** to `CONTEXT.md`.
- Keep `ReferenceLayerPlacementOverlay` as the visual hit target; do not merge rendering and interaction.

## Acceptance Criteria

- `PixelCanvasView` no longer owns Reference Layer Placement draft/drag geometry state.
- A dedicated interaction Module owns draft placement, active drag state, nudge accumulation, cancel, and commit semantics.
- Existing placement overlay and canvas view behavior remains unchanged.
- Tests cover body move, corner scale, min projected-size clamp, keyboard nudge accumulation, committed-placement reconciliation, and touch drag forwarding handoff.
- Domain vocabulary names Reference Layer Placement Interaction explicitly.

## Results

| File | Description |
|------|-------------|
| `CONTEXT.md` | Added the Reference Layer Placement Interaction domain term and clarified its relationship to Reference Layer Placement and Reference Layer Underlay. |
| `src/lib/canvas/reference-layer-placement-interaction.svelte.ts` | Added the web-shell interaction Module for draft placement, drag state, nudge accumulation, cancellation, and commit semantics. |
| `src/lib/canvas/reference-layer-placement-interaction.svelte.test.ts` | Covered body movement, corner scaling, min projected-size clamping, keyboard nudge accumulation, committed-placement reconciliation, and touch drag forwarding handoff. |
| `src/lib/canvas/PixelCanvasView.svelte` | Delegated placement lifecycle state and geometry updates to the interaction Module while retaining DOM pointer capture and canvas gesture forwarding. |

### Key Decisions

- Chose a Svelte rune Module over a pure TypeScript reducer so draft placement and drag state stay reactive while moving ownership out of the canvas view.
- Kept DOM event translation, pointer capture, canvas pan/pinch forwarding, and Eyedropper forwarding in `PixelCanvasView` so the interaction Module remains focused on placement semantics.
- Preserved `ReferenceLayerPlacementOverlay` as the visual hit target instead of merging rendering and interaction responsibilities.

### Notes

- `docs/platform-status.md` is unchanged because this refactor does not alter cross-platform feature status or user-facing behavior.
- The completed task was created from an architecture deepening session rather than an existing `tasks/todo.md` item, so there was no todo row to remove.
