---
title: Landing page design improvements
type: design
status: done
created: 2026-04-09
---

## Design Scope

Redesign the landing page in `docs/pencil-dotorixel.pen` to strengthen product introduction. Two frames: Desktop and Mobile (light mode only).

### Sections

1. **Hero** — App name, tagline, description, CTA button (vertical stack layout)
2. **Editor screenshot** — Simplified mockup of the editor UI (not a real screenshot)
3. **Feature highlights** — 4 cards in 2x2 grid (Desktop) / 1-column stack (Mobile):
   - Browser-based (no install)
   - Drawing tools
   - Save & restore work
   - Export

## References

- Current implementation: `src/routes/+page.svelte`
- Design system: `docs/design-system.md`
- Editor .pen file: `docs/pencil-dotorixel.pen` (existing editor designs for mood/tone reference)
- Initial landing page record: `tasks/records/037-landing-page.md`

## Design Plan

- Vertical stack layout: Hero text on top, editor mockup below, feature cards at bottom
- Editor mockup is a simplified illustration, not a screenshot placeholder
- Desktop + Mobile breakpoints only; Tablet naturally scales from Desktop
- Light mode only; Dark mode handled by design token mapping at implementation
- Follow existing editor design tone: warm earth tones, Pebble UI aesthetic, acorn brown accent

## Constraints

- Must use existing design token palette (`--ds-*` variables)
- Content must work for 3 languages (EN/KO/JA) — avoid text-heavy layouts that break with longer translations
- Keep structure simple enough that CSS implementation is straightforward (no complex overlapping layers)

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | Landing Page — Desktop (1440px) and Landing Page — Mobile (390px) frames |

### Key Decisions

- Reduced feature cards from 4 to 3: removed "PNG Export" (too basic for a highlight), kept Browser-Based, Drawing Tools, Auto-Save
- Desktop features: 1-row 3-column layout; Mobile: 1-column stack
- Editor mockup: Desktop shows desktop editor layout (sidebar toolbar + right panel); Mobile shows mobile editor layout (bottom tool strip + color bar)
- Added "Coming Soon" roadmap section with 3 cards: Layers & Animation, Integrations, Offline App
- Added GitHub icon in nav bar next to language links
- Used [Ref] frame heart pixel art (pink-purple gradient) in mockup canvases
- Feature descriptions use humble, factual language matching current product state
