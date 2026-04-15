---
title: Landing page UI — hero, features, roadmap (web)
status: open
created: 2026-04-15
---

## Problem Statement

The current landing page at `/` is a minimal hero-only surface: app title, tagline, one-line description, CTA. It does not communicate what DOTORIXEL actually is, what it can do, or where it is headed. A visitor arriving without prior context has no reason to click "Start Drawing" rather than close the tab.

Design 046 (completed) redesigns the landing page with three cohesive sections — Hero (with editor mockup), Features (3 cards), Roadmap (3 cards) — so that the page doubles as a product introduction: a first-time visitor understands what the tool does, sees a preview of it, and learns what's coming next, all before deciding to try it.

## Solution

Implement the 046 design as a static, server-rendered SvelteKit page, replacing the current minimal landing page while preserving existing behaviors (locale routing, CTA target, language navigation).

Visitors see:
- A Hero section with app title, tagline, description, CTA button, and an editor mockup image below the CTA.
- A Features section with three cards describing what the editor does today (Browser-Based, Drawing Tools, Auto-Save).
- A Roadmap section with three cards previewing what is planned (Layers & Animation, Integrations, Offline App).
- A top-right GitHub icon linking to the source repository.

The page is fully translated for EN/KO/JA and adapts between a mobile and desktop layout at 600px.

## Key Scenarios

1. Visitor opens `/` on a desktop browser (≥600px) → sees Hero (title, tagline, description, CTA, editor mockup), Features section with 3 cards in a horizontal row, and Roadmap section with 3 cards in a horizontal row.
2. Visitor opens `/` on a mobile browser (<600px) → sees the same content in a single-column layout with a mobile-variant editor mockup image.
3. Visitor clicks "Start Drawing" → navigates to `/editor` (locale-preserving, unchanged from current behavior).
4. Visitor clicks the Korean language link from `/` → full page reload, content re-renders in Korean at `/ko/`, all 14 new strings (section titles, card titles, card descriptions) render in Korean.
5. Visitor clicks the GitHub icon → opens `https://github.com/siluat/dotorixel` in a new tab; the landing page remains open in the original tab.
6. Visitor with an assistive tech reaches the GitHub icon → announces "GitHub repository, link" (aria-label).
7. Visitor with an assistive tech reaches the editor mockup image → the image is skipped (empty alt, decorative).
8. Browser on desktop receives only the desktop WEBP; browser on mobile receives only the mobile WEBP (no wasted download).
9. On a viewport between 390px and 600px (narrow tablet/large phone) → mobile layout renders, mobile mockup image is centered with natural margin.
10. On a viewport wider than 1440px → content sections are centered with a bounded max-width rather than stretching edge-to-edge.

## Implementation Decisions

### Page structure

- **Single file**: `src/routes/+page.svelte` holds the full page markup, scoped styles, and card data arrays. No new component files. (Rationale: all content is landing-page-only; extracting a `FeatureCard` component would create a shallow abstraction with one consumer. Revisit if the card pattern is reused elsewhere later.)
- **Sections**: Nav (language links + GitHub icon), Hero (title, tagline, description, CTA, editor mockup), Features (section title + 3 cards), Roadmap (section title + 3 cards). Vertical stack in document order.
- **Cards rendered via `{#each}`**: Feature cards and roadmap cards each defined as a typed array of `{ icon, titleKey, descKey }`; template iterates. Identical card markup reused for both sections.

### Editor mockup

- **Format**: WEBP at 2x scale, exported from `.pen` nodes `pUHZw` (desktop) and `sZisd` (mobile) via `mcp__pencil__export_nodes`.
- **Storage**: `static/landing/editor-mockup-desktop.webp`, `static/landing/editor-mockup-mobile.webp` — served directly by SvelteKit static adapter at `/landing/…`.
- **Delivery**: `<picture>` element with `<source media="(min-width: 600px)" srcset="…desktop.webp">` plus `<img src="…mobile.webp" alt="">`. Browser picks one; no runtime JS required.
- **Accessibility**: `alt=""` — the mockup is decorative; the preceding H1 + tagline already convey product identity.
- **Dark mode**: Out of scope for this task. The mockup image is light-only. Dark mockup variant is a follow-up when the dark-mode toggle UI ships (`todo.md` review backlog item).

