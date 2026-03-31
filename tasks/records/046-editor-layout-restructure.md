# 046 — Editor layout restructure

## Plan

Transition the editor (`/editor`) from a single floating panel layout to a responsive layout defined in the pen file design (task 042). This is a prerequisite for follow-up tasks (touch target 44px, safe area, pinch zoom).

**Key finding:** The screen inventory (task 040) described the medium tier as "floating panel", but the actual pen file design (task 042) established tab navigation for all <1024px. Since the pen file is the authoritative source, implement **two layout paradigms**.

### Layout paradigms

#### >=1024px — Docked panel (CSS Grid)

```text
[TopBar                                    ]
[LeftToolbar | Canvas         | RightPanel ]
[StatusBar                                 ]
```

| Element | wide (1024-1439px) | x-wide (1440px+) |
|---------|-------------------|-------------------|
| TopBar height | 44px | 48px |
| TopBar padding | [0, 16] | [0, 16] |
| LeftToolbar width | 44px | 48px |
| LeftToolbar padding/gap | [6, 0] / gap 2 | [8, 0] / gap 4 |
| RightPanel width | 200px | 240px |
| RightPanel padding/gap | 10 / gap 12 | 12 / gap 16 |
| StatusBar height | 28px | 28px |
| StatusBar padding | [0, 12] | [0, 12] |

#### <1024px — Tab navigation

```text
[AppBar       ]
[Content Area ] <- Draw: canvas / Colors: color picker / Settings: settings
[ToolStrip    ] <- Draw tab only
[ColorBar     ] <- Draw tab only
[TabBar       ]
```

| Element | compact (<600px) | medium (600-1023px) |
|---------|-----------------|---------------------|
| AppBar height | 44px | 48px |
| AppBar content (Draw tab) | logo + export + grid | logo + zoom controls + grid + export |
| AppBar content (Colors/Settings) | title text heading | title text heading |
| ToolStrip height | 48px | 52px |
| Tool button size | 40x40 (icon 18px) | 44x44 (icon 20px) |
| ToolStrip content | 7 tools + undo | 7 tools + sep + undo + redo |
| ColorBar height | 48px | 52px |
| ColorBar content | FG(32) + 5 swatches(26) | FG+BG(36) + 7 swatches(30) |
| Tab count | 3 (Draw, Colors, Settings) | 3 |

### Implementation approach

- **Svelte `{#if}` structural split**: docked/tab branches split at `layoutMode >= 1024px`
- **CSS Grid**: docked layout grid structure, media queries for wide<->x-wide sizing
- **CSS Flex**: tab layout vertical stack, media queries for compact<->medium sizing
- **`matchMedia`**: JS layout mode detection (`createLayoutMode()` utility)
- **Single EditorState**: shared across all layouts, state preserved on layout switch
- **`100dvh`**: mobile address bar handling (fallback `100vh`)
- **Existing floating panel components**: no longer imported by editor page. Files retained.

### New components (src/lib/ui-editor/)

#### Docked layout (4)

| Component | Role | Key Props |
|-----------|------|-----------|
| `TopBar.svelte` | Top bar: logo + zoom controls(-/label/+/fit) + grid toggle + Export | zoomPercent, showGrid, onZoomIn, onZoomOut, onZoomReset, onFit, onGridToggle, onExport |
| `LeftToolbar.svelte` | Left vertical toolbar (7 tools + separator + undo/redo) | activeTool, canUndo, canRedo, onToolChange, onUndo, onRedo |
| `RightPanel.svelte` | Right panel: Canvas section(presets+size) -> divider -> Color section(FG/BG+hex+palette+recent) | foregroundColor, backgroundColor, recentColors, canvasWidth, canvasHeight, onForegroundColorChange, onBackgroundColorChange, onSwapColors, onResize, onClear |
| `StatusBar.svelte` | Bottom status bar: canvas size("32 x 32") + spacer + active tool name("Pencil") | canvasWidth, canvasHeight, activeTool |

#### Tab layout (6)

| Component | Role | Key Props |
|-----------|------|-----------|
| `AppBar.svelte` | Draw tab header: logo + export + grid (zoom controls added on medium). Colors/Settings tabs: title text heading | activeTab, showGrid, zoomPercent, onGridToggle, onExport, onZoomIn, onZoomOut, onZoomReset |
| `ToolStrip.svelte` | Horizontal tool strip. compact: 7 tools+undo(40x40). medium: 7 tools+sep+undo+redo(44x44) | activeTool, canUndo, canRedo, onToolChange, onUndo, onRedo |
| `ColorBar.svelte` | compact: FG(32x32)+sep+5 swatches(26). medium: FG+BG(36x36)+sep+7 swatches(30) | foregroundColor, backgroundColor, onForegroundColorChange |
| `TabBar.svelte` | Bottom pill tabs (Draw/Colors/Settings) | activeTab, onTabChange |
| `ColorsContent.svelte` | Colors tab full screen: FG/BG + HSV picker + Preset palette | foregroundColor, backgroundColor, onForegroundColorChange, onBackgroundColorChange, onSwapColors |
| `SettingsContent.svelte` | Settings tab full screen: canvas settings + actions(export/clear) + grid | canvasWidth, canvasHeight, showGrid, onResize, onExport, onClear, onGridToggle |

