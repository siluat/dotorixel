# 038 — Privacy-Friendly Analytics Setup

## Plan

### Context

DOTORIXEL is in the v0.1.0 milestone and needs an analytics foundation to collect user behavior data for product direction decisions. Set up an analytics tool that tracks page views and custom events while protecting privacy without requiring a cookie banner.

### Analytics Provider: Umami Cloud

**Why Umami over Plausible:**
- **Cost**: Umami Cloud free tier (10K pageviews/month) vs Plausible minimum EUR 9/month. Free tier is appropriate at v0.1.0 stage
- **License**: Umami is MIT, Plausible is AGPL. Less license burden for self-hosting
- **SPA support**: Umami auto-detects History API, no special script variant needed (Plausible requires `script.hash.js`)
- **Escape hatch**: Can migrate to self-hosting if free tier is exceeded (only script URL + website ID change)

No npm package installation needed — loaded via `<script>` tag.

### Implementation Steps

#### 1. Environment Variables

Create `.env.example`:
```sh
# Analytics (Umami Cloud)
# Leave empty to disable analytics (disabled by default in dev)
PUBLIC_UMAMI_WEBSITE_ID=
PUBLIC_UMAMI_SRC=
```

- Substituted at build time via SvelteKit's `$env/static/public`
- Analytics activates only when both values are present
- Set in Vercel dashboard for Production environment only — no code-level `if (dev)` guard needed

#### 2. Analytics Module Structure

```text
src/lib/analytics/
  tracker.ts   — Provider-agnostic tracking abstraction (trackEvent, trackPageView)
  umami.ts     — Umami initialization + window.umami type declaration
  events.ts    — Domain-specific event functions (tool-use, canvas-resize, export-png, etc.)
```

**tracker.ts**: Exports `trackEvent(name, data)` and `trackPageView(url, referrer)` with no-op defaults. `setTracker()` injects the implementation. All calls are automatically no-op when analytics is disabled.

**umami.ts**: Reads environment variables from `$env/static/public`. Exports `isAnalyticsEnabled()` + `initUmami()`. Declares `window.umami` type.

**events.ts**: Custom events specified in todo.md:
- `trackToolUsage(tool)` — on tool switch
- `trackCanvasSize(width, height)` — on canvas resize
- `trackExport(width, height)` — on PNG export
- `trackEditorOpen(editor)` — on editor page load (includes device/platform info)
- `trackSessionEnd(durationSeconds)` — on session end

All events include `locale` property.

**Design principle**: `EditorState` class has no knowledge of analytics. Tracking calls occur only in page components (boundary) — adhering to "core logic is self-contained" principle.

#### 3. Script Injection — `+layout.svelte`

Conditional Umami script injection via `<svelte:head>`:

```svelte
{#if analyticsEnabled}
  <svelte:head>
    <script defer src={PUBLIC_UMAMI_SRC} data-website-id={PUBLIC_UMAMI_WEBSITE_ID}></script>
  </svelte:head>
{/if}
```

- Uses `<svelte:head>` instead of `app.html`: enables `$env` system access
- When `analyticsEnabled` is false, `<script>` tag is not rendered at all
- `data-auto-track` enabled by default — automatic SPA navigation tracking

#### 4. Editor Page Event Integration

**Modify `pebble/+page.svelte` and `pixel/+page.svelte`:**

- Call `trackEditorOpen()` in `onMount` (device info sent once)
- Watch `editor.activeTool` via `$effect` — `trackToolUsage()` (skip initial value)
- Wrap export callback — `trackExport()`
- Wrap resize callback — `trackCanvasSize()`
- Compute session end duration in `onMount` return — `trackSessionEnd()`

#### 5. CSP Headers — `vercel.json`

Add CSP to allow analytics script from external domain:

```json
"headers": [
  {
    "source": "/(.*)",
    "headers": [
      {
        "key": "Content-Security-Policy",
        "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval' https://cloud.umami.is; connect-src 'self' https://cloud.umami.is; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; worker-src 'self' blob:"
      }
    ]
  }
]
```

