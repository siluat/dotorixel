# 015 — Touch/Pencil input — Apple Pencil drawing on iPadOS, mouse drawing on macOS

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/EditorState.swift` | Added `historyManager` (let) and `isDrawing` (var) properties |
| `apple/Dotorixel/Rendering/InputMTKView.swift` | New — `CanvasInputDelegate` protocol + `InputMTKView` (MTKView subclass with macOS mouse / iPadOS touch event handling) |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | Coordinator extended with `CanvasInputDelegate` (coordinate conversion, Bresenham interpolation, tool application); `editorState` prop added; switched from `MTKView` to `InputMTKView` |
| `apple/Dotorixel/ContentView.swift` | Pass `editorState` to `PixelCanvasView` |
| `apple/Dotorixel.xcodeproj/project.pbxproj` | Added `InputMTKView.swift` file reference |

### Key Decisions

- MTKView subclass over SwiftUI gestures — native event handlers provide view-local coordinates, Apple Pencil type detection, and higher sampling frequency than `DragGesture`
- `isFlipped = true` on macOS — unifies coordinate origin to top-left across platforms, eliminating Y-axis conversion branches
- `triggerRedraw` increments `canvasVersion` instead of calling `setNeedsDisplay` directly — ensures SwiftUI's `update*View` pipeline runs `configureRenderer` with fresh pixel data before Metal draws

### Notes

- Interaction state (`isInteracting`, `lastPixel`) lives in Coordinator, not `EditorState` — frame-rate input state shouldn't trigger SwiftUI view diffs
- `isMultipleTouchEnabled = false` on iPadOS — multi-touch is deferred to the zoom/pan task
