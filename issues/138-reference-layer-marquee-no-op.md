---
title: "Reference Layer × Marquee — visual preserved, all operations no-op"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

When the active layer is a Reference Layer, the Marquee remains visually unchanged (marching-ants still rendered) but every Selection operation silently no-ops — matching PRD-105's drawing-tool contract.

Scope:

- **`SelectionOverlay.svelte`**: continue rendering marching ants regardless of active-layer kind. No change in opacity or styling between Pixel-active and Reference-active.
- **Selection stroke session** (`tools/selection-tool.ts`): when `host.document.layer_kind_at(active_index) === 'reference'`, the session's `draw()` / `end()` callbacks no-op without firing journal intents or render invalidation.
- **Keyboard input**: Escape, Delete, arrows, Cmd+C/V/X (introduced in 136/142/143/146/148) check active-layer kind before dispatching. Reference-active = silent no-op.
- **Document Change Journal**: every Selection-related intent (`set-marquee`, `clear-marquee-pixels`, `commit-floating-selection`, `paste-clipboard`) checks `layer_kind_at(active_index)` in its `will-change` phase and returns `changed: false` when Reference-active.

Implementation notes:

- PRD-105 already established the cursor-`not-allowed` treatment for drawing tools on Reference. Selection inherits the same cursor behavior automatically via the existing `isDrawingTool` check.
- The Marquee being visible while Reference is active is intentional UX — switching back to a Pixel Layer immediately resumes the workflow.

Tests:

- Selection stroke session test: drag with Reference active produces no journal intent, no Marquee state change.
- Journal test: every Selection intent on a Reference-Layer-active Document is a no-op (no snapshot, no dirty notification, no render invalidation).
- Visual test: `SelectionOverlay` renders identically whether the active layer is Pixel or Reference.

## Acceptance criteria

- Marching-ants Marquee renders unchanged when the active layer is a Reference Layer.
- Selection stroke session no-ops on Reference-active without journal intents.
- Every Selection-related Document Change Journal intent no-ops on Reference-active with `changed: false`.
- Cursor treatment matches PRD-105 (`not-allowed` on desktop).
- Switching the active layer back to a Pixel Layer immediately resumes Selection operations on the preserved Marquee.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/tools/selection-tool.ts` | Selection strokes now silently no-op while the active layer is Reference, preserving the existing Marquee. |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Marquee mutations are rejected in the will-change phase unless the active layer is Pixel. |
| `src/lib/canvas/PixelCanvasView.svelte.test.ts` | Locks in that the Marquee overlay geometry stays unchanged when Reference is active. |
| `src/lib/canvas/tools/selection-tool.test.ts` | Covers Reference-active Selection drag no-op behavior. |
| `src/lib/canvas/editor-session/document-change-journal.test.ts` | Covers Reference-active Marquee define and clear no-op behavior. |

### Key Decisions

- Kept the visual Marquee path independent from active-layer kind, while blocking mutations at both the Selection stroke boundary and the Document Change Journal boundary.
- Centralized active-layer-kind lookup in the journal so existing and future Marquee mutation intents can share the same guard.

### Notes

- Cmd+C/X/V, arrow nudge, and Floating Selection intents are still pending in later Selection sub-issues; their Reference-active no-op checks should be added with those handlers.
