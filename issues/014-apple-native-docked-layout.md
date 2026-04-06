---
title: "Apple native: layout transition from floating panels to docked layout"
status: open
created: 2026-04-06
parent: 013-apple-native-catchup.md
---

## Problem Statement

The Apple native shell uses the Pebble UI layout — floating translucent panels overlaid on a full-screen Metal canvas. This layout only accommodates 2 tools (pencil/eraser) and a minimal color palette. The web editor has already moved to a docked layout (TopBar, LeftToolbar, RightPanel, StatusBar) that provides structured containers for the full tool set, color management, and canvas controls.

Adding more tools and features to the floating panel layout would mean building UI that gets thrown away when the layout eventually changes. Transitioning to the docked layout first creates the structural foundation for all subsequent Phase 1–3 features.

## Solution

Replace the native Pebble UI (ZStack with floating panels) with a docked layout that mirrors the web editor's structure, implemented with SwiftUI-native controls. The web design serves as the single source of truth — no separate .pen design files for native.

The docked layout has four regions surrounding a central canvas area:

- **TopBar** (top, full width) — app identity, zoom controls, grid toggle, export
- **LeftToolbar** (left, fixed width) — tool buttons, undo/redo
- **RightPanel** (right, fixed width) — canvas settings and color palette
- **StatusBar** (bottom, full width) — canvas dimensions and active tool

## Key Scenarios

1. User opens the app on Mac (960×640 default window) → sees docked layout with TopBar, LeftToolbar at left, canvas in center, RightPanel at right, StatusBar at bottom
2. User opens the app on iPad in landscape (regular width) → sees the same docked layout
3. User selects pencil or eraser in LeftToolbar → tool button shows active state, StatusBar updates tool name
4. User taps undo/redo in LeftToolbar → canvas reverts/reapplies, buttons disable when history is empty
5. User adjusts canvas size via presets or text input in RightPanel → canvas resizes, StatusBar updates dimensions
6. User picks a color from the palette grid or native ColorPicker in RightPanel → foreground color updates, drawing uses new color
7. User uses zoom controls in TopBar (−/+/fit) → canvas zoom changes, percentage label updates
8. User toggles grid in TopBar → pixel grid visibility toggles on canvas
9. User taps Export button in TopBar → nothing happens (disabled state, enabled in separate task)
10. User resizes Mac window → canvas area flexes to fill available space, panels remain fixed width/height

## Implementation Decisions

### Layout structure

ContentView transitions from ZStack to VStack + HStack:

```text
VStack(spacing: 0) {
    TopBar              // fixed height
    HStack(spacing: 0) {
        LeftToolbar      // 44pt fixed width
        CanvasArea       // fills remaining space
        RightPanel       // 220pt fixed width
    }
    StatusBar            // fixed height
}
```

This maps directly to the web's CSS Grid (topbar / toolbar+canvas+panel / status), minus the TabStrip row (multi-tab is Phase 3).

### Panel contents

**TopBar:**
- Left: App logo/icon
- Right: Zoom controls (−, percentage label, +, fit-to-view), grid toggle, Export button (disabled)

**LeftToolbar:**
- Tool buttons: Pencil, Eraser (only currently functional tools; remaining 6 added in Phase 2)
- Separator
- Undo, Redo buttons (moved from former TopControlsLeft)

**RightPanel (220pt wide):**
- Canvas section: size presets, width/height inputs, Clear button (disabled, enabled in separate task)
- Divider
- Color section: foreground swatch, palette grid, SwiftUI ColorPicker
- FG/BG swap, HSV picker, and recent colors are Phase 2 scope

**StatusBar:**
- Left: Canvas dimensions (e.g., "32 × 32")
- Right: Active tool name (e.g., "Pencil")

### Design tokens

Replace `PebbleTokens` with a new token set mirroring the web's `design-tokens.css` naming convention. Key changes:

