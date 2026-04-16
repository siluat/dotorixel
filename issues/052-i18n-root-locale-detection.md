---
title: Fix automatic locale detection for root URL visitors
status: done
created: 2026-04-16
---

## Problem Statement

Visitors whose browser preferred language is Korean or Japanese land on the English landing page when they open the root URL (`/`), even though Paraglide's strategy array includes `preferredLanguage`. The intended behavior from task 036 ("auto-detect from browser") and PR #70 ("automatic browser language detection without manual redirect logic") is silently broken.

The root cause is in [src/lib/paraglide/runtime.js:57-75](../src/lib/paraglide/runtime.js) (generated from [project.inlang/settings.json](../project.inlang/settings.json)):

- The `url` strategy is first in the strategy array.
- The English (baseLocale) URL pattern uses a wildcard: `:protocol://:domain(.*)::port?/:path(.*)?`.
- That wildcard matches every path, including `/`, so `extractLocaleFromUrl('/')` always returns `en`.
- Because the `url` strategy always returns a locale, the later strategies (`preferredLanguage`, `baseLocale`) are never evaluated.

Paraglide's official documentation [explicitly warns](https://inlang.com/m/gerre34r/library-inlang-paraglideJs/strategy) against this:

> "When using wildcard patterns like `/:path(.*)?` (which is the default), the URL strategy will **always** resolve to a locale... any strategies placed after it will never be evaluated."

## Solution

Adopt Paraglide's recommended SPA configuration using the `routeStrategies` option to override strategy on the root URL only:

1. **Default strategy** → `["localStorage", "url", "preferredLanguage", "baseLocale"]`. Matches the documented SPA pattern. `cookie` is omitted because dotorixel is a pure SPA (`ssr = false` + `adapter-static`).
2. **Root URL strategy override** → via `routeStrategies: [{ match: '/', strategy: ['localStorage', 'preferredLanguage', 'baseLocale'] }]`. Removes the `url` strategy for the root path only, so the root falls through to `preferredLanguage` for first-time visitors; every other path continues to honor URL-based routing (`/ko/editor` → Korean regardless of browser preference).
3. **Language selector persistence** → keep the existing `<a href={localizeHref(...)} data-sveltekit-reload>` link structure (Paraglide's official SvelteKit pattern) but add an `onclick` handler that writes the chosen locale to `localStorage` via the runtime's exported `localStorageKey`. This ensures the explicit choice persists across sessions and wins over `preferredLanguage` on next visit.

### Why not `setLocale()`?

`setLocale()` was considered but rejected for the selector: because the root path's strategy does not include `url`, calling `setLocale()` there only writes to localStorage and does a bare `window.location.reload()` without URL change. That conflicts with the agreed UX (URL should reflect locale for non-root paths). The link + localStorage write approach achieves both URL update and persistence uniformly on all paths.

### Configuration location

`strategy` is configured in [vite.config.ts](../vite.config.ts) via `paraglideVitePlugin({ strategy, routeStrategies })`, **not** in `project.inlang/settings.json`. The settings file only defines locales and message file pattern.

## Key Scenarios

1. Korean-preference browser visits `/` for the first time → landing renders in Korean; URL stays `/` (auto-detection is silent — no navigation, `preferredLanguage` resolves the locale at render time because the `url` strategy is excluded on `/`).
2. User opens a shared link `/ko/editor` → editor opens in Korean regardless of browser preference (URL wins over `preferredLanguage`, localStorage is empty on first visit).
3. Korean-preference user at `/ko/` clicks the "English" link → `setLocale('en')` persists `en` to localStorage and navigates to `/`. No bounce back to `/ko/` because localStorage now wins.
4. User returns next session with the same browser but a new tab → localStorage yields the previously chosen locale immediately; `preferredLanguage` is skipped.
5. Japanese-preference first-time visitor visits `/editor` directly → URL pattern for the `editor` route resolves to `en` (or `ja` if a localized pattern exists); TBD verify behavior matches expectations and document.

## Implementation Decisions

### Default strategy order

- `["localStorage", "url", "preferredLanguage", "baseLocale"]`.
- Rationale: aligned with Paraglide's SPA recommendation. localStorage respects explicit user choice first; URL respects shared/bookmarked links; `preferredLanguage` handles the "no signal yet" case; `baseLocale` is the ultimate fallback.

### Route-level strategy override

- `routeStrategies: [{ match: '/', strategy: ['localStorage', 'preferredLanguage', 'baseLocale'] }]`.
- Rationale: Paraglide's default wildcard URL pattern for baseLocale (`/:path(.*)?`) matches every path including `/`, which would otherwise short-circuit the URL strategy to `en` on root. `routeStrategies` is the officially supported mechanism to override strategy on a specific path; URLPattern does not support negative lookahead (can't easily exclude `/` from the wildcard), so this is the cleanest option.
- Scope: applies **only** to the exact root path `/`. All other paths continue to use the default strategy (URL-based routing intact for `/ko/editor` etc.).

### Language selector

- Retain existing link-based nav (`<a href={localizeHref(...)} data-sveltekit-reload>`) to preserve keyboard/middle-click/right-click behavior and match Paraglide's official SvelteKit selector pattern.
- Add `onclick` handler that calls `localStorage.setItem(localStorageKey, locale)` before navigation. `localStorageKey` is imported from `$lib/paraglide/runtime` (single source of truth — avoids hard-coding the cookie/storage name).
- Current locale remains `<strong>` and non-interactive; others remain keyboard-focusable. Existing `e2e/landing.test.ts` `'current locale is bold, not a link'` test continues to apply.

