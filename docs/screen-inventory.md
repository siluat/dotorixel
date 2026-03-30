# Screen Inventory and Breakpoint Matrix

> Reference document for Milestone 2 — Production UI.
> Design source of truth: `pencil-dotorixel.pen` (Pencil.dev)
> Created: 2026-03-30

This document defines the responsive breakpoints and maps every screen/view in the application to its layout behavior at each breakpoint. Subsequent M2 tasks (design system finalization, editor layout restructure) should use this as their scope boundary.

## 1. Breakpoint Definitions

Mobile-first CSS with four layout tiers. Breakpoints align with SwiftUI size class boundaries (compact/regular at 600pt) and pen file design resolutions.

| Token | CSS Pattern | Min Width | Reference Device | Rationale |
|---|---|---|---|---|
| `compact` | Base (no query) | 0 | iPhone 14 (390px) | Pen file mobile frames. SwiftUI compact width. |
| `medium` | `@media (min-width: 600px)` | 600px | iPad Mini (744px) | SwiftUI regular width transition. Covers large phones in landscape. |
| `wide` | `@media (min-width: 1024px)` | 1024px | iPad landscape / laptop | Pen file iPad frame (1024×768). Transition to docked panel layout. |
| `x-wide` | `@media (min-width: 1440px)` | 1440px | Desktop monitor | Pen file Desktop frame (1440×900). Full panel widths. |

**CSS custom properties** (to be defined in implementation):

```css
/* Token references — not implemented yet, for future use */
--bp-medium: 600px;
--bp-wide: 1024px;
--bp-x-wide: 1440px;
```

**Supersedes** the preliminary suggestion in `docs/research/touch-mobile-analysis.en.md` (mobile <640px, tablet 640–1024px, desktop >1024px). The 600px boundary is chosen to match SwiftUI's compact/regular threshold exactly.

## 2. Screen Inventory

### 2.1 Application Routes

| Route | Screen | Responsive | Notes |
|---|---|---|---|
| `/` | Landing Page | Yes (all breakpoints) | Hero section, CTA, language nav |
| `/pebble` | Pebble Editor | Yes (all breakpoints) | Production pixel art editor |
| `/pixel` | Pixel Editor | No (desktop only) | Legacy retro grid UI. Being replaced by Pebble. |
| `/bench` | Benchmark | No (dev only) | Canvas2D performance measurement |

### 2.2 Pebble Editor Views

Each view corresponds to a pen file frame. Theme (dark/light) is orthogonal to breakpoints — the same layout applies regardless of theme.

| View | Pen Frame ID | Resolution | Breakpoint Tier | Description |
|---|---|---|---|---|
| Editor — Desktop Dark | `bi8Au` | 1440×900 | x-wide | Full editor: top bar, left toolbar, canvas, right panel (colors/layers/settings), status bar |
| Editor — Desktop Light | `I1tLL` | 1440×900 | x-wide | Same layout as Desktop Dark, light theme |
| Editor — iPad | `dbGwo` | 1024×768 | wide | Condensed docked panels: narrower right panel, smaller toolbar and status bar |
| Editor — Mobile Draw | `sVwpC` | 390×844 | compact | Full-screen canvas with tool strip, color bar, and bottom tab bar (Draw / Colors / Layers / Settings) |
| Editor — Mobile Colors | `0NVan` | 390×844 | compact | Colors tab active: HSV picker, opacity slider, saved colors grid |
| Editor — Mobile Layers | `Bsv9a` | 390×844 | compact | Layers tab active: layer list with thumbnails, visibility toggles, blend modes |
| Editor — Mobile Settings | `aJKh8` | 390×844 | compact | Settings tab active: canvas size, background color, grid options, export, version info |

**Note on `medium` tier:** No dedicated pen file frame exists for the medium (600–1023px) range. This tier uses the current Pebble editor's floating panel approach — full-screen canvas with floating overlay panels. The existing `pebble/+page.svelte` layout is closest to this tier.

### 2.3 Future Views (M3–M4 scope, not in M2 implementation)

| View | Pen Frame ID | Resolution | Description |
|---|---|---|---|
| Animation Workspace | `00B7W` | 1440×900 | Desktop editor with timeline panel, animation-specific right panel |
| Layers + Animation | `1itxU` | 1440×900 | Integrated layer × frame grid timeline |

