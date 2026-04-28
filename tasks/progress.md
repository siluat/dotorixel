# Progress

## Currently Working On

Floating reference image windows ([PRD 053](../issues/053-floating-reference-window.md))

## Last Completed

Reference images — long-press + drag color sampling — new framework-agnostic `long-press` gesture detector in `src/lib/gestures/` (single-pointer tracking, 400 ms threshold, 8 px Euclidean radius, lifecycle `pointerDown → onFire → onMove → onEnd` plus pre-fire `onCancel` for early release / out-of-radius / cancel); `TabState.sampleReferenceCommit` (renamed from `sampleReferencePixel`) and new `sampleReferencePreview` share `#refSampleSeq` to discard stale async samples; `EditorController` adds `handleReferenceSampleStart/Move/End` thin delegates (Start/Move → preview, End → commit + recentColors); `ReferenceWindow` branches on `pointerType === 'touch' || 'pen'` to the detector path with `setPointerCapture`, mouse keeps the immediate path from #060, short tap on touch/pen routes through `onCancel` → `onSamplePixelAt` (eyedropper-only), `$effect` cleanup disposes the detector, `.image` gets `touch-action: none`; `ReferenceWindowOverlay` passes the three new callbacks through (prepending `ref.blob`); `+page.svelte` wires long-press handlers unconditionally (tool-independent), `onSamplePixel` stays gated on `activeTool === 'eyedropper'` ([issue](../issues/061-reference-images-long-press-sampling.md))

## Next Up

- [062 — Reference images: drag-drop import](../issues/062-reference-images-drag-drop-import.md)
  - Sibling slice of PRD 053. Independent of 060/061.
- [079 — Reference images: long-press sampling loupe](../issues/079-reference-images-long-press-loupe.md)
  - Sibling slice of PRD 053. Builds on 061; visual parity with canvas Eyedropper loupe.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Independent. Can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Same PRD as 018. Can start independently.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