### Testing

- Preserve all existing `e2e/landing.test.ts` behavior.
- Add coverage for:
  - Korean browser preference at `/` → Korean content rendered.
  - Clicking "English" on `/ko/` → localStorage records `en`; subsequent visit to `/` stays English even with Korean browser preference.
  - Explicit `/ko/editor` visit with `en` in localStorage → URL still wins (Korean content).
- Playwright `locale` context option simulates browser preference.

## Out of Scope

- Cookie strategy — unnecessary for a pure SPA.
- Server-side rendering adoption or prerendering reconfiguration.
- Visual redesign of the language selector.
- SEO/meta `hreflang` tags (already tracked separately).

## Rejected Alternatives

- **Keep `url` first, accept the bug** — the stated design goal is broken; not viable.
- **Reorder to `["preferredLanguage", "url", "baseLocale"]`** — breaks explicit language intent. A Korean user trying to open `/en/` would still see Korean, defeating the shareable-link guarantee.
- **Restore the manual `+page.ts` redirect from task 036** — achievable but duplicates what Paraglide's built-in localStorage + `setLocale` already handle. Prefer Paraglide's abstractions (CLAUDE.md: "Depend on interfaces, not implementations").
- **Add `cookie` strategy** — Paraglide documents cookie as an SSR-oriented fallback for localStorage; dotorixel has no SSR, so cookie adds configuration surface without benefit.
- **Change URL patterns so English uses `/en/` prefix** — breaks the established baseLocale-at-root convention, affects every route, and diverges from Paraglide's default guidance.

## Results

| File | Description |
|------|-------------|
| `vite.config.ts` | `paraglideVitePlugin` `strategy` changed from `['url', 'preferredLanguage', 'baseLocale']` to `['localStorage', 'url', 'preferredLanguage', 'baseLocale']`; added `routeStrategies` override for `/` that drops the `url` strategy so the root path falls through to `preferredLanguage`. |
| `vitest.config.ts` | Mirrored the same `strategy` and `routeStrategies` values so test-time Paraglide compilation matches production. |
| `src/routes/+page.svelte` | Language selector links gained an `onclick` handler that writes the chosen locale to `localStorage` via the runtime's exported `localStorageKey`. Link structure (`<a href={localizeHref(...)} data-sveltekit-reload>`) preserved to keep middle-click/right-click semantics and Paraglide's official SvelteKit pattern. |
| `e2e/landing.test.ts` | File-level `test.use({ locale: 'en-US' })` pins default browser locale for pre-existing assertions; added 4 new tests: Korean browser preference renders `/` in Korean, Japanese browser preference renders `/` in Japanese, explicit `/ja/` wins over Korean preference, and explicit English choice persists through `localStorage` across visits. |
| `docs/platform-status.md` | Updated i18n Notes to reflect auto-detect on root. |

### Key Decisions

- **`routeStrategies` instead of URL pattern surgery.** Considered rewriting the wildcard English URL pattern (`/:path(.*)?`) to exclude the root, but URLPattern has no negative-lookahead and the approach would touch every non-root path. `routeStrategies` is Paraglide's officially supported per-path strategy override — scoped precisely to `/` and leaves every other route untouched.
- **`localStorage` write on link click instead of `setLocale()`.** `setLocale()` on the root (where the `url` strategy is excluded) would only call `window.location.reload()` without changing the URL, breaking the agreed UX of "URL reflects locale on navigation." The link + manual `localStorage.setItem(localStorageKey, locale)` pattern updates URL and persistence together on every path.
- **No `cookie` strategy.** Paraglide documents cookie as an SSR-oriented fallback; dotorixel is a pure SPA (`ssr = false` + `adapter-static`), so cookie adds configuration surface without benefit.
- **`en-US` locale pin on existing tests.** Pre-existing landing tests assume English at `/`. After the change, `/` honors browser preference, so host-OS language (e.g., Korean developer machine) could flip those tests red. File-level `test.use({ locale: 'en-US' })` keeps existing assertions deterministic; new tests opt into specific locales via explicit `browser.newContext({ locale })`.

### Notes

- **`vite.config.ts` and `vitest.config.ts` duplication.** Both files now carry identical `paraglideVitePlugin` options. Acceptable for now; if a third consumer appears or drift risk grows, extract a shared `paraglide.config.ts` exporting the options object.
- **`src/lib/paraglide/runtime.js` is `.gitignore`d.** It is regenerated on every `vite dev` / `vite build` / `vitest` run. Config changes only take effect after a regeneration pass.
- **URL on auto-detected Korean stays `/`, not `/ko/`.** Because the root strategy override removes `url`, Paraglide updates localStorage but does not navigate. URL reflects locale only after an explicit selector click (or a deep link like `/ko/editor`). This is consistent with the agreed UX: automatic detection is silent, explicit choice is visible in the URL.
- **E2E suite grew from 48 → 52 tests; all pass.** `bun run check` clean (0 errors), `bun run test` 516 passed, `bun run test:e2e` 52 passed.
