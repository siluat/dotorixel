# 040 — Screen Inventory and Breakpoint Matrix Definition

## Plan

Define the responsive breakpoint system and create a comprehensive screen inventory for DOTORIXEL. This is the first design task of Milestone 2 (Production UI) and establishes the scope boundary for all subsequent design and implementation work.

### Deliverable

`docs/screen-inventory.md` — a reference document containing:

1. **Breakpoint definitions** — Four tiers (compact/medium/wide/x-wide) aligned with SwiftUI size classes and pen file design resolutions
2. **Screen inventory** — Every route and view, mapped to pen file frames
3. **Layout matrix** — UI element behavior at each breakpoint for the Pebble editor and landing page
4. **Design token gap analysis** — Differences between pen file variables and current CSS tokens
5. **Implementation notes** — Task dependencies, ordering constraints, touch target requirements

### Key Decisions

- **600px** as compact/medium boundary (matches SwiftUI compact→regular at 600pt)
- **Three layout paradigms**: tab navigation (compact), floating panels (medium), docked panels (wide/x-wide)
- **medium tier** uses existing Pebble floating panel approach — no dedicated pen file frame needed
- **Future views** (Animation, Layers+Animation) scoped to M3/M4, not M2

## Results

| File | Description |
|------|-------------|
| `docs/screen-inventory.md` | Breakpoint definitions, screen inventory, layout matrices, design token gap analysis |
| `docs/pencil-dotorixel.pen` | Pencil design file with all editor frames (desktop/iPad/mobile) |

### Key Decisions
- 600px compact/medium boundary — matches SwiftUI compact→regular size class threshold exactly
- Three layout paradigms: tab navigation (compact), floating panels (medium), docked panels (wide/x-wide)
- No dedicated pen file frame for medium tier — existing Pebble floating panel approach covers this range
- Landing page responsive matrix uses 3 tiers (compact/medium/wide+) since x-wide adds no layout changes

### Notes
- Pen file variable analysis identified 5 design token gaps (§6) — feeds directly into the next task (design system finalization)
- Future views (Animation Workspace, Layers+Animation) are catalogued but explicitly scoped out of M2
