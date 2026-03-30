# Design System

> Reference document for DOTORIXEL's unified design token system.
> Design source of truth: `pencil-dotorixel.pen` (Pencil.dev)
> Created: 2026-03-30

This document defines the complete design token system — colors, typography, spacing, sizing, and component patterns. It resolves the 5 gaps identified in `docs/screen-inventory.md` §6 and serves as the specification for the "Design system application" implementation task.

## 1. Naming Convention

All design tokens use the `--ds-` prefix:

```text
--ds-{category}-{name}
```

**Categories:** `bg`, `text`, `border`, `accent`, `font`, `space`, `radius`, `shadow`, `bp`

This replaces the fragmented `--pebble-*`, `--color-*` namespaces. Migration is incremental — existing tokens remain functional during the transition.

## 2. Color Tokens

Colors are the foundation of the system. All values sourced from pen file variables with dark/light theme support.

### 2.1 Theme Switching

CSS `data-theme` attribute on the root element:

```css
:root {
  /* Light theme (default) */
  --ds-bg-base: #FDFBF8;
  /* ... */
}

:root[data-theme="dark"] {
  /* Dark theme overrides */
  --ds-bg-base: #0F0D0A;
  /* ... */
}
```

JavaScript toggle: `document.documentElement.dataset.theme = 'dark'`

### 2.2 Surface Colors

Layered depth hierarchy for backgrounds.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--ds-bg-base` | `#FDFBF8` | `#0F0D0A` | App background, canvas surround |
| `--ds-bg-surface` | `#F5F1EB` | `#191510` | Panels, sidebars, toolbars |
| `--ds-bg-elevated` | `#FFFFFF` | `#231D16` | Cards, modals, popups, inputs |
| `--ds-bg-hover` | `#EDE8DF` | `#2D261D` | Interactive element hover state |
| `--ds-bg-active` | `#E5DED4` | `#372E24` | Active/pressed state, selected items |

### 2.3 Text Colors

Three-level hierarchy for content readability.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--ds-text-primary` | `#2D210F` | `#F2EDE5` | Headings, labels, primary content |
| `--ds-text-secondary` | `#7B6D59` | `#A39282` | Descriptions, secondary info |
| `--ds-text-tertiary` | `#A19383` | `#706050` | Placeholders, disabled text, captions |

### 2.4 Border Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--ds-border` | `#D8CFC2` | `#3D3428` | Panel borders, separators |
| `--ds-border-subtle` | `#ECE5D9` | `#2B2420` | Subtle dividers, inner borders |

### 2.5 Accent Colors

Acorn brown — the brand accent.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--ds-accent` | `#B07A30` | `#C4873C` | Primary actions, active states, selections |
| `--ds-accent-subtle` | `#B07A3018` | `#C4873C20` | Accent backgrounds, badges, tags |
| `--ds-accent-text` | `#8D6226` | `#DCA35A` | Accent-colored text on neutral backgrounds |

### 2.6 Status Colors

Semantic colors for feedback. No theme variation — consistent across light/dark.

| Token | Value | Usage |
|---|---|---|
| `--ds-danger` | `#EF4444` | Destructive actions, errors |
| `--ds-success` | `#22C55E` | Success states, confirmations |
| `--ds-warning` | `#F59E0B` | Warnings, caution states |

### 2.7 Editor-Specific Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--ds-canvas-bg` | `#F0ECE5` | `#1C1810` | Canvas area background (behind artwork) |
| `--ds-pixel-grid` | `#D8CFC240` | `#3D342840` | Pixel grid overlay lines |

## 3. Typography Tokens

### 3.1 Font Families

| Token | Value | Usage |
|---|---|---|
| `--ds-font-heading` | `'Galmuri14', monospace` | Section headings, app title |
| `--ds-font-body` | `'Galmuri11', system-ui, sans-serif` | Body text, labels, buttons |
| `--ds-font-mono` | `'GalmuriMono11', monospace` | Code, coordinates, numeric inputs |

### 3.2 Font Sizes

| Token | Value | Usage |
|---|---|---|
| `--ds-font-size-xs` | `10px` | Captions, badges, section headers |
| `--ds-font-size-sm` | `11px` | Secondary labels, tool tips |
| `--ds-font-size-md` | `13px` | Body text, buttons, inputs (default) |
| `--ds-font-size-lg` | `16px` | Panel headings, emphasis |
| `--ds-font-size-xl` | `18px` | Page headings |

