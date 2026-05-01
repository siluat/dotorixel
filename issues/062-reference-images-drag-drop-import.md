---
title: Reference images — drag-and-drop import
status: done
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Accept image files dropped directly onto the editor, with drop-target disambiguation between the References modal (add to gallery only) and the editor canvas area (add to gallery AND auto-display at drop coordinates).

- **Modal drop target** — the modal's empty state and gallery grid accept drops; dropped files run through the same validator from #055 and are added to the gallery only. No floating window appears.
- **Editor canvas drop target** — dropping an image on the editor canvas area imports the file and immediately displays it as a floating window at the drop coordinates (clamped to viewport).
- **Visual affordance** — drop zones highlight on dragenter; clear the highlight on dragleave/drop.
- **Multi-file** — dropping multiple files at once imports each in order; canvas-area multi-drop cascades the resulting windows from the drop point.
- **Reject paths** — invalid MIME / oversize files surface the same messages as the file-picker path; valid files in the same batch still import.

## Acceptance criteria

- Dropping a PNG onto the modal's empty state adds a gallery entry; no floating window appears.
- Dropping a PNG onto the editor canvas area imports it and displays a floating window centered on the drop point.
- Rejected formats and >10 MB files show the existing validation messages.
- Drop zone highlights on dragenter and clears on dragleave/drop.
- Multi-file drop imports all valid files; invalid files in the batch are skipped with messages.
- Canvas drop positions respect the viewport clamp so the title bar remains on-screen.
- E2E: end-to-end flow covering import → display → drag → sample → reload restores state.
- E2E: tab-switching isolation (tab A references do not appear on tab B).
- E2E: drop-target disambiguation (modal drop stays in gallery; canvas drop auto-displays).
- Component tests: modal dropzone adds to gallery only; canvas-area dropzone triggers display callback with drop coords.

## Blocked by

- [056 — Reference images — display on canvas + close](056-reference-images-display-close.md)

## Scenarios addressed

- Scenario 2 (drag PNG onto empty state → gallery entry, no auto-display)
- Scenario 18 (drop onto canvas area → gallery entry AND auto-display at drop coords)

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/canvas-dropzone.ts` | New Svelte action — wires `dragenter/over/leave/drop` on a host element, sets `data-drag-over` for styling, filters non-file drags (`dataTransfer.types` includes `'Files'`), and forwards `(File[], DragEvent)` to `onDrop`. |
| `src/lib/reference-images/canvas-dropzone.test.ts` | Unit tests (5) — non-file drag ignored, single/multi file drop forwarded, `data-drag-over` set/cleared, `preventDefault` on `dragover`. |
| `src/lib/reference-images/compute-window-size.ts` | Extracted from `compute-initial-placement` so drop placement and initial placement share identical sizing math (`min(natural, viewport×0.3)` on longer edge, `MIN_WINDOW_EDGE` floor, viewport upper-bound cap). |
| `src/lib/reference-images/compute-drop-placement.ts` | New pure helper — given drop coords + image natural size + viewport, returns `{x, y, w, h}` centered on the drop point and clamped so the title bar stays on-screen. |
| `src/lib/reference-images/compute-drop-placement.test.ts` | Unit tests (5) — center-on-drop, viewport clamping (left/right/top/bottom edges), large image downscale. |
| `src/lib/reference-images/import-reference-files.ts` | Sequential import helper — loops files in batch order, validates via existing `validateReferenceFile`, returns `{ refs, errors }` so caller can both display imported gallery entries and surface per-file rejections. |
| `src/lib/reference-images/import-reference-files.test.ts` | Unit tests (2) — preserves input order on success; partial batch keeps valid imports and reports rejections. |
| `src/lib/reference-images/reference-window-constants.ts` | Added `CASCADE_OFFSET = 24` so the staircase magnitude is shared between gallery cascade (`computeInitialPlacement`) and canvas multi-drop cascade (`+page.svelte`). |
| `src/lib/reference-images/compute-initial-placement.ts` | Refactored to import shared `CASCADE_OFFSET` (removed local duplicate). |
| `src/lib/reference-images/ReferenceBrowser.svelte` | Added drop-target on the dialog body — visible highlight ring on dragenter, validates dropped files, emits `onFilesDropped(refs)` so the parent can refresh gallery state. |
| `src/lib/reference-images/ReferenceBrowser.svelte.test.ts` | Component tests (4) — modal drop adds gallery entries, no floating window callback fired, multi-file partial-batch surfaces rejections, dragenter highlight class applied. |
| `src/lib/reference-images/ReferenceBrowserSheet.svelte` | Mirror of the modal change for compact/medium breakpoints. |
| `src/routes/editor/+page.svelte` | `handleCanvasDrop` — imports + calls `store.display()` for each ref with cascading drop coords (`index × CASCADE_OFFSET`); `handleReferenceModalDrop` — imports only; `canvasDropzone` action attached to `.canvas-area`; scoped CSS overlay uses `:global(.canvas-area[data-drag-over='true']::after)` (Svelte's scoped CSS doesn't track imperatively-set attributes). |
| `e2e/editor/reference-images.test.ts` | E2E tests (6) — canvas drop displays + adds to gallery; modal drop adds gallery only; multi-file canvas drop cascades by 24px; SVG rejected with validation alert; dragged window position survives reload (waits for IndexedDB autosave); references stay on tab A when switching to tab B. |

### Key Decisions

- **Action over component overlay** for the canvas dropzone — keeps the `.canvas-area` as the single pointer-event owner (no `<div>` overlay competing for events with the existing pan/draw bindings) and lets the highlight be pure CSS via `data-drag-over`.
- **Sequential file imports** preserve input order without rate-limiting concerns (decode is per-image; nothing benefits from parallelism here, and serial keeps cascade indexing straightforward).
- **`CASCADE_OFFSET` centralized** to `reference-window-constants.ts` — both the gallery sequential-open cascade and the canvas multi-drop cascade now diverge only when intentionally; one constant change updates both surfaces.
- **`.overlay .window` E2E selector** — the rendered class is `.window` inside `.overlay`; scoping under `.overlay` avoids collisions with any unrelated `.window` element while staying behavior-focused (the fact that it's *a window in the overlay* is the spec, not the file name).
- **Direct `PointerEvent` dispatch in the reload test** — Playwright's `page.mouse.move/down/up` translates to mouse events, and the synthesized pointer events lose `setPointerCapture` between batches when the title bar shifts under the cursor; firing `PointerEvent` instances with a fixed `pointerId` against the title bar element gives a stable target across the drag.

### Notes

- **Drop handler duplication** between `ReferenceBrowser.svelte` and `ReferenceBrowserSheet.svelte` (~30 lines each) — left as-is rather than extracting a shared module. Right-sized: the duplication is small, the two components already mirror each other across the breakpoints, and a premature extraction would obscure the per-component event wiring. Revisit if either side gains independent complexity.
- **`:global` CSS for the dragover overlay** — documented inline with a WHY comment because Svelte's scoped CSS only tracks attributes present in markup at compile time, and `data-drag-over` is set imperatively by the `canvasDropzone` action.
- **Reload-restoration test debounces** on the workspace autosave (polls IndexedDB until the dragged position is persisted, then a small 200ms cushion) — without this the snapshot can predate the drag commit.
