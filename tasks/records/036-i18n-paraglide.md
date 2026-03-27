# 036 — Internationalization (Paraglide.js + URL path routing)

## Plan

### Context

All ~56 UI strings in DOTORIXEL are hardcoded in English. Support 3 languages (Korean/English/Japanese) with URL path-based routing (`/en/pebble`, `/ko/pebble`, `/ja/pebble`). No language toggle UI — auto-detect from browser. QA via direct URL.

### Library: Paraglide.js v2

- Svelte official CLI integration
- Compiler-based — tree-shakable (only used messages in bundle)
- Built-in URL routing via `reroute` hook
- SEO (`hreflang`) possible for future landing/help pages

### SPA Constraints

- `ssr = false` + `adapter-static(fallback: 'index.html')`: `hooks.server.ts` not executed in production
- `app.html` keeps `lang="en"` fixed, update `document.documentElement.lang` dynamically on client
- `paths.relative: false` required to prevent asset 404s with locale prefix

### Steps

1. Install Paraglide.js, configure `vite.config.ts`, `vitest.config.ts`, `svelte.config.js`, `.gitignore`
2. Create message files (`messages/en.json`, `messages/ko.json`, `messages/ja.json`) with 35 keys
3. Add universal `reroute` hook in `src/hooks.ts`
4. Update root layout (locale→lang sync) and `+page.ts` (browser language detect redirect)
5. Replace hardcoded strings in 11 component files with `m.*()` calls
6. Replace `TOOL_LABELS` Record in StatusBar with `TOOL_MESSAGE` function-reference Record
7. Verify Storybook works (inherits Paraglide Vite plugin)
8. Add Paraglide Vite plugin to `vitest.config.ts`
9. Check internal links for `localizeHref()` needs (none found)
10. `/bench` dev-only page excluded from i18n scope

## Results

| File | Description |
|------|-------------|
| `project.inlang/settings.json` | Paraglide project config (en/ko/ja locales, CDN plugin modules) |
| `messages/en.json` | English message catalog (35 keys) |
| `messages/ko.json` | Korean message catalog |
| `messages/ja.json` | Japanese message catalog |
| `src/hooks.ts` | Universal `reroute` hook for locale prefix handling |
| `vite.config.ts` | Added Paraglide Vite plugin |
| `vitest.config.ts` | Added Paraglide Vite plugin for test runner |
| `svelte.config.js` | Added `paths.relative: false` |
| `.gitignore` | Added `src/lib/paraglide/` (generated code) |
| `package.json` | Added `@inlang/paraglide-js`, `@types/node` devDependencies |
| `src/routes/+layout.svelte` | Locale→`document.documentElement.lang` sync via `$effect` |
| `src/routes/+page.ts` | Browser language detection redirect to `/{locale}/pebble` |
| `src/lib/ui-pebble/TopControlsLeft.svelte` | Undo/Redo/Toggle Grid titles → `m.*()` |
| `src/lib/ui-pebble/TopControlsRight.svelte` | Canvas width/height, Export/Clear titles → `m.*()` |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | 7 tool titles + zoom titles → `m.*()` |
| `src/lib/ui-pixel/Toolbar.svelte` | 15 toolbar item labels → `m.*()` |
| `src/lib/ui-pixel/StatusBar.svelte` | `TOOL_LABELS` → `TOOL_MESSAGE` function-reference Record |
| `src/lib/ui-pixel/CanvasSettings.svelte` | Canvas Size, W/H, Apply labels → `m.*()` |
| `src/lib/ui-pixel/ColorPalette.svelte` | Hex code, Recent labels → `m.*()` |
| `src/lib/color-picker/ColorPickerPopup.svelte` | Color picker, Hex code aria-labels → `m.*()` |
| `src/lib/color-picker/HsvPicker.svelte` | Saturation/brightness, Hue aria-labels → `m.*()` |
| `src/lib/color-picker/FgBgPreview.svelte` | FG/BG group, swap, picker aria-labels → `m.*()` |
| `src/lib/canvas/PixelCanvasView.svelte` | Pixel art canvas aria-label → `m.*()` |
| `CLAUDE.md` | Added i18n row to Tech Stack and MVP Technical Decisions tables |

### Key Decisions

- Used Paraglide runtime's `locales` and `baseLocale` exports in `+page.ts` instead of duplicating the locale list — single source of truth from `project.inlang/settings.json`
- Added `@types/node` to resolve `async_hooks` type error in Paraglide's generated `server.js` (used for SSR middleware, not executed in SPA mode but checked by `svelte-check`)
- `project.inlang/settings.json` `modules` array loads plugins from CDN at compile time — this is inlang's standard pattern, no npm install required for the plugins

### Notes

- `pathPattern` in `settings.json` is `./messages/{locale}.json` — resolved relative to project root by inlang, not relative to the `project.inlang/` directory
- Storybook inherits the Paraglide Vite plugin from `vite.config.ts` via `@storybook/sveltekit` — no additional Storybook configuration needed
- `/bench` dev-only page is not affected by i18n (no locale prefix required)
- `app.html` `<meta name="description">` and `<title>` are not localized — SSR would be needed for those, deferred to future
