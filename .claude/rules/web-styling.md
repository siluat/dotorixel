---
globs: src/**/*.svelte, src/**/*.css, .storybook/**/*.ts
---

# Web Styling Conventions

Rules for styling in the web shell (Svelte + CSS). Design source of truth: `docs/design-system.md` and `pencil-dotorixel.pen` (Pencil.dev).

- **Vanilla CSS only.** No CSS frameworks (Tailwind, UnoCSS, etc.). Component styles use Svelte `<style>` scoped blocks.
- **Design tokens use the `--ds-*` namespace.** Colors, typography, spacing, sizing, shadows, and breakpoints are defined in `src/styles/design-tokens.css` and consumed via `var(--ds-bg-elevated)`, `var(--ds-space-3)`, etc. See `docs/design-system.md` for the full token reference. Legacy `--pebble-*` and `--color-*` tokens are fully deprecated — do not use.
- **Component styles are scoped by default.** Use Svelte's built-in `<style>` scoping. Only extract to a shared CSS file when the same styles are genuinely reused across multiple components.
- **Cross-shell visual parity via shared tokens.** Web and Apple native shells share the same design system. Color palette, spacing scale, typography, and shadow values are mirrored between `src/styles/design-tokens.css` (web) and `apple/Dotorixel/Style/DesignTokens.swift` (Apple, as static `SwiftUI.Color` / `CGFloat` constants). Changes to shared tokens should propagate to both shells.
- **Docked layout structure.** The current UI is a docked layout (TopBar, LeftToolbar, RightPanel, StatusBar around a full-bleed canvas). Legacy Pebble UI (floating panels, warm earth tones) is fully deprecated — do not introduce new floating-panel layouts. Use the component patterns in `docs/design-system.md` §7 (Button, Floating Panel, Input Field, Color Swatch) for individual elements.
- **Responsive layout follows 4 breakpoints.** Tiers: `compact` / `medium` (≥600px) / `wide` (≥1024px) / `x-wide` (≥1440px), implemented via `matchMedia` + CSS Grid/Flex. Touch targets: ≥44×44px on compact/medium. See `docs/screen-inventory.md` for the authoritative breakpoint matrix.