## 4. Spacing Scale

8-level scale adopted from pixel-tokens. Powers padding, margins, gaps consistently.

| Token | Value | Common Use |
|---|---|---|
| `--ds-space-1` | `2px` | Tight gaps (icon-to-icon) |
| `--ds-space-2` | `4px` | Inline gaps (icon-to-label) |
| `--ds-space-3` | `8px` | Default gap between sibling elements |
| `--ds-space-4` | `12px` | Panel internal padding (compact) |
| `--ds-space-5` | `16px` | Panel internal padding (default), edge gap |
| `--ds-space-6` | `24px` | Section spacing |
| `--ds-space-7` | `32px` | Large section spacing |
| `--ds-space-8` | `48px` | Page-level spacing |

## 5. Sizing & Shape Tokens

### 5.1 Border Radius

| Token | Value | Usage |
|---|---|---|
| `--ds-radius-sm` | `6px` | Buttons, tags, small elements |
| `--ds-radius-md` | `12px` | Inputs, cards, tool buttons |
| `--ds-radius-lg` | `20px` | Floating panels |
| `--ds-radius-xl` | `28px` | Large floating panels |
| `--ds-radius-full` | `9999px` | Pills, circular buttons |

### 5.2 Shadows

| Token | Value | Usage |
|---|---|---|
| `--ds-shadow-sm` | `0 1px 6px rgba(0, 0, 0, 0.06)` | Buttons, small elevated elements |
| `--ds-shadow-md` | `0 2px 16px rgba(0, 0, 0, 0.07)` | Floating panels, popups |
| `--ds-shadow-lg` | `0 4px 24px rgba(0, 0, 0, 0.10)` | Modals, overlays |

### 5.3 Border Width

| Token | Value | Usage |
|---|---|---|
| `--ds-border-width` | `1px` | Default borders |
| `--ds-border-width-thick` | `2px` | Focus rings, selection indicators |

## 6. Breakpoint Tokens

Reference values — not used as CSS variables in media queries, but documented for consistency with `docs/screen-inventory.md`.

| Token | Value | Tier |
|---|---|---|
| `--ds-bp-medium` | `600px` | Tablet / large phone landscape |
| `--ds-bp-wide` | `1024px` | Desktop / iPad landscape |
| `--ds-bp-x-wide` | `1440px` | Wide desktop |

```css
/* Usage in media queries (values, not var() references) */
@media (min-width: 600px) { /* medium */ }
@media (min-width: 1024px) { /* wide */ }
@media (min-width: 1440px) { /* x-wide */ }
```

## 7. Component Patterns

### 7.1 Button

| Property | Default | Hover | Active | Disabled |
|---|---|---|---|---|
| Background | `--ds-bg-elevated` | `--ds-bg-hover` | `--ds-accent` | `--ds-bg-elevated` (opacity 0.4) |
| Text | `--ds-text-secondary` | `--ds-text-primary` | `#FFFFFF` | `--ds-text-tertiary` |
| Border radius | `--ds-radius-sm` | — | — | — |
| Shadow | `--ds-shadow-sm` | — | — | none |
| Min touch target | 44×44px (compact/medium), relaxed on wide/x-wide | | | |

### 7.2 Floating Panel

| Property | Value |
|---|---|
| Background | `--ds-bg-elevated` (with backdrop blur on supported browsers) |
| Border | 1px `--ds-border` |
| Border radius | `--ds-radius-lg` (default), `--ds-radius-xl` (large panels) |
| Shadow | `--ds-shadow-md` |
| Padding | `--ds-space-3` to `--ds-space-5` depending on content density |
| Edge gap | `--ds-space-5` (16px from viewport edge) |

### 7.3 Input Field

| Property | Default | Focus |
|---|---|---|
| Background | `--ds-bg-elevated` | `--ds-bg-elevated` |
| Border | 1px `--ds-border` | 2px `--ds-accent` |
| Border radius | `--ds-radius-md` | — |
| Text | `--ds-text-primary` | — |
| Placeholder | `--ds-text-tertiary` | — |
| Font | `--ds-font-body`, `--ds-font-size-md` | — |
| Min height | 36px (with 44px touch target on mobile) | — |

### 7.4 Color Swatch

| Property | Default | Selected |
|---|---|---|
| Border radius | `--ds-radius-sm` | — |
| Border | none (1px `--ds-border` for white/light swatches) | 2px `--ds-accent` outline |
| Size (sm) | 24×24px | — |
| Size (lg) | 32×32px | — |
| Min touch target | 44×44px (via padding/spacing on parent) | — |