### Responsive layout

- **Breakpoint**: `min-width: 600px` (aligned with `--ds-bp-medium` token value). One transition between two design states.
- **Below 600px**: Single-column cards, mobile mockup image, smaller typography (app title 36px, tagline 18px).
- **≥600px**: Three-column card rows, desktop mockup image, larger typography (app title 48px, tagline 22px).
- **Max content width**: ~1200px centered (matches design's Features section inner width of 1440 − 2×120 = 1200). Prevents awkward stretching on ultra-wide screens.
- **No mid-range breakpoint**: Intermediate viewports (e.g., 1024px) naturally scale the desktop layout. Design 046 defines no intermediate state.

### GitHub icon

- **Inline SVG** hard-coded in the template (single icon, no library dependency). Uses `fill="currentColor"` so CSS `color` controls tint.
- **Attributes**: `href="https://github.com/siluat/dotorixel"`, `target="_blank"`, `rel="noopener noreferrer"`, `aria-label="GitHub repository"`.
- **Position**: Right side of nav bar, after language links, with a fixed gap. Hover state darkens the icon color (reuse existing link hover pattern).

### Internationalization

- **14 new flat keys** added to `messages/{en,ko,ja}.json`, all prefixed `landing_`:
  - Section: `landing_section_features`, `landing_section_roadmap`
  - Features: `landing_feature_browser_title`, `landing_feature_browser_desc`, `landing_feature_tools_title`, `landing_feature_tools_desc`, `landing_feature_autosave_title`, `landing_feature_autosave_desc`
  - Roadmap: `landing_roadmap_layers_title`, `landing_roadmap_layers_desc`, `landing_roadmap_integrations_title`, `landing_roadmap_integrations_desc`, `landing_roadmap_offline_title`, `landing_roadmap_offline_desc`
- **Single-key descriptions** (no explicit `\n`). CSS relies on natural text wrapping inside the card width. Preserves readability across EN (longer) / KO / JA (shorter) translations.
- **English copy** comes from design 046. Korean and Japanese drafts written during implementation, submitted for user review before commit.

### CTA & behavior preservation

- CTA text: reuses existing `m.landing_cta()` ("Start Drawing" / "그리기 시작" / "描き始める").
- CTA target: `localizeHref('/editor')` — unchanged.
- Language navigation: existing pattern preserved (`data-sveltekit-reload`, current locale bold, others linked).

### Styling

- **Design tokens only** — all colors, spacing, radii, typography via `--ds-*` CSS variables. No hard-coded hex colors or pixel values that exist as tokens.
- **Scoped `<style>` block** in `+page.svelte`. No separate CSS file (standard project pattern).
- **Card background**: `var(--ds-bg-surface)`, radius 12px, padding 32px desktop / 24px mobile, gap 16px / 12px.
- **Icon container**: 44×44px circle (40×40 mobile), `background: var(--ds-accent-subtle)`, accent-colored icon.

## Testing Decisions

### Principles

- **Test behaviors, not implementation** (`testing.md`). Assert on user-visible outcomes (section title text, link targets, card counts), not CSS classes or Svelte component trees.
- **Don't test the framework**. Trust Paraglide's key resolution and SvelteKit's routing; test the inputs we control (JSON keys) and observable outputs (rendered text).
- **Prioritize regression defense**. Landing page is the project's public entry point; a silent rendering break here is high-impact.

### Test plan — E2E (`e2e/landing.test.ts`)

**Keep all 9 existing tests** (locale rendering, language nav, CTA href). The H1/tagline/CTA selectors remain valid with the new design.

**Add 5–6 new tests:**

1. Features section renders with 3 cards — section title visible + 3 card titles visible on `/`.
2. Roadmap section renders with 3 cards — section title visible + 3 card titles visible on `/`.
3. GitHub link points to repo and opens in new tab — `href`, `target`, `rel` attributes assertion.
4. Editor mockup image renders — verify the `<img>` inside `<picture>` loads successfully (no 4xx).
5. Korean locale translates section titles — visit `/ko/`, assert section titles render in Korean (spot-check, not exhaustive per-card).
6. Japanese locale translates section titles — visit `/ja/`, same pattern.

### Not tested (deliberate)

- **Per-card translations in all locales**: Exhaustive string-by-string testing is low signal once the key wiring is confirmed via spot-check. Paraglide's compile-time key validation provides additional safety.
- **Responsive layout at specific viewports**: Playwright can simulate viewports but adds complexity. Visual review catches layout regressions in practice; add only if regressions occur.
- **Visual regression (screenshot diff)**: Font rendering and antialiasing make these brittle. Cost > value for the first iteration.
- **Component tests (Vitest)**: No reusable component is extracted, so there is no unit under test beyond the page itself.

### Prior art

- Existing `e2e/landing.test.ts` pattern (9 tests) — new tests follow the same structure: `page.goto(url)` → `expect(locator).toHaveText(…)` or `toHaveAttribute(…)`.

## Rejected Alternatives

- **HTML/CSS editor mockup replica**: Fully rebuilding the editor mockup in markup + CSS. Rejected: adds ~200 lines of one-off code, creates a maintenance burden (must stay in sync with real editor UI changes), and provides no functional gain for a decorative asset.
- **Simplified CSS mockup (abstract pixel-grid illustration)**: Rejected as a middle-ground that feels unfinished — loses the product-preview value without meaningfully reducing complexity.
- **Single mockup image scaled across viewports**: Rejected because the desktop mockup's detail (right panel, 5-tool toolbar) becomes illegible on mobile, and the mobile mockup looks thin/low-detail on desktop. The design provides two frames for a reason.
- **`FeatureCard.svelte` component extraction**: Rejected per CLAUDE.md ("Don't create helpers for one-time operations"). Revisit when a second consumer appears.
- **PNG format**: Rejected in favor of WEBP — `export_nodes` supports both, WEBP is 30–40% smaller with equivalent quality, browser support is universal for the page's target audience.
- **SVG format**: Rejected due to uncertain fidelity of `.pen` → SVG export (custom fonts, nested frames, text-as-path rendering). PNG/WEBP is deterministic.
- **4-tier responsive implementation**: Rejected — design defines only 2 states; synthesizing intermediate `wide`/`x-wide` layouts would be speculative.
- **Inline `\n` in description keys + `white-space: pre-line`**: Rejected — forces English-length line breaks onto shorter Korean/Japanese translations. Natural wrap adapts.
- **`lucide-svelte` package for the GitHub icon**: Rejected — single icon on the page, dependency overhead is disproportionate. Inline SVG is lighter.
- **Dark mode variant of the mockup image**: Deferred to the dark-mode toggle task. Shipping a dark variant now is untestable (no UI to switch into dark mode).

## Out of Scope

- **Dark mode toggle UI** — separate review-backlog task.
- **Dark mockup image variant** — follows the dark-mode toggle.
- **OG image / meta tags for social sharing** — worth doing but orthogonal; separate task.
- **Analytics events for CTA / GitHub clicks** — Umami is wired up globally; specific event tracking is a follow-up.
- **Performance instrumentation (LCP / CLS measurements)** — standard Vercel insights cover this.
- **CTA copy or target changes** — preserves current behavior.
- **Feature guide page** — listed separately in Milestone 3.
- **Landing page A/B experiments** — no experimentation infrastructure exists.

## Further Notes

- **Korean/Japanese translations**: Drafted during implementation using design 046's English copy as the source. User (Korean native) reviews both before commit; no translation tooling is being introduced for this task.
- **Image regeneration**: When the real editor UI changes significantly, the mockup images need re-export. This is a known manual step — documented inline in a code comment near the `<picture>` tag.
- **Max-width container**: The design's 1440px frame width with ~120px horizontal padding implies a ~1200px content band. Implemented via a `max-width: 1200px; margin-inline: auto` wrapper on content sections. Adjust if visual review suggests otherwise.
- **No deep module emerges from this work**. This is primarily a presentation-layer page implementation; the test of the work is visual correctness and locale coverage, not algorithmic isolation. Noted honestly per the PRD template's expectation that we consider deep modules.