Key directives:
- `script-src 'wasm-unsafe-eval'`: Required for `WebAssembly.instantiate()` in Chrome 95+ (used by wasm-bindgen's `init()`)
- `script-src https://cloud.umami.is`: Allow Umami script
- `connect-src`: Allow Umami beacon transmission
- `style-src 'unsafe-inline'`: Required for Svelte inline style attributes (`style="padding: 0;"` etc.)
- `img-src blob: data:`: Required for canvas export blob URLs

#### 6. Multi-Locale URL Handling

Paraglide generates locale-specific URLs like `/ko/pebble`, `/ja/pebble`. Umami records these as separate pages, which is desirable at this stage:
- Locale distribution visible naturally
- Small number of unique pages (landing + 2 editors x 3 locales = 9 URLs)
- Custom events include `locale` property for per-locale event analysis

URL normalization can be added later if needed.

### File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `.env.example` | Create | Document environment variables |
| `src/lib/analytics/tracker.ts` | Create | Provider-agnostic tracking abstraction |
| `src/lib/analytics/umami.ts` | Create | Umami initialization + type declaration |
| `src/lib/analytics/events.ts` | Create | Domain-specific event functions |
| `src/routes/+layout.svelte` | Modify | Script injection + initUmami() |
| `src/routes/pebble/+page.svelte` | Modify | Add event tracking calls |
| `src/routes/pixel/+page.svelte` | Modify | Add event tracking calls |
| `vercel.json` | Modify | Add CSP headers |

### Prerequisites (Independent of Implementation)

Create Umami Cloud account -> add site -> obtain website ID + script URL -> set as Vercel dashboard Production environment variables. Can be done in parallel with code implementation; required for verification.

### Verification

1. **Dev environment (no env vars)**: `bun run dev` -> no Umami script tag, no console errors, app works normally
2. **Dev environment (with env vars)**: Set test values in `.env.local` -> script loads, page view beacons fire on navigation
3. **Custom events**: Switch tools, resize canvas, export PNG in editor -> verify event data in Umami dashboard
4. **CSP headers**: After Vercel deployment, check response headers, no CSP violations, WASM loading normal, canvas export normal
5. **SPA navigation**: Navigate `/` -> `/pebble` -> `/pixel`, verify each page view recorded
6. **Production build**: `bun run build && bun run preview` — verify same behavior

## Results

| File | Description |
|------|-------------|
| `.env.example` | Documents `PUBLIC_UMAMI_WEBSITE_ID` and `PUBLIC_UMAMI_SRC` env vars |
| `src/lib/analytics/tracker.ts` | Provider-agnostic tracking abstraction: `trackEvent()` with no-op default, `setTracker()` for implementation injection |
| `src/lib/analytics/umami.ts` | Umami-specific init: `isAnalyticsEnabled()`, `getUmamiConfig()`, `initUmami()`, `window.umami` type declaration |
| `src/lib/analytics/events.ts` | Domain-specific event functions: tool-use, canvas-resize, export-png, editor-open, session-end |
| `src/routes/+layout.svelte` | Programmatic Umami script injection via `document.createElement('script')` + `initUmami()` call |
| `src/routes/pebble/+page.svelte` | Event tracking: editor open, tool usage, canvas resize, export, session duration |
| `src/routes/pixel/+page.svelte` | Same event tracking as pebble |
| `vercel.json` | CSP headers: `script-src 'wasm-unsafe-eval'`, Umami domain allowlist, inline styles, blob/data URLs |

### Key Decisions

- **Umami Cloud over Plausible**: Free tier (10K pageviews/month), MIT license, automatic SPA tracking via History API
- **`$env/dynamic/public` over `$env/static/public`**: `static/public` requires named exports to exist at build time — fails when env vars are absent. `dynamic/public` uses Record access, gracefully returning `undefined` for missing keys
- **Programmatic script injection over `<svelte:head>`**: Svelte 5 disallows `<svelte:head>` inside `{#if}` blocks. `document.createElement('script')` in `$effect` with cleanup function is the alternative
- **Removed `trackPageView` from plan**: Umami auto-tracks page views via `data-auto-track`. The planned abstraction was unused dead code

### Notes

- Umami Cloud account setup + Vercel env var configuration required before analytics is active in production
- CSP headers are added for the first time — verify WASM loading, inline styles, and blob URLs work correctly after Vercel deployment
- `navigator.platform` (deprecated API) used in `trackEditorOpen` for device info — acceptable for analytics, may be replaced later
