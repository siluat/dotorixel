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
| Move | — | ✅ | ⬜ | Drag to reposition canvas content, snapshot-restore preview, `move` cursor |
| Right-click background color | — | ✅ | ⬜ | All tools draw with BG color on right-click; eraser unchanged |
| Stroke interpolation | ✅ | ✅ | ✅ | Bresenham algorithm |

## Canvas

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Create / resize | ✅ | ✅ | ✅ | 1–256px, presets available, 9-position anchor selector (Web) |
| Clear | ✅ | ✅ | ⬜ | RightPanel (docked) + Settings tab (mobile) |

## History

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Undo / redo | ✅ | ✅ | ✅ | Snapshot-based, dimension-aware (resize undoable on Web) |

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
| FG/BG color swap | — | ✅ | ⬜ | Swap button + per-swatch color picker |

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
| Touch | — | ✅ | ✅ | Pointer Events / UITouch; Web: pinch-zoom + two-finger pan + touch deferral + long-press eyedropper |
| Apple Pencil | — | — | ✅ | |
| Keyboard shortcuts | — | ✅ | ✅ | Web: tool switch (P/E/L/U/O/F/I/V) + grid toggle (G) + undo/redo (Ctrl+Z/Y) + Alt eyedropper + Space pan + X swap colors + Shift constrain + `/` shortcut hints; Apple: undo/redo only |

## i18n

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Internationalization | — | ✅ | ⬜ | Paraglide.js, URL path routing (`/en/`, `/ko/`, `/ja/`) |

## Analytics

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Page view tracking | — | ✅ | — | Umami Cloud, auto SPA tracking |
| Custom event tracking | — | ✅ | — | Tool usage, canvas resize, export, session duration |
| CSP headers | — | ✅ | — | Vercel response headers |

## Multi-image Workflow

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Tab management (Workspace) | — | 🔧 | ⬜ | Model + page wiring done; TabStrip UI pending |

## UI

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Design token system | — | ✅ | ⬜ | `--ds-*` tokens, light + dark theme definitions |
| Pebble UI theme | — | ✅ | ✅ | Floating panels, earth tones (legacy) |
| Editor UI theme | — | ✅ | ⬜ | `--ds-*` tokens, docked panel (≥1024px) + tab navigation (<1024px) |
| Responsive layout | — | ✅ | ⬜ | 4 breakpoints: compact/medium/wide/x-wide via matchMedia + CSS Grid/Flex |
| Toolbar tooltip | — | ✅ | ⬜ | Custom styled tooltip on hover (tool name + shortcut badge), Svelte action, GeistPixel-Square font |
| Tab bar slide indicator | — | ✅ | ⬜ | ease-in-out-cubic 180ms, pure CSS `--active-index` |
| Landing page | — | ✅ | — | Hero section + CTA, i18n, `--ds-*` tokens |
| Safe area handling | — | ✅ | ⬜ | `viewport-fit=cover` + `env(safe-area-inset-*)` on all routes |