These views are designed for desktop only. Responsive variants will be defined when M3/M4 are scoped.

## 3. Layout Matrix — Pebble Editor

### 3.1 Structural Layout

How the overall editor structure changes across breakpoints.

| UI Element | compact (<600px) | medium (600–1023px) | wide (1024–1439px) | x-wide (1440px+) |
|---|---|---|---|---|
| Overall layout | Vertical stack + tab navigation | Full-screen canvas + floating panels | Top bar + left toolbar + canvas + right panel + status bar | Same as wide, wider panels |
| Navigation model | Bottom tab bar (4 tabs) | No tab bar (all panels accessible) | No tab bar (all panels docked) | No tab bar |
| Top bar | App bar: logo + undo/redo + menu | App bar: logo + undo/redo + menu | Full top bar: logo, menus, mode badge, undo/redo, export | Full top bar |
| Left toolbar | Hidden (tools in bottom strip) | Hidden (tools in floating panel) | Docked vertical strip (44px) | Docked vertical strip (48px) |
| Canvas area | Full viewport minus bars | Full viewport minus floating panels | Between toolbar and right panel | Between toolbar and right panel |
| Right panel | Tab screens (full-screen per tab) | Collapsible floating panel | Docked panel (200px) | Docked panel (240px) |
| Bottom area | Tool strip + color bar + tab bar | Floating tool/color panels | Hidden (integrated into panels) | Hidden |
| Status bar | Hidden | Hidden | Visible (28px) | Visible (32px) |

### 3.2 Component-Level Behavior

How each Pebble UI component maps to the layout.

| Component | compact (<600px) | medium (600–1023px) | wide (1024–1439px) | x-wide (1440px+) |
|---|---|---|---|---|
| `TopControlsLeft` | In app bar (undo/redo only) | In app bar (undo/redo + grid toggle) | In top bar | In top bar |
| `TopControlsRight` | Canvas presets → Settings tab; export → overflow menu | Floating panel (top-right) | In top bar actions area | In top bar actions area |
| `BottomToolsPanel` | Tool strip (full-width, 48px, 44px min touch targets) | Floating pill panel (bottom-center) | Absent (tools in left toolbar) | Absent |
| `BottomColorPalette` | Color bar (swatches only) + Colors tab for full picker | Floating panel (bottom-center, below tools) | In right panel "Colors" section | In right panel "Colors" section |
| `FloatingPanel` | Not used (native bars replace panels) | Active (tools, colors, optionally settings) | Not used (docked panels) | Not used |
| Canvas presets | In Settings tab | In `TopControlsRight` floating panel | In top bar | In top bar |
| Grid toggle | In app bar | In app bar | In top bar | In top bar |
| Zoom controls | In tool strip (pinch-zoom primary) | In floating tool panel + pinch-zoom | In status bar + scroll-zoom | In status bar + scroll-zoom |
| Layer list | Full-screen Layers tab | In floating panel or right panel | In right panel | In right panel |
| Color picker | Full-screen Colors tab (HSV + swatches) | Popup from floating palette | In right panel | In right panel |

### 3.3 Key Layout Transitions

The editor has three fundamentally different layout paradigms, not merely "hiding panels":

1. **compact** — **Tab navigation model.** Canvas is one tab, other panels are separate full-screen tabs. A bottom tab bar provides navigation. This is a mobile app pattern.

2. **medium** — **Floating panel model.** Canvas fills the screen. UI controls overlay as floating, draggable/dismissible panels. This is the current Pebble editor approach and works naturally for tablets.

3. **wide / x-wide** — **Docked panel model.** Traditional desktop app layout with fixed sidebars, toolbar, and status bar. Panels are part of the document flow, not overlays. This matches the pen file desktop/iPad designs.

## 4. Layout Matrix — Landing Page

| Element | compact (<600px) | medium (600–1023px) | wide (1024px+) |
|---|---|---|---|
| Language nav | Top center, 12px | Top center, 13px | Top center, 14px |
| App name (h1) | 32px, centered | 40px, centered | 48px, centered |
| Tagline | 16px, max-width: 320px | 18px, max-width: 380px | 20px, max-width: 420px |
| Description | 14px, max-width: 300px | 15px, max-width: 380px | 16px, max-width: 420px |
| CTA button | Full-width, padding: 14px 24px | Auto-width, padding: 14px 32px | Auto-width, padding: 14px 32px |
| Bottom spacing | 48px | 64px | 80px |

