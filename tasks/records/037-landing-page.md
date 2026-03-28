# 037 — Minimal landing page (hero section + CTA)

## Plan

### 1. Root page load modification — `src/routes/+page.ts`

Change the current redirect-all-to-editor logic:
- English users (base locale): show landing page at `/` without redirect
- Non-English users: redirect to `/{locale}/` (landing page, not editor)
- If `getLocale()` is not base locale, the URL already has a locale prefix — no redirect needed

### 2. Landing page UI — `src/routes/+page.svelte`

Minimal composition:
- **Language selection**: inline language links at top (`English · 한국어 · 日本語`). Current locale bold, others linked via `localizeHref('/', { locale })`.
- **Hero section**: app name (DOTORIXEL) + tagline + description
- **CTA button**: "Start Drawing" → navigate to editor via `localizeHref('/pebble')`
- Center-aligned, using Pebble design tokens

### 3. i18n translations — `messages/{en,ko,ja}.json`

Keys:

| Key | en | ko | ja |
|---|---|---|---|
| `landing_tagline` | Pixel Art Editor | 픽셀 아트 에디터 | ピクセルアートエディター |
| `landing_description` | Create pixel art right in your browser. | 브라우저에서 바로 픽셀 아트를 그려보세요. | ブラウザですぐにピクセルアートを描けます。 |
| `landing_cta` | Start Drawing | 그리기 시작 | 描き始める |

### 4. Files to modify

| File | Change |
|---|---|
| `src/routes/+page.ts` | Change redirect target from editor to locale root |
| `src/routes/+page.svelte` | Landing page markup + scoped styles |
| `messages/en.json` | Add landing page translation keys |
| `messages/ko.json` | Add landing page translation keys |
| `messages/ja.json` | Add landing page translation keys |

## Results

| File | Description |
|------|-------------|
| `src/routes/+page.svelte` | Landing page: hero section (DOTORIXEL + tagline + description), CTA button, language nav |
| `src/routes/+page.ts` | Deleted — no load logic needed |
| `messages/en.json` | Added `landing_tagline`, `landing_description`, `landing_cta` |
| `messages/ko.json` | Added `landing_tagline`, `landing_description`, `landing_cta` |
| `messages/ja.json` | Added `landing_tagline`, `landing_description`, `landing_cta` |
| `vite.config.ts` | Added `preferredLanguage` to Paraglide strategy |
| `vitest.config.ts` | Added `preferredLanguage` to Paraglide strategy |
| `playwright.config.ts` | New — Playwright E2E test config |
| `e2e/landing.test.ts` | New — 9 E2E tests for landing page |
| `package.json` | Added `@playwright/test`, `test:e2e` script |

### Key Decisions

- **Paraglide `preferredLanguage` strategy instead of manual redirect**: The original plan used `navigator.language` in `+page.ts` load function with `redirect()`. This caused an infinite redirect loop because `window.location.href` is not updated during SvelteKit client-side navigation, so `getLocale()` kept returning the base locale. Replaced with Paraglide's built-in `preferredLanguage` strategy which handles browser language detection at the framework level.
- **`data-sveltekit-reload` on language links**: SvelteKit's client-side navigation doesn't trigger Paraglide's locale re-detection from the URL. Language switch links require a full-page reload.
- **Playwright E2E tests added**: Language navigation behavior (click → URL change → content update) cannot be verified with unit tests. Added `@playwright/test` and 9 E2E tests.

### Notes

- WASM initialization still runs on landing page via root `+layout.ts`. Optimization (lazy-load WASM only on editor pages) can be a separate task.
- Playwright browser (Chromium) needs to be installed separately via `bunx playwright install chromium`.
