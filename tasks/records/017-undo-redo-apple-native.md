# 017 — Undo/redo — connected to core history module, SwiftUI toolbar integration

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/EditorState.swift` | Added `historyVersion`, `canUndo`/`canRedo`, `handleUndo`/`handleRedo`, `handleDrawStart`/`handleDrawEnd`; made `isDrawing` `private(set)` |
| `apple/Dotorixel/Views/TopControlsLeft.swift` | Wired undo/redo buttons to `EditorState`, added `.disabled` binding and keyboard shortcuts (Cmd+Z, Cmd+Shift+Z) |
| `apple/Dotorixel/Views/TopControlsRight.swift` | Removed manual `.opacity(0.4)` from disabled buttons (now handled by PebbleButtonStyle) |
| `apple/Dotorixel/Style/PebbleButtonStyle.swift` | Added `@Environment(\.isEnabled)` to auto-apply `.opacity(0.4)` on disabled state |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | Coordinator now calls `handleDrawStart()`/`handleDrawEnd()` instead of directly setting `isDrawing`/`pushSnapshot` |
| `apple/Dotorixel/DotorixelApp.swift` | Disabled system Edit > Undo/Redo menu via `CommandGroup(replacing: .undoRedo)` |

### Key Decisions

- `historyVersion` counter pattern to trigger SwiftUI re-evaluation of `canUndo`/`canRedo` — `@Observable` cannot detect UniFFI object internal state changes
- `try?` on `restorePixels` — core guarantees valid snapshots, failure is structurally impossible