## 5. Pen File Cross-Reference

Maps pen file frame IDs to this document's screen inventory.

| Pen Frame ID | Frame Name | Inventory Reference | Section |
|---|---|---|---|
| `bi8Au` | DOTORIXEL — Dark Mode | Editor — Desktop Dark | §2.2 |
| `I1tLL` | DOTORIXEL — Light Mode | Editor — Desktop Light | §2.2 |
| `dbGwo` | DOTORIXEL — iPad Dark | Editor — iPad | §2.2 |
| `sVwpC` | DOTORIXEL — Mobile Dark | Editor — Mobile Draw | §2.2 |
| `0NVan` | DOTORIXEL — Mobile Colors | Editor — Mobile Colors | §2.2 |
| `Bsv9a` | DOTORIXEL — Mobile Layers | Editor — Mobile Layers | §2.2 |
| `aJKh8` | DOTORIXEL — Mobile Settings | Editor — Mobile Settings | §2.2 |
| `00B7W` | DOTORIXEL — Animation Workspace | Animation Workspace (M4) | §2.3 |
| `1itxU` | DOTORIXEL — Layers + Animation | Layers + Animation (M3–M4) | §2.3 |

## 6. Design Token Gap Analysis

The pen file uses a comprehensive variable system with dark/light theme support. Current CSS tokens are fragmented across three files. This section identifies gaps for the "Design system finalization" task.

### Pen File Variables (18 semantic tokens)

```text
--bg-base, --bg-surface, --bg-elevated, --bg-hover, --bg-active
--border, --border-subtle
--text-primary, --text-secondary, --text-tertiary
--accent, --accent-subtle, --accent-text
--canvas-bg, --pixel-grid
--danger, --success, --warning
```

### Current CSS Tokens

| File | Scope | Token Count | Coverage |
|---|---|---|---|
| `src/styles/global.css` | `:root` | 7 Pebble brand colors | Basic brand palette only |
| `src/lib/ui-pebble/pebble-tokens.css` | `.pebble-editor` | 10 component tokens | Panel/button styling only |
| `src/lib/ui-pixel/pixel-tokens.css` | `.pixel-editor` | 19 color + spacing + typography | Legacy system, not aligned with pen file |

### Gaps

1. **No semantic surface hierarchy** — pen file has `bg-base` / `bg-surface` / `bg-elevated` / `bg-hover` / `bg-active`. Current CSS has only `--pebble-panel-bg` and `--pebble-btn-bg`.
2. **No text hierarchy** — pen file has `text-primary` / `text-secondary` / `text-tertiary`. Current CSS has `--pebble-text-primary` / `--pebble-text-secondary` / `--pebble-text-muted` (close but not aligned in naming or values).
3. **No dark/light theme switching** — pen file supports theme axis `{ mode: ["dark", "light"] }`. Current CSS has no theme mechanism.
4. **No responsive tokens** — no breakpoint custom properties, no responsive spacing or typography scales.
5. **Spacing scale** — only exists in pixel-tokens.css (2–48px, 8 levels), not in Pebble tokens.

These gaps will be addressed by the "Design system finalization" task (next M2 design task).

## 7. Implementation Notes

### Task Dependencies

```text
040 Screen inventory (this document)
 └─ 041 Design system finalization (tokens, components, patterns)
     └─ 042 Editor UI design — current features
         └─ 043 Editor UI design — layer/animation expansion
             └─ 044 Validate against references
```

### Ordering Constraints

- Breakpoint values defined here must be established before any responsive CSS is written.
- The layout matrix is the specification for "Editor layout restructure" (implementation task).
- Design token gaps identified in §6 feed into "Design system finalization".
- Future views (§2.3) are scoped to M3/M4 — do not implement responsive variants in M2.

### Touch Target Requirements

Per `touch-mobile-analysis.en.md` and Apple HIG:
- Minimum touch target: **44×44px** on compact and medium tiers.
- Tool strip buttons, color swatches, and tab bar items must meet this minimum.
- The left toolbar on wide/x-wide can use smaller visual icons (18px) but should maintain 44px hit areas via padding.
