# 064 — Toolbar tool tooltip on hover

## Plan

### Context

All toolbar buttons currently use the native browser `title` attribute to display "Tool Name (Shortcut Key)" on hover. The native tooltip has a long OS-controlled delay (500ms-1s), cannot be styled, and doesn't match the app's design. Replace with a custom styled tooltip.

### Confirmed Design

**Style: Always Dark + Border** (confirmed via `.pen` design exploration)

Same dark tooltip in both modes. Accent-toned border (`#5C4A32`) in dark mode for distinction.

| Property | Value |
|----------|-------|
| Background | `#2D210F` |
| Text color | `#FDFBF8` |
| Font | `var(--ds-font-body, 'Galmuri11', system-ui, sans-serif)` |
| Font size (name) | 11px (`--ds-font-size-sm`) |
| Font weight (name) | 500 |
| Border radius | 6px |
| Padding | 6px 10px |
| Gap (name - badge) | 8px |
| Border (light mode) | 1px solid transparent |
| Border (dark mode) | 1px solid `#5C4A32` |
| Shortcut badge bg | `#4A3D2A` |
| Shortcut badge text | `#D8CFC2`, 10px (`--ds-font-size-xs`), weight 600 |
| Shortcut badge radius | 4px |
| Shortcut badge padding | 2px 6px |

### Approach: Svelte Action

`use:tooltip={title}` Svelte action applied to each button component.

### Implementation Steps

1. **Create tooltip action module** — `src/lib/tooltip.ts`
   - `Action<HTMLElement, string | undefined>` type
   - 400ms delay on mouseenter, immediate hide on mouseleave/mousedown
   - Tooltip element appended to `document.body`, `position: fixed`, z-index 10000
   - Position: above button (default), below if clipped at top, horizontal clamping
   - CSS injected once at module level via `<style>` element
   - Dark mode border via `:root[data-theme="dark"]` selector
   - Parse title string `"Name (Key)"` to separate name and shortcut badge

2. **Modify button components** — add `use:tooltip={title}`, remove native `{title}`, add `aria-label`
   - `BevelButton.svelte`, `FlatButton.svelte`, `PebbleButton.svelte`, `EditorButton.svelte`

3. **Create tooltip story file** — `src/lib/tooltip.stories.svelte`

4. **Handle zoom label buttons** — add tooltip to plain `<button>` zoom labels in panel files

5. **.pen design file** — "Tooltip Design" frame reorganized (confirmed + reviewed alternatives)

## Results

| File | Description |
|------|-------------|
| `src/lib/tooltip.ts` | Svelte action with placement support, title parsing, dynamic CSS injection |
| `src/lib/tooltip.test.ts` | 7 tests for `parseTitle` edge cases |
| `src/lib/tooltip.stories.svelte` | Storybook stories: WithShortcut, WithoutShortcut, WithModifier, ButtonRow |
| `src/lib/canvas/shortcut-display.ts` | Added `TOOL_SHORTCUT_KEYS` — single source of truth for tool shortcut display keys |
| `src/lib/canvas/editor-state.svelte.ts` | `TOOL_SHORTCUTS` now derived from `TOOL_SHORTCUT_KEYS` |
| `src/lib/ui-editor/LeftToolbar.svelte` | Added tooltip (placement: right), uses shared shortcut map |
| `src/lib/ui-editor/ToolStrip.svelte` | Added tooltip, uses shared shortcut map |
| `src/lib/ui-editor/TopBar.svelte` | Added tooltip to zoom controls, grid toggle, export |
| `src/lib/ui-editor/BottomToolsPanel.svelte` | Switched to shared shortcut map, tooltip on zoom label |
| `src/lib/ui-editor/EditorButton.svelte` | Added `use:tooltip={title}`, removed native `title` |
| `src/lib/ui-pebble/PebbleButton.svelte` | Added `use:tooltip={title}`, removed native `title` |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Switched to shared shortcut map, tooltip on zoom label |
| `src/lib/ui-pixel/BevelButton.svelte` | Added `use:tooltip={title}`, removed native `title` |
| `src/lib/ui-pixel/FlatButton.svelte` | Added `use:tooltip={title}`, removed native `title` |
| `src/lib/ui-pixel/Toolbar.svelte` | Switched to shared shortcut map |
| `src/app.html` | GeistPixel-Square font-face declaration |
| `.storybook/preview-head.html` | GeistPixel-Square font-face for Storybook |
| `docs/pencil-dotorixel.pen` | Tooltip Design frame (confirmed + reviewed alternatives) |

### Key Decisions

- **Always Dark + Border style**: Same dark tooltip in both modes; accent-toned border (`#5C4A32`) in dark mode for distinction. Chosen over True Inverted and Theme Variable approaches via .pen design exploration.
- **GeistPixel-Square for shortcut badge font**: Galmuri variants had asymmetric character centering in small badge contexts. Geist Pixel Square (pixel font with square dots) provided the best visual balance.
- **Svelte action over component**: `use:tooltip` directive minimizes structural changes — no wrapper components needed.
- **Placement parameter**: Union type `string | { text, placement? }` keeps simple call sites clean while supporting `placement: 'right'` for the left toolbar.
- **Shared `TOOL_SHORTCUT_KEYS`**: Eliminated shortcut key duplication across 8+ components. `editor-state.svelte.ts` derives its `TOOL_SHORTCUTS` from this single source.

### Notes

- `LeftToolbar`, `ToolStrip`, `TopBar` use inline `<button>` elements (not `EditorButton`), so tooltip was applied directly to these components in addition to the shared button components.
- Dark mode toggle UI doesn't exist yet — the `:root[data-theme="dark"]` border rule is dormant until implemented.
- Grid toggle `(G)` and color swap `(X)` shortcuts remain hardcoded — they are action shortcuts, not tool shortcuts. Can be unified if an action shortcut map is needed later.
