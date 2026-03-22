# 016 — Zoom/pan — pinch gesture (iPadOS), scroll/trackpad (macOS), shared viewport transform from core

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/EditorState.swift` | Added `viewportSize`, `zoomPercent`, `handleViewportChange`, `handleZoomIn/Out/Reset`, `handleFit` |
| `apple/Dotorixel/Rendering/InputMTKView.swift` | Extended `CanvasInputDelegate` with macOS-only `scrollWheelChanged`/`magnifyChanged`; added `scrollWheel`/`magnify` overrides |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | Coordinator: macOS scroll/magnify delegate, iPadOS pinch/pan gesture recognizers and handlers; `isMultipleTouchEnabled = true` |
| `apple/Dotorixel/Views/BottomToolsPanel.swift` | Zoom buttons enabled, dynamic zoom % label, tap-to-fit |
| `apple/Dotorixel/ContentView.swift` | `fitCanvas` stores `viewportSize` in `editorState` |

### Key Decisions

- macOS uses delegate protocol extension (`scrollWheelChanged`/`magnifyChanged`) because `scrollWheel`/`magnify` are NSResponder overrides in InputMTKView
- iPadOS uses `UIPinchGestureRecognizer` + `UIPanGestureRecognizer` targeting Coordinator directly — no delegate extension needed
- `cancelsTouchesInView = true` on both gesture recognizers — pinch/pan start cancels ongoing drawing via `touchesCancelled`

### Notes

- `deltaY == 0` guard added for discrete mouse wheel to prevent unintended zoom from horizontal-only scroll events
- iPadOS two-finger pan is difficult to test in Simulator; real device testing recommended
