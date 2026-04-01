# 051 — Safe area and virtual keyboard handling

## Plan

### Background

The editor has no safe area handling. On iPhones with notch/Dynamic Island, the AppBar is hidden behind the status bar, and the TabBar overlaps with the home indicator. Fix with `viewport-fit=cover` and `env(safe-area-inset-*)` CSS. Virtual keyboard is already adequately handled by the existing `100dvh` + `overflow-y: auto` pattern — no additional JavaScript needed.

### Implementation

1. **Viewport meta tag** (`src/app.html`): Add `viewport-fit=cover` to allow content to extend into safe area regions.

2. **Tab layout — Top (AppBar)** (`src/lib/ui-editor/AppBar.svelte`): Add `padding-top: env(safe-area-inset-top, 0px)` to `.app-bar`. Background extends into the top safe area; content sits below the notch/Dynamic Island. On non-notched devices: 0px, identical to current behavior.

3. **Tab layout — Bottom (TabBar)** (`src/lib/ui-editor/TabBar.svelte`): Change bottom padding to safe-area-aware values:
   - Compact: `padding-bottom: max(20px, env(safe-area-inset-bottom, 0px))` (current 20px; unchanged on non-notched, expands to ~34px on iPhone)
   - Medium (>=600px): `padding-bottom: max(8px, env(safe-area-inset-bottom, 0px))` (iPad home indicator)

4. **Tab layout — Sides** (`src/routes/editor/+page.svelte`): Add left/right safe area padding on `.editor-tabs` for landscape orientation on notched phones.

5. **Docked layout — Top (TopBar)** (`src/lib/ui-editor/TopBar.svelte`, `src/routes/editor/+page.svelte`): Add `padding-top: env(safe-area-inset-top, 0px)` to TopBar. Adjust grid first row height: `calc(44px + env(safe-area-inset-top, 0px))` (and 48px variant at 1440px+).

6. **Docked layout — Bottom (StatusBar)** (`src/lib/ui-editor/StatusBar.svelte`, `src/routes/editor/+page.svelte`): Add `padding-bottom: env(safe-area-inset-bottom, 0px)` to StatusBar. Adjust grid last row height: `calc(28px + env(safe-area-inset-bottom, 0px))`.

7. **Landing page** (`src/routes/+page.svelte`): Add top safe area to `.lang-nav` padding. Add left/right safe area padding on `.landing` container for landscape.

8. **Pebble/Pixel routes** (`src/routes/pebble/+page.svelte`, `src/routes/pixel/+page.svelte`): Minimal container-level 4-direction safe area padding since `viewport-fit=cover` applies globally.

### Virtual keyboard

No changes needed. `100dvh` layout handles keyboard resize correctly — flex reflows naturally, `SettingsContent` has `overflow-y: auto`, and the browser auto-scrolls focused inputs into view.

## Results

| File | Description |
|------|-------------|
| `src/app.html` | Added `viewport-fit=cover` to viewport meta tag |
| `src/lib/ui-editor/AppBar.svelte` | Top safe area padding via `env(safe-area-inset-top)` |
| `src/lib/ui-editor/TabBar.svelte` | Bottom safe area padding with `max()` (20px compact, 8px medium) |
| `src/lib/ui-editor/TopBar.svelte` | Top safe area padding for docked layout |
| `src/lib/ui-editor/StatusBar.svelte` | Bottom safe area padding for docked layout |
| `src/routes/editor/+page.svelte` | Left/right safe area on `.editor-tabs`; grid row heights with `calc()` + `env()` on `.editor-docked`; simplified initial canvas fit to always use `handleFit()` |
| `src/routes/+page.svelte` | Landing page top + left/right safe area |
| `src/routes/pebble/+page.svelte` | Container-level 4-direction safe area padding |
| `src/routes/pixel/+page.svelte` | Container-level 4-direction safe area padding |

### Key Decisions

- CSS-only approach — no JavaScript for virtual keyboard detection. `100dvh` + `overflow-y: auto` already handles keyboard resize adequately.
- Component-level padding for top/bottom safe areas (AppBar, TabBar, TopBar, StatusBar) so backgrounds extend into safe areas seamlessly. Container-level padding for left/right safe areas — accepted trade-off for landscape edge case.
- `max()` for TabBar bottom padding to maintain minimum visual spacing on non-notched devices.
- Initial canvas fit refactored: replaced 512px magic number + manual centering with `handleFit()` — works for all screen sizes.

### Notes

- Side safe areas use container-level padding, so bar backgrounds don't extend into side safe areas (subtle `--ds-bg-base` vs `--ds-bg-surface` color difference visible in landscape).
- Pebble/Pixel routes receive minimal container-level padding only (non-production routes).
- Manual testing on iOS Safari (real device or simulator) recommended for visual verification.
