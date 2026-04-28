# Progress

## Currently Working On

Floating reference image windows ([PRD 053](../issues/053-floating-reference-window.md))

## Last Completed

Reference images — Eyedropper sampling — new `sample-pixel.ts` (pure `(DecodedImage, x, y) → Color`), `window-to-image-coords.ts` (floor-then-clamp coord mapping defends trailing edge off-by-one), and `sampler.ts` (thin async wrapper: `createImageBitmap` → `OffscreenCanvas.getImageData`, stateless, throws on decode failure with `bitmap.close()` in `finally`); `TabState.sampleReferencePixel(blob, x, y)` async method routes through the existing `#applyEffects` dispatcher emitting `colorPick(foreground) + addRecentColor` for opaque samples (transparent and decode failure are silent); `EditorController.handleSampleReference` fire-and-forget delegate; `ReferenceWindow` adds optional `onSamplePixelAt(imageX, imageY)` prop with `<img>`-element `onpointerdown` so the letterbox region naturally falls through to z-order activation; `ReferenceWindowOverlay` adds `onSamplePixel(blob, imageX, imageY)` and pass-through is conditional so non-eyedropper tools see no behavior change; `+page.svelte` wires both mount sites with `editor.activeTool === 'eyedropper' ? editor.handleSampleReference : undefined`. Naming chain `samplePixel` → `sampleReferencePixel` → `handleSampleReference` → `onSamplePixel` → `onSamplePixelAt` keeps the action traceable across layers ([issue](../issues/060-reference-images-eyedropper-sampling.md))

## Next Up

- [061 — Reference images: long-press sampling](../issues/061-reference-images-long-press-sampling.md)
  - Sibling slice of PRD 053. Builds on 060 (Eyedropper) for touch entry.
- [062 — Reference images: drag-drop import](../issues/062-reference-images-drag-drop-import.md)
  - Sibling slice of PRD 053. Independent of 060/061.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Independent. Can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Same PRD as 018. Can start independently.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