#### Utility (1)

| File | Role |
|------|------|
| `layout-mode.svelte.ts` | `createLayoutMode()` - matchMedia-based responsive layout mode detection |

### Implementation order

1. Layout mode utility (`layout-mode.svelte.ts`)
2. Page shell restructure (`editor/+page.svelte` with `{#if isDocked}` split)
3. Docked layout components + stories (TopBar, LeftToolbar, StatusBar, RightPanel)
4. Tab layout components + stories (AppBar, TabBar, ToolStrip, ColorBar)
5. Tab content + stories (ColorsContent, SettingsContent)
6. Verification across all breakpoints

### Out of scope

- Touch target 44px optimization (separate task)
- Safe area / virtual keyboard (separate task)
- Tool Options section (brush size, opacity - not implemented in EditorState)
- Layers section / tab (M3)
- Dark mode toggle UI

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/layout-mode.svelte.ts` | New: matchMedia-based responsive layout mode detection utility |
| `src/lib/ui-editor/TopBar.svelte` | New: docked layout top bar (logo, zoom controls, grid toggle, export) |
| `src/lib/ui-editor/LeftToolbar.svelte` | New: docked layout vertical toolbar (7 tools + separator + undo/redo) |
| `src/lib/ui-editor/RightPanel.svelte` | New: docked layout right panel (Canvas section + inline HSV picker + palette + recent) |
| `src/lib/ui-editor/StatusBar.svelte` | New: docked layout status bar (canvas size + tool name) |
| `src/lib/ui-editor/AppBar.svelte` | New: tab layout header (Draw: logo+export+grid, Colors/Settings: title heading) |
| `src/lib/ui-editor/ToolStrip.svelte` | New: tab layout horizontal tool strip (compact/medium variants) |
| `src/lib/ui-editor/ColorBar.svelte` | New: tab layout color bar (FG/BG + recent colors) |
| `src/lib/ui-editor/TabBar.svelte` | New: tab layout pill tab navigation (Draw/Colors/Settings) |
| `src/lib/ui-editor/ColorsContent.svelte` | New: Colors tab full-screen content (FG/BG + HSV picker + preset palette) |
| `src/lib/ui-editor/SettingsContent.svelte` | New: Settings tab full-screen content (canvas size + actions + grid toggle) |
| `src/lib/ui-editor/*.stories.svelte` (10) | New: co-located Storybook stories for all new components |
| `src/routes/editor/+page.svelte` | Rewritten: `{#if isDocked}` split, CSS Grid (docked) / Flex (tab) |
| `messages/en.json` | Add 12 new i18n message keys (tabs, sections, labels) |
| `messages/ko.json` | Korean translations for new message keys |
| `messages/ja.json` | Japanese translations for new message keys |
| `tasks/todo.md` | Add M2 eraser-bg-color task, review backlog dark mode toggle |

### Key Decisions

- Two layout paradigms (not three): pen file design (task 042) established tab navigation for all <1024px, superseding the screen inventory's "floating panel" medium tier
- Floating panel components (TopControlsLeft, TopControlsRight, BottomToolsPanel, BottomColorPalette) are no longer imported by the editor page but retained in codebase for reference
- `{#if layout.isDocked}` Svelte conditional for structural DOM split; CSS media queries for sizing within each paradigm (wide/x-wide, compact/medium)
- HSV color picker displayed inline (always visible) in RightPanel and ColorsContent, replacing the popup toggle pattern
- Palette and HSV picker always edit FG color; BG only changeable via swap button. pickerTarget concept removed to avoid UX confusion before eraser-uses-BG is implemented
- ColorBar shows recent colors instead of preset palette swatches
- Preset buttons use `--ds-bg-hover` bg + `border-radius: 8px` (no border) to visually distinguish from input fields (`--ds-bg-elevated` + border + `border-radius: 4px`)

### Notes

- `border-radius: 4px` and `8px` values from pen file don't map to existing tokens (`--ds-radius-sm` = 6px). Kept as component-specific literal values.
- TabBar pill shape uses component-specific `border-radius: 36px`/`26px`.
- Eraser draws with transparent instead of BG color — added as separate M2 task (requires Rust core change).

