---
title: Reference images — drag-and-drop import
status: open
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
