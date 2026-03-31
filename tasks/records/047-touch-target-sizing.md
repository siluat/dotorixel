# 047 — Touch Target Sizing (44px Minimum)

## Plan

The task description: "All interactive elements need 44px minimum hit areas on compact/medium tiers."
This targets the tab layout (<1024px) where touch is the primary input. Docked layout (wide/x-wide) uses pointer input and is out of scope.

Several tab-layout components currently have interactive elements below 44px:
- ToolStrip buttons: 40px (compact)
- AppBar action buttons: 36px, zoom buttons: 28px (medium only, hidden on compact)
- ColorBar recent swatches: 26px (compact), 30px (medium)
- ColorsContent swap button: 36px
- EditorSwatch lg: 32px (used in ColorsContent palette)

Already compliant: SettingsContent (44px), TabBar (>44px).

Two techniques based on context:

- **Technique A (enlarge)**: Set width/height to `var(--ds-touch-target-min)`. For buttons where visual growth is acceptable.
- **Technique B (hit area expansion)**: Keep visual size compact, add `::after` pseudo-element sized at 44px. For color swatches where visual compactness matters.

### Steps

1. Add `--ds-touch-target-min: 44px` design token to `src/styles/design-tokens.css`
2. ToolStrip (Technique A): Enlarge `.tool-btn` and `.action-btn` to 44px, reduce compact padding from `0 8px` to `0 4px` to prevent overflow on 360px devices
3. AppBar (Technique A + B): Enlarge `.action-btn` to 44px, expand `.zoom-controls` height to 44px, add `::after` hit area to `.zoom-btn`, add `min-height` to `.zoom-label`
4. ColorBar (Technique B): Add `::after` hit area expansion to `.swatch` (recent colors)
5. ColorsContent (Technique A): Enlarge `.swap-btn` to 44px
6. EditorSwatch (Technique B): Add `::after` hit area expansion to `.editor-swatch` base class (both sm and lg variants)

### Files to modify

| File | Technique | Elements |
|------|-----------|----------|
| `src/styles/design-tokens.css` | Token | `--ds-touch-target-min` |
| `src/lib/ui-editor/ToolStrip.svelte` | A (enlarge) | `.tool-strip` padding, `.tool-btn`, `.action-btn` |
| `src/lib/ui-editor/AppBar.svelte` | A + B | `.action-btn` (A), `.zoom-btn` (B), `.zoom-controls`, `.zoom-label` |
| `src/lib/ui-editor/ColorBar.svelte` | B (hit area) | `.swatch` |
| `src/lib/ui-editor/ColorsContent.svelte` | A (enlarge) | `.swap-btn` |
| `src/lib/ui-editor/EditorSwatch.svelte` | B (hit area) | `.editor-swatch` |

## Results

| File | Description |
|------|-------------|
| `src/styles/design-tokens.css` | Added `--ds-touch-target-min: 44px` token |
| `src/lib/ui-editor/ToolStrip.svelte` | Buttons enlarged to 44px, compact padding reduced to 4px for 360px viewport fit |
| `src/lib/ui-editor/AppBar.svelte` | Action buttons enlarged to 44px, zoom-controls height to 44px, zoom-btn `::after` hit area, zoom-label min-height |
| `src/lib/ui-editor/ColorBar.svelte` | Recent swatch `::after` hit area expansion (visual size unchanged) |
| `src/lib/ui-editor/ColorsContent.svelte` | Swap button enlarged to 44px |
| `src/lib/ui-editor/EditorSwatch.svelte` | `::after` hit area expansion for both sm/lg variants (visual size unchanged) |

### Key Decisions

- Scoped to compact/medium tiers (<1024px) only — docked layout (≥1024px) uses pointer input and was excluded per task description.
- Two techniques: Technique A (enlarge) for buttons where visual growth is acceptable, Technique B (`::after` hit area expansion) for swatches where visual compactness matters.
- ToolStrip compact padding reduced from 8px to 4px to prevent overflow on 360px-wide viewports (8 buttons × 44px = 352px).
- ColorBar FG/BG swatches skipped — they are `<div>` display elements, not interactive.

### Notes

- SettingsContent and TabBar already met 44px minimum — no changes needed.
- The `::after` pseudo-element pattern causes minor hit area overlap between adjacent swatches in tight grids. Browser resolves by DOM order (later elements on top). Not a functional issue since users target visual swatch centers.
