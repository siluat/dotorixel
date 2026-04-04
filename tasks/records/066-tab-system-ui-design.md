# 066 — Design: Tab System UI — Multi-Image Tabs Across All Breakpoints

## Plan

### Context

DOTORIXEL currently supports editing only a single image. As the first step of the M2 multi-image workflow, design an **image tab** UI across all breakpoints that allows opening and switching between multiple images. This .pen design will serve as the reference for the subsequent tab system code implementation.

### Key distinction

- **Existing Tab Bar** (Mobile/Tablet bottom): DRAW / COLORS / LAYERS / SETTINGS → view navigation
- **Image tabs** (this task): Switch between open images → document tabs
- The two are orthogonal — switching image tabs preserves the current view (DRAW/COLORS)

### Design approach

Add a **tab strip row** below the Top Bar / App Bar (IDE/browser pattern):

- Tab item: image name + close button (×)
- Add button (+) at the end
- Active state: `$--bg-elevated` background + `$--accent` bottom 2px indicator
- Inactive state: no background, `$--text-secondary` text

### Breakpoint details

| Breakpoint | Frame | Tab strip height | Placement |
|---|---|---|---|
| Desktop 1440 | Light + Dark | 36px | Below Top Bar |
| iPad 1024 | Landscape | 32px | Below Top Bar |
| Tablet 768 | Medium Tablet | 32px | Below App Bar |
| Mobile 390 | Draw / Colors / Settings | 28px | Below App Bar |

### Frames to update

1. Editor — Desktop Light (`atTXy`)
2. Editor — Desktop Dark (`NyOgp`)
3. Editor — iPad Landscape (`J7plO`)
4. Editor — Medium Tablet (`zOegy`)
5. Editor — Mobile Draw (`A9dne`)
6. Editor — Mobile Colors (`Pe53N`)
7. Editor — Mobile Settings (`yxcOL`)

Animation workspace frames excluded — deferred to M4 timeline work.

### Work order

1. Desktop Light → baseline design
2. Desktop Dark → dark mode verification
3. iPad Landscape → compact version
4. Medium Tablet
5. Mobile Draw / Colors / Settings
6. Screenshot verification across all frames

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | Added image tab strip to all 7 Editor frames |

### Frames updated

| Frame | Tab strip height | Tab count |
|-------|-----------------|-----------|
| Editor — Desktop Light | 36px | 3 tabs + add |
| Editor — Desktop Dark | 36px | 3 tabs + add |
| Editor — iPad Landscape | 32px | 3 tabs + add |
| Editor — Medium Tablet | 32px | 2 tabs + add |
| Editor — Mobile Draw | 28px | 2 tabs + add |
| Editor — Mobile Colors | 28px | 2 tabs + add |
| Editor — Mobile Settings | 28px | 2 tabs + add |

### Key Decisions

- Tab strip placed as a separate row below the Top Bar / App Bar, not integrated within it — avoids crowding existing controls, scales better with many tabs
- Active state uses `$--bg-elevated` + `$--accent` bottom 2px stroke (inside border), inactive uses no background + `$--text-secondary` — visually distinct from the view navigation Tab Bar's pill-shaped accent fill
- No left padding on tab strip — first tab flush against edge; add (+) button immediately follows last tab with no spacer
