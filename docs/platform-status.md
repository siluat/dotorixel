# Platform Status

Feature implementation status across Core (Rust), Web (SvelteKit + Canvas2D), and Apple (SwiftUI + Metal).

**Legend**: ✅ Done | 🔧 Partial | ⬜ Not done | — N/A

## Drawing Tools

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pencil | ✅ | ✅ | ✅ | |
| Eraser | ✅ | ✅ | ✅ | |
| Line | ✅ | ✅ | ⬜ | Snapshot-restore preview |
| Rectangle | ✅ | ✅ | ⬜ | Outline only, snapshot-restore preview |
| Ellipse | ✅ | ✅ | ⬜ | Outline only, snapshot-restore preview |
| Flood fill | ✅ | ✅ | ⬜ | BFS, 4-connectivity |
| Eyedropper | — | ✅ | ⬜ | Read-only, skips transparent pixels |
| Stroke interpolation | ✅ | ✅ | ✅ | Bresenham algorithm |

## Canvas

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Create / resize | ✅ | ✅ | ✅ | 1–256px, presets available |
| Clear | ✅ | ⬜ | ⬜ | Core API ready, no UI |

## History

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Undo / redo | ✅ | ✅ | ✅ | Snapshot-based |

## Viewport

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Zoom | ✅ | ✅ | ✅ | Discrete levels + continuous |
| Pan | ✅ | ✅ | ✅ | |
| Fit to viewport | ✅ | ✅ | ✅ | |

## Color

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Color model (RGBA) | ✅ | ✅ | ✅ | Hex conversion in Core + Web |
| HSV conversion | — | ✅ | ⬜ | `rgbToHsv()` / `hsvToRgb()` |
| Color picker | — | ✅ | ✅ | Web: custom HSV picker, Apple: SwiftUI |
| Preset palette | — | ✅ | ✅ | 18 Pebble colors |
| Recent colors | — | ✅ | ⬜ | Last 12 used |
| FG/BG color swap | — | ✅ | ⬜ | Swap button in both Pixel and Pebble UI |

## Rendering

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pixel rendering | — | ✅ | ✅ | Canvas2D / Metal |
| Checkerboard transparency | — | ✅ | ✅ | |
| Grid overlay + toggle | — | ✅ | ✅ | Auto-hidden below 4px |

## Export

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| PNG | ✅ | ✅ | 🔧 | Apple: core ready, UI disabled |

## Input

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Mouse / trackpad | — | ✅ | ✅ | |
| Touch | — | ✅ | ✅ | Pointer Events / UITouch |
| Apple Pencil | — | — | ✅ | |
| Keyboard shortcuts | — | ✅ | ✅ | Undo/redo only |

## UI

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pebble UI theme | — | ✅ | ✅ | Floating panels, earth tones |
