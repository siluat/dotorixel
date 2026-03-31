# 045 — Design system application

## Plan

Apply the unified `--ds-*` design token system from `docs/design-system.md` by creating a new editor UI at `/editor` with `src/lib/ui-editor/` components. Preserve existing Pebble UI (`/pebble`) as legacy.

### Scope

- Create `src/styles/design-tokens.css` with all `--ds-*` tokens (light + dark theme)
- Wire tokens into app layout and Storybook
- Build 7 new editor components + 7 stories in `src/lib/ui-editor/`
- Create editor route at `/editor`
- Update landing page CTA to `/editor` with `--ds-*` tokens
- Update analytics type and E2E tests

### Design decisions

| Decision | Rationale |
|---|---|
| New components instead of Pebble migration | Pebble preserved as legacy; new UI follows §7 component patterns |
| §7 component patterns over migration guide | New UI targets final design spec, not visual parity with Pebble |
| `color-mix()` for accent hover | Derives darker shade from `--ds-accent` without extra token |
| FloatingPanel backdrop-filter blur | §7.2 spec; `color-mix(in srgb, var(--ds-bg-elevated) 93%, transparent)` for theme support |

### Key differences from Pebble

- Button border-radius: 12px → 6px (`--ds-radius-sm`, §7.1)
- Button hover bg: hardcoded → `var(--ds-bg-hover)`
- FloatingPanel: semi-transparent → backdrop-filter blur
- Swatch size (sm): 22px → 24px (§7.4)
- Swatch selected outline: 2.5px accent-dark → 2px `--ds-accent` (§7.4)

## Results

| File | Description |
|------|-------------|
| `src/styles/design-tokens.css` | New: all `--ds-*` tokens (55+ light, 15 dark overrides) |
| `src/routes/+layout.svelte` | Import design-tokens.css |
| `.storybook/preview.ts` | Import design-tokens.css |
| `src/lib/ui-editor/FloatingPanel.svelte` | New: backdrop-filter blur panel with `--ds-*` tokens |
| `src/lib/ui-editor/EditorButton.svelte` | New: button with `--ds-radius-sm`, `color-mix()` hover |
| `src/lib/ui-editor/EditorSwatch.svelte` | New: 24×24 swatch with `--ds-accent` outline |
| `src/lib/ui-editor/TopControlsLeft.svelte` | New: undo/redo/grid floating panel |
| `src/lib/ui-editor/TopControlsRight.svelte` | New: presets, size inputs, export/clear |
| `src/lib/ui-editor/BottomToolsPanel.svelte` | New: tool selection + zoom controls |
| `src/lib/ui-editor/BottomColorPalette.svelte` | New: fg/bg preview + palette grid + color picker |
| `src/lib/ui-editor/editor-palette-data.ts` | New: palette color data |
| `src/lib/ui-editor/*.stories.svelte` (7) | New: Storybook stories for all components |
| `src/routes/editor/+page.svelte` | New: editor route with `--ds-*` tokens |
| `src/lib/analytics/events.ts` | Add `'editor'` to `trackEditorOpen` type |
| `src/routes/+page.svelte` | CTA → `/editor`, `--pebble-*` → `--ds-*` tokens |
| `e2e/landing.test.ts` | CTA href `/pebble` → `/editor` |

### Key Decisions

- Created new `ui-editor/` components instead of migrating Pebble in-place — Pebble preserved as legacy for reference and fallback
- Used floating panel layout (carried from Pebble) as transitional — the pencil design file shows a docked panel layout which will be implemented in the "Editor layout restructure" task
- Literal values from Pebble that don't match any `--ds-*` token (e.g., `border-radius: 8px`, `padding: 10px`) left as-is — these will be resolved when components are rebuilt for the docked layout

### Notes

- The pencil design (`Editor — Desktop Light` frame) specifies a docked panel layout (Top Bar + Left Toolbar + Right Panel + Status Bar), which differs from the current floating panel implementation. The layout transition is scoped to the next task ("Editor layout restructure")
- Some component-specific literal values (button 40×40, swatch 24×24, badge dimensions) are intentionally not tokenized — they are component-intrinsic sizes, not design system primitives