## 8. Migration Guide

### From `--pebble-*` to `--ds-*`

| Old Token | New Token | Notes |
|---|---|---|
| `--pebble-bg` | `--ds-bg-base` | Pen file `--bg-base` |
| `--pebble-panel-bg` | `--ds-bg-elevated` | Pen file `--bg-elevated` |
| `--pebble-btn-bg` | `--ds-bg-elevated` | Same as panel bg |
| `--pebble-panel-border` | `--ds-border` | Pen file `--border` |
| `--pebble-canvas-stroke` | `--ds-border-subtle` | Pen file `--border-subtle` |
| `--pebble-text-primary` | `--ds-text-primary` | Direct mapping |
| `--pebble-text-secondary` | `--ds-text-secondary` | Direct mapping |
| `--pebble-text-muted` | `--ds-text-tertiary` | Renamed for 3-level hierarchy |
| `--pebble-accent` | `--ds-accent` | Direct mapping |
| `--pebble-accent-dark` | `--ds-accent` (hover state) | Removed as separate token; use darker shade in hover CSS |
| `--pebble-accent-light` | `--ds-accent-subtle` | Pen file `--accent-subtle` |
| `--pebble-panel-radius` | `--ds-radius-lg` | 20px |
| `--pebble-panel-radius-lg` | `--ds-radius-xl` | 28px |
| `--pebble-btn-radius` | `--ds-radius-md` | 12px |
| `--pebble-tool-radius` | `--ds-radius-sm` | Closest match |
| `--pebble-panel-shadow` | `--ds-shadow-md` | Direct mapping |
| `--pebble-btn-shadow` | `--ds-shadow-sm` | Direct mapping |
| `--pebble-font-family` | `--ds-font-body` | Direct mapping |
| `--pebble-font-mono` | `--ds-font-mono` | Direct mapping |
| `--pebble-font-size` | `--ds-font-size-md` | 13px |
| `--pebble-edge-gap` | `--ds-space-5` | 16px |

### From `--color-*` (pixel-tokens) to `--ds-*`

| Old Token | New Token | Notes |
|---|---|---|
| `--color-primary` | `--ds-accent` | Acorn brown accent |
| `--color-bg` | `--ds-bg-base` | Background |
| `--color-surface` | `--ds-bg-surface` | Surface |
| `--color-fg` | `--ds-text-primary` | Foreground text |
| `--color-border` | `--ds-border` | Border |
| `--color-destructive` | `--ds-danger` | Destructive |
| `--space-1` … `--space-8` | `--ds-space-1` … `--ds-space-8` | Direct 1:1 mapping |

### Migration Strategy

Steps 1–4 apply to the Pebble editor only. The Pixel editor (`/pixel`) retains `--color-*` tokens as-is — it is legacy and not being actively developed.

1. **Add** new `--ds-*` tokens alongside existing ones (no breakage).
2. **Alias** old tokens to new ones: `--pebble-panel-bg: var(--ds-bg-elevated)`.
3. **Migrate** components one by one from old to new tokens.
4. **Remove** old Pebble tokens after all references are updated.

## 9. Pen File Cross-Reference

| Pen Variable | CSS Token | Verified |
|---|---|---|
| `--bg-base` | `--ds-bg-base` | Values match |
| `--bg-surface` | `--ds-bg-surface` | Values match |
| `--bg-elevated` | `--ds-bg-elevated` | Values match |
| `--bg-hover` | `--ds-bg-hover` | Values match |
| `--bg-active` | `--ds-bg-active` | Values match |
| `--text-primary` | `--ds-text-primary` | Values match |
| `--text-secondary` | `--ds-text-secondary` | Values match |
| `--text-tertiary` | `--ds-text-tertiary` | Values match |
| `--border` | `--ds-border` | Values match |
| `--border-subtle` | `--ds-border-subtle` | Values match |
| `--accent` | `--ds-accent` | Values match |
| `--accent-subtle` | `--ds-accent-subtle` | Values match |
| `--accent-text` | `--ds-accent-text` | Values match |
| `--danger` | `--ds-danger` | Values match |
| `--success` | `--ds-success` | Values match |
| `--warning` | `--ds-warning` | Values match |
| `--canvas-bg` | `--ds-canvas-bg` | Values match |
| `--pixel-grid` | `--ds-pixel-grid` | Values match |