- Panel background: translucent → opaque surface color
- Panel borders: shadow-based → 1px solid subtle border
- Corner radius: 20pt pill → none (docked panels adjoin canvas)
- Button size: 40pt → 44pt (Apple HIG touch target minimum)
- Metal clear color: Pebble bg (#EFECE8) → bgBase (#F5F2EE)

Token names follow the web convention (e.g., `bgBase`, `bgSurface`, `borderSubtle`, `accent`) for cross-platform vocabulary alignment.

### Button styles

Two ButtonStyle implementations replace PebbleButtonStyle:

1. **ToolButtonStyle(isActive:)** — LeftToolbar tool/undo/redo buttons. 44×44pt frame, active state uses accent color
2. **IconButtonStyle** — TopBar and general icon buttons. No background, hover/press state with subtle background

### File changes

**New files (in existing directories):**
- `Views/TopBar.swift`
- `Views/LeftToolbar.swift`
- `Views/RightPanel.swift`
- `Views/StatusBar.swift`
- `Style/DesignTokens.swift` (contents replaced)
- `Style/ToolButtonStyle.swift`
- `Style/IconButtonStyle.swift`

**Deleted files:**
- `Views/TopControlsLeft.swift`
- `Views/TopControlsRight.swift`
- `Views/BottomToolsPanel.swift`
- `Views/BottomColorPalette.swift`
- `Views/PebbleSwatch.swift`
- `Style/FloatingPanel.swift`
- `Style/PebbleButtonStyle.swift`

**Modified files:**
- `ContentView.swift` — ZStack → VStack+HStack structure
- `Rendering/PixelGridRenderer.swift` — clear color updated to bgBase

**Unchanged:**
- `State/EditorState.swift` — no state model changes needed
- `Rendering/PixelCanvasView.swift`, `Rendering/InputMTKView.swift` — rendering layer untouched
- `Data/DefaultPalette.swift`, `Extensions/Color+SwiftUI.swift` — reused as-is

### Responsive design

This PRD targets a single docked layout for Mac and iPad regular (landscape). Compact/portrait layout adaptation is a separate todo item ("Responsive tiers"). However, the layout decision point should be a single identifiable location so that a size-class branch can be added later without restructuring.

## Testing Decisions

The layout transition is primarily a view-layer change — rearranging existing controls into a new structure. EditorState and the rendering pipeline are unchanged.

**What to test:**
- New design token values are correct (static assertions on color/size constants)
- ToolButtonStyle and IconButtonStyle render correct visual states (if snapshot testing is available; otherwise manual verification)

**What NOT to test:**
- SwiftUI layout behavior (framework responsibility)
- Existing EditorState logic (unchanged, already covered)
- Metal rendering (unchanged)

**Verification approach:**
- Manual testing on Mac (resize window to various sizes)
- Manual testing on iPad simulator in landscape
- Visual comparison against web editor's docked layout

## Rejected Alternatives

### Keep Pebble UI code for compact mode reuse
Considered keeping FloatingPanel and existing views for potential reuse in a future iPad compact/portrait layout. Rejected because: the compact layout design hasn't been decided yet, maintaining two parallel layout systems adds confusion, and git history preserves the code if needed.

### Show all 8 tools as disabled in LeftToolbar
Considered placing all tool buttons (including 6 unimplemented ones) as disabled to preview the full toolbar. Rejected because: a toolbar of mostly-disabled buttons signals an unfinished app, and adding buttons later when tools are implemented is trivial.

### Adaptive RightPanel width based on window size
Considered varying RightPanel width (200–240pt) like the web's breakpoint-based sizing. Rejected in favor of a fixed 220pt for simplicity. Width tuning can be revisited during the responsive tiers task.

## Out of Scope

- **TabStrip / multi-tab UI** — Phase 3, requires Workspace state model
- **Additional tools** (line, rectangle, ellipse, fill, eyedropper, move) — Phase 2
- **FG/BG swap, HSV picker, recent colors** — Phase 2
- **Clear canvas enable** — separate Phase 1 task
- **PNG export enable** — separate Phase 1 task
- **Responsive tiers** (iPad compact, portrait) — separate Phase 1 task
- **Dark mode** — tokens should not block dark mode, but implementing it is not in scope
- **EditorState changes** — no state model modifications needed

## Further Notes

- The web's design-tokens.css is the authoritative source for token values. When in doubt, match the web.
- PebbleSwatch can be replaced by a simpler swatch view since the floating panel styling (selected state outline, size variants) simplifies in a docked context.
- The Benchmark/RenderBenchmarkView.swift debug tool should still be accessible after the layout change — ensure it's reachable from the new layout or a debug menu.
