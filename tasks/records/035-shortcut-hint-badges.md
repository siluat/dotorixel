# 035 — On-demand shortcut hint badges

## Plan

### Context

Currently shortcut information relies solely on HTML `title` attributes (browser default tooltip), which has low discoverability. Implement an "on-demand" hint system where shortcut badges appear above each button while holding the `/` key. Settings toggle was originally planned but removed as unnecessary.

### Design Decisions

#### Trigger Key: `/` (Slash alone)
- `?` (Shift+Slash) conflicts with Shift constraining for shape tools — use `/` alone
- `event.code === 'Slash'` is physical-key-based, works regardless of Korean IME state
- Badges show only while `/` is held, disappear on release
- No badges during drawing + drawing blocked while hints visible

#### State Management Separation
- **EditorState**: manages `/` key hold state (`shortcutHintsVisible`) + exposes getter
- **Page route**: passes `editor.shortcutHintsVisible` directly to components
- Keeps core logic and browser APIs separated

#### Badge Rendering
- Button components (PebbleButton, BevelButton) receive `shortcutHint` prop
- Badge visibility controlled by parent via `showShortcutHints` value
- Visual style matches each UI theme
- `aria-hidden="true"` — accessibility info already in `title` attribute
- CSS `transition: opacity 0.15s` — smooth fade in/out

### Implementation Steps

1. Add `/` key handling to EditorState (`#shortcutHintsVisible` state + getter + guards)
2. Add EditorState tests for `/` key behavior
3. Add badge rendering to PebbleButton (`shortcutHint` prop + scoped styles)
4. Add badge rendering to BevelButton (same pattern, pixel theme styling)
5. Add `shortcutHint` field to ToolbarItem and ToolbarButtonProps types
6. Pass `shortcutHint` through ToolbarLayout
7. Wire hint data in BottomToolsPanel (Pebble) and TopControlsLeft (Pebble)
8. Wire hint data in Toolbar (Pixel)
9. Pass `showShortcutHints` from page routes to components
10. Create platform-specific shortcut display utility (`formatShortcut`, `isMac`)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | `/` key handling, `shortcutHintsVisible` state, `handleDrawStart`/`handleDraw` guards |
| `src/lib/canvas/editor-state.svelte.test.ts` | 6 tests: press/release, repeat ignore, drawing mutual exclusion, blur reset |
| `src/lib/canvas/shortcut-display.ts` | New file — `isMac()` and `formatShortcut()` (SSR-safe platform detection) |
| `src/lib/ui-pebble/PebbleButton.svelte` | `shortcutHint` prop + badge markup + scoped styles with `--badge-bg` token |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | `showShortcutHints` prop + `hint()` helper + per-tool hint data |
| `src/lib/ui-pebble/TopControlsLeft.svelte` | `showShortcutHints` prop + `formatShortcut` for Undo/Redo/Grid |
| `src/lib/ui-pixel/BevelButton.svelte` | `shortcutHint` prop + badge markup + pixel theme styles |
| `src/lib/ui-pixel/toolbar-types.ts` | `shortcutHint` field on `ToolbarItem` and `ToolbarButtonProps` |
| `src/lib/ui-pixel/ToolbarLayout.svelte` | Pass `shortcutHint` to Button component |
| `src/lib/ui-pixel/Toolbar.svelte` | `showShortcutHints` prop + `hint()`/`hintCtrl()` helpers + per-item hint data |
| `src/routes/pebble/+page.svelte` | Pass `editor.shortcutHintsVisible` to child components |
| `src/routes/pixel/+page.svelte` | Pass `editor.shortcutHintsVisible` to Toolbar |

### Key Decisions
- Removed settings toggle (Keyboard button + localStorage persistence) — unnecessary complexity for an on-demand feature that requires no configuration
- Added `#shortcutHintsVisible` guard to both `handleDrawStart` and `handleDraw` — EditorState itself enforces the drawing/hints mutual exclusion invariant, not just the UI layer
- Used `navigator.platform` (deprecated but universally supported) over `navigator.userAgentData` (Chromium-only) — isolated in `isMac()` for future replacement
