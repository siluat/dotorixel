# 008 — UI theme migration — Move Pixel UI to `/pixel` page and switch default to Pebble

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-pixel/pixel-tokens.css` | Pixel design tokens scoped under `.pixel-editor` (extracted from `:root`) |
| `src/lib/ui-pixel/` | Renamed from `src/lib/ui/` — all Pixel components, stories, tokens |
| `src/lib/ui-pixel/DesignTokens.stories.svelte` | Moved from `src/lib/foundations/` into `ui-pixel/` |
| `src/routes/pixel/+page.svelte` | Pixel editor at `/pixel` route |
| `src/routes/+page.ts` | Universal load 307 redirect `/` → `/pebble` |
| `src/routes/+page.svelte` | Minimal empty fallback (redirect handles navigation) |
| `src/styles/global.css` | Trimmed to CSS reset + theme-neutral body |
| `.storybook/preview.ts` | Added `pixel-tokens.css` import |
| `src/lib/ui-pixel/*.stories.svelte` | `class="pixel-editor pixel-story-bg"` wrapper added to all 12 story files |

### Key Decisions

- Universal load redirect (`+page.ts`) — `+page.server.ts` incompatible with `adapter-static` (no runtime server)
- Directory renamed `ui/` → `ui-pixel/` to mirror `ui-pebble/` structure; autotitle handles Storybook grouping
- `--font-size-lg: 18px` token added (was referenced but never defined)

### Notes

- Dev server restart required after structural changes (new routes, CSS import graph changes) — Vite HMR alone doesn't handle module graph restructuring
