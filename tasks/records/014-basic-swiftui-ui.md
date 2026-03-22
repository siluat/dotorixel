# 014 — Basic SwiftUI UI — tool selection, color picker, canvas view

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Style/DesignTokens.swift` | Pebble UI design tokens (colors, spacing, sizing) matching `pebble-tokens.css` |
| `apple/Dotorixel/Style/FloatingPanel.swift` | Pill-shaped translucent panel container |
| `apple/Dotorixel/Style/PebbleButtonStyle.swift` | 40×40 rounded icon button with acorn brown active state |
| `apple/Dotorixel/Data/DefaultPalette.swift` | Pebble 2×9 preset palette (18 colors) matching `pebble-palette-data.ts` |
| `apple/Dotorixel/Extensions/Color+SwiftUI.swift` | UniFFI `Color` ↔ `SwiftUI.Color` conversion helpers |
| `apple/Dotorixel/State/EditorState.swift` | `@Observable` editor state wrapping UniFFI objects |
| `apple/Dotorixel/Views/TopControlsLeft.swift` | Floating panel: Undo/Redo (disabled), Grid toggle |
| `apple/Dotorixel/Views/TopControlsRight.swift` | Floating panel: canvas presets, W×H inputs, Export/Clear (disabled) |
| `apple/Dotorixel/Views/BottomToolsPanel.swift` | Floating panel: Pencil/Eraser toggle, Zoom controls (disabled) |
| `apple/Dotorixel/Views/BottomColorPalette.swift` | Floating panel: active swatch, 2×9 palette grid, native ColorPicker |
| `apple/Dotorixel/Views/PebbleSwatch.swift` | Rounded color swatch with selection outline |
| `apple/Dotorixel/ContentView.swift` | Full-screen canvas + floating overlay panels (ZStack layout) |
| `apple/Dotorixel/DotorixelApp.swift` | macOS `.defaultSize(960×640)` |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | `canvasVersion` parameter, Pebble grid color `#E0DCD7` |
| `apple/Dotorixel/Rendering/PixelGridRenderer.swift` | Clear color updated to Pebble background `#EFECE8` |
| `apple/project.yml` | Unchanged from original (font entries added then removed during review) |
| `CLAUDE.md` | Styling section updated: Pebble UI theme, visual parity guidance |

### Key Decisions

- Pebble UI over Pixel UI — matches the web's current default editor interface (`/pebble` route)
- Full-screen canvas + floating overlays (ZStack) — direct port of the web's absolute-positioned floating panels, natural fit for SwiftUI
- `fitToViewport` with `displayScale` — Metal renderer uses `drawableSize` (device pixels), so viewport math needs scale-adjusted dimensions for correct centering

### Notes

- Undo/Redo, Zoom, Clear, Export buttons are present but disabled — functionality is in separate follow-up tasks
- Canvas centering uses `fitToViewport` which adjusts both zoom and pan; future zoom/pan task may need to revisit initial viewport setup
