# Progress

## Currently Working On

Floating reference image windows ([PRD 053](../issues/053-floating-reference-window.md))

## Last Completed

Reference images — drag-and-drop import — new `canvasDropzone` Svelte action wires `dragenter/over/leave/drop` and toggles `data-drag-over` for a CSS-only highlight ring; modal/sheet drop targets reuse the existing validator and call back via `onFilesDropped` (gallery only, no floating window); editor canvas drop adds files to the gallery AND auto-displays each as a floating window via `store.display()` with cascading offsets (`index × CASCADE_OFFSET`) clamped to the viewport so the title bar stays on-screen; new pure helpers `compute-drop-placement` (drop-centered, viewport-clamped) and shared `compute-window-size` keep drop placement / initial placement sizing in lockstep; `import-reference-files` runs sequential validation+decode, returning `{refs, errors}` so partial batches still import valid files and surface per-file rejections; `CASCADE_OFFSET` centralized to `reference-window-constants` (gallery cascade + canvas cascade share one constant); E2E covers canvas vs modal disambiguation, multi-file cascade (24 px stagger), validation rejection, drag-then-reload restoration (waits on IndexedDB autosave), and tab isolation ([issue](../issues/062-reference-images-drag-drop-import.md))

## Next Up

- [079 — Reference images: long-press sampling loupe](../issues/079-reference-images-long-press-loupe.md)
  - Sibling slice of PRD 053. Builds on 061; visual parity with canvas Eyedropper loupe.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Independent. Can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Same PRD as 018. Can start independently.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
