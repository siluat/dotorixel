# 056 — Design: Canvas Resize UX

## Plan

### Context

The canvas resize feature needs two UX improvements:
1. **Anchor direction selector** — Currently resize always anchors to top-left. A 3×3 grid is needed so users can choose the anchor position.
2. **Validation alert** — Currently out-of-range input is silently clamped. An inline alert is needed to inform users of the valid range.

This task adds designs to the `.pen` file only (no code changes).

### Target File

- `docs/pencil-dotorixel.pen`

### Design Plan

#### 1. New Exploration Frame

Create a new exploration frame **"Canvas Resize UX"** without modifying existing frames.

Contents:
- **Row 1**: Anchor Direction Selector — Mobile + Desktop variants, 3 states each
- **Row 2**: Validation Alert — Mobile + Desktop variants, error message variants
- **Row 3**: Integrated preview — Both components inserted into the existing Canvas Size section

#### 2. Anchor Direction Selector Spec

3×3 grid. Each cell contains a directional arrow icon. Default selection: top-left (backward compatible).

| Property | Mobile | Desktop |
|----------|--------|---------|
| Cell size | 36×36px | 24×24px |
| Cell gap | 4px | 2px |
| cornerRadius | 6px | 4px |
| Grid total size | 116×116px | 76×76px |
| Icon size | 14×14 | 12×12 |

Cell states:

| State | Fill | Icon color |
|-------|------|------------|
| Default | `$--bg-hover` | `$--text-tertiary` |
| Selected | `$--accent` | `#FFFFFF` |

States to design: top-left selected, center selected, bottom-right selected

Label: "Anchor" — Inter, 12px (mobile) / 11px (desktop), `$--text-secondary`

#### 3. Validation Alert Spec

Inline error bar. Displayed when input value is outside [1, 128] range.

| Property | Mobile | Desktop |
|----------|--------|---------|
| cornerRadius | 8px | 4px |
| padding | 10px 12px | 6px 8px |
| Font | Inter 12px | Inter 10px |
| Icon | 14×14 | 12×12 |

Visual treatment:
- Background: `#EF444415` (danger at 8% opacity)
- Left accent bar: 3px, `$--danger` (#EF4444)
- Text/icon: `$--danger`

Message example: "Valid range: 1 – 128"

#### 4. Placement Order within Canvas Size Section

Inserted after existing elements:

1. Section title "Canvas Size" (existing)
2. Preset buttons (existing)
3. Custom W×H inputs (existing)
4. **Validation alert** (NEW — conditionally visible)
5. **"Anchor" label** (NEW)
6. **Anchor 3×3 grid** (NEW)

#### 5. Work Sequence

1. Create new exploration frame
2. Anchor grid component — Mobile, 3 states
3. Anchor grid component — Desktop, 3 states
4. Validation alert — Mobile error variants
5. Validation alert — Desktop error variants
6. Integrated preview (Mobile + Desktop)
7. Verify with screenshots

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | Added "Canvas Resize UX" exploration frame with anchor selector + validation alert designs; applied anchor grid to all Editor frame settings panels |

### Key Decisions

- Validation alert: chose Variant B (input border highlight + helper text) over hint-text-only (A) and soft chip (C) — most informative, highlights the specific invalid field
- Error color: `#B0503A` (warm terracotta) instead of `#EF4444` — blends naturally with the Pebble UI earth-tone palette
- Anchor grid cell sizes: 36×36px mobile / 24×24px desktop — matches existing component sizing patterns per breakpoint
- Exploration frame placed between current-feature Editors and Animation Editors for logical navigation order

### Notes

- Anchor grid applied to all 7 Editor settings panels (Desktop Light/Dark, iPad, Medium Tablet equivalents, Mobile Settings)
- [Ref] frames were not modified (reference only, per project convention)
- The validation alert is shown only in the exploration frame and integrated preview — not applied to Editor frames since it's a conditional (error-only) state
