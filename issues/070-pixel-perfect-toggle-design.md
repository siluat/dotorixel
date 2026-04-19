---
title: Pixel Perfect toggle — visual design (topBar / mAppBar)
status: done
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Finalize the visual design of the Pixel Perfect toggle button as a `.pen` spec. Covers placement (top bar — topBar / mAppBar), ON/OFF/hover/active/disabled states, a **dedicated custom icon** that visually represents the PP concept, and 4-tier responsive coverage (Level B in the parent PRD).

An HITL design stage that defines the UI foundation for the parent PRD's "UI" section and for Scenarios 7, 9, and 11.

## Acceptance criteria

- The PP toggle component's ON / OFF / hover / active / disabled states are specified in the `.pen` file
- A custom icon design that represents the PP concept (e.g., L-corner cleanup / staircase tidying metaphor)
- Placement positions and surrounding element alignment specified for each of 4 tiers (x-wide · wide · medium · compact)
- Design token consistency maintained (same style language as existing topBar / mAppBar elements)
- ko / en / ja label length review (for aria-label / tooltip) — skippable if icon-only
- User review and approval

## Blocked by

None — can start immediately

## Scenarios addressed

- Scenario 7 (toggle click → next stroke reflects change) — UI foundation
- Scenario 9 (persisted state display across sessions) — visual foundation
- Scenario 11 (no effect on Shape tools) — disabled state communicates the visual boundary

## Design outcome

### Placement

**Unified placement principle**: In every tier, between `zoomControls` and `gridBtn` on the top bar (`topBar` on docked / `mAppBar` on compact). The two containers are effectively the same "app top bar" structure (logoSpacer · zoomControls · gridBtn · exportBtn), and PP sits within the **display/mode toggle group**.

| Tier | Container | Container height | Position | Button size | cornerRadius |
|---|---|---|---|---|---|
| x-wide (≥1440) | topBar | 48 | Between `zoomControls` and `gridBtn` | 32×32 | 6 |
| wide (≥1024) — iPad Landscape | topBar | 44 | Same | 36×36 | 6 |
| medium (≥600) | mAppBar | 48 | Same | 36×36 | 6 |
| compact (<600) | mAppBar | 44 | Same | 36×36 | 8 |

**Rationale**:
- The StatusBar placement (draft) was asymmetric with the mAppBar placement on touch tiers, splitting the mental model. "PP is always in the top bar" unifies learning transfer across tiers (learnability).
- Top bar internal order `[logoSpacer][zoomControls][pp][gridBtn][exportBtn]` — PP belongs to the "drawing-mode toggles" group alongside `gridBtn` (grid display toggle). `exportBtn` (action) stays isolated at the end.
- Button sizes match each tier's surrounding buttons (zoomControls, gridBtn, exportBtn) to preserve visual rhythm (desktop 32px / others 36px).

Touch tiers (wide iPad / medium / compact) use a 36×36 button that matches existing top bar buttons, and with surrounding padding they satisfy `Touch targets: ≥44×44px`.

### Icon

**"Clean staircase" (V2)** — four 3×3 pixels arranged diagonally from upper-left to lower-right within a 12×12 icon area. A result-oriented metaphor that shows the **state after PP applies** (a clean staircase).

Explored alternatives (preserved in the `PP Icon — Variant Exploration (HITL)` reference frame):
- V1 Ghost corner — L-shape + outlined corner (the to-be-removed pixel rendered as an "empty" slot). Outline readability suffers at 1× size.
- V3 Faded corner — L-shape + opacity 0.35 corner (dimming implies removal). Better than V1 but not as clear as V2.

### Size

**x-wide (desktop, topBar h:48)**
- Visible: **32×32**, cornerRadius 6 — matches surrounding `zoomControls` / `gridBtn` / `exportBtn` (all 32px)
- Icon area: 16×16 (button center, 8px internal padding)
- Pixels: 4×4, four of them, diagonal `(8,8) (12,12) (16,16) (20,20)`

**wide iPad Landscape · medium · compact (topBar/mAppBar, h:44~48)**
- Visible: **36×36**, cornerRadius 6 (iPad/medium) / 8 (compact)
- Icon area: 16×16 (button center, 10px internal padding)
- Pixels: 4×4, four of them, diagonal `(10,10) (14,14) (18,18) (22,22)`

**Shared**: The icon metaphor (diagonal staircase) and color tokens are identical across all tiers. The 16×16 icon area is shared across all production sizes — as button size grows, the icon itself stays constant. Touch tiers already reach `Touch targets: ≥44×44px` at 36×36 with surrounding padding.

### States (Option C — Accent-fill ON)

| State | Background | Icon color |
|---|---|---|
| ON (default) | `$--accent-subtle` | `$--accent` |
| ON + hover | unchanged (`$--accent-subtle`) | unchanged |
| ON + press | `color-mix($--accent-subtle, $--accent 10%)` | unchanged |
| OFF | transparent | `$--text-secondary` |
| OFF + hover | `$--bg-hover` | unchanged |
| OFF + press | `$--bg-active` | unchanged |
| ON / OFF + **disabled** | base state preserved + `opacity: 0.4` | base state preserved + `opacity: 0.4` |

Transition: **120ms ease-out** on `background-color` and `color`.

"ON-state hover unchanged" aligns with the existing `.export-btn--active:hover` pattern. "OFF-state hover→press" aligns with the existing `.icon-btn` pattern.

**Disabled state — when the active tool is not Pencil / Eraser**
- PP only affects Pencil / Eraser (Line / Rectangle / Circle / Bucket / Eyedropper / Select, etc. are unrelated — Scenario 11)
- When an unrelated tool is selected, don't hide or remove the toggle — **keep position + opacity 0.4** as disabled visualization
- No hover / press response (`pointer-events: none` or `cursor: not-allowed`)
- Apply `aria-disabled="true"`
- Tooltip: replace with contextual guidance like `"Pixel Perfect (Pencil/Eraser only)"`
- Preference value (`pixelPerfect`) is kept intact — it takes effect immediately when the user switches back to Pencil / Eraser

Explored alternatives (preserved in the `Q4 — ON/OFF state variants (HITL)` reference frame):
- A. TopBar match — bg always `$--bg-hover`, only icon color changes. Button chrome always visible on StatusBar — visually noisy.
- B. StatusBar minimal — no bg, only icon color changes. Too quiet, weakens the weight of "mode toggle".
- C. (selected) Accent-fill ON — OFF transparent + ON accent-subtle bg. Reflects the weight that PP is **a mode that changes drawing logic**.

Disabled handling alternatives:
- A. Always-identical display — simple but confuses the user ("does this have any effect right now?"), especially in the Line diagonal case
- B. (selected) Dimmed (opacity 0.4) — preserves position and honestly communicates effectiveness
- C. Hidden — removing the button causes a layout jump; surprises the user on return

### Label / Accessibility

- Icon-only (no visible text)
- `aria-label`: includes the current state — e.g., `"Pixel Perfect: On"` / `"Pixel Perfect: Off"` / when disabled `"Pixel Perfect (Pencil/Eraser only)"`
- Tooltip: exposes the same string as `aria-label`
- `aria-disabled="true"` applied (disabled state)
- i18n: en / ko / ja added at the 074 implementation stage

### `.pen` deliverables

- Final spec: **`PP Toggle — Final Design Spec`** (state matrix + disabled states + tier placements + spec summary)
- Integrated mockup per tier (all between `zoomControls` ↔ `gridBtn`, ON state):
  - **Desktop Dark / Light** → `topBar` (32×32, r6)
  - **iPad Landscape** → `topBar` (36×36, r6)
  - **Medium Tablet** → `mAppBar` (36×36, r6)
  - **Mobile Draw** → `mAppBar` (36×36, r8)
- Reference frames retained from the design process (preserved, `(HITL)` tag):
  - `PP Icon — Variant Exploration (HITL)` — compares 3 icon variants
  - `Q4 — ON/OFF state variants (HITL)` — compares 3 state-differentiation options

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | `PP Toggle — Final Design Spec` frame (spec summary + state matrix + disabled states + tier placements), PP toggle integrated into 3 production top bars (Desktop Dark/Light topBar, iPad Landscape topBar) + 2 mAppBars (Medium Tablet, Mobile Draw), 2 HITL exploration frames preserved |
| `issues/070-pixel-perfect-toggle-design.md` | Design decisions doc — placement/icon/size/states/disabled/labels all finalized, explored alternatives' rationales recorded |
| `issues/074-pixel-perfect-toggle-ui.md` | Updated placement container name StatusBar → topBar/mAppBar; added disabled state implementation requirement |
| `tasks/todo.md` | Updated 070 entry label to "PP toggle design (topBar/mAppBar)" |

### Key Decisions

- **Placement: StatusBar → topBar / mAppBar re-adjustment** (changed mid-HITL). Initially proposed StatusBar, but touch tiers lack a StatusBar and would necessarily land on the mAppBar, creating an asymmetric mental model ("desktop = StatusBar / touch = top bar"). At the user's suggestion, **unified to the top bar across all tiers**, between `zoomControls` ↔ `gridBtn` = drawing-mode toggles group.
- **Icon: V2 Clean staircase** — expresses the L-corner cleanup result (clean staircase) as a result-oriented metaphor. Alternatives V1 Ghost corner / V3 Faded corner suffer readability issues at 1× size.
- **States: Option C — Accent-fill ON** — OFF transparent + ON `$--accent-subtle` bg. Reflects the weight that PP is "a mode that changes drawing logic" (simple TopBar-style toggles A/B dropped).
- **Disabled state: opacity 0.4 + aria-disabled** — when the active tool is not Pencil/Eraser. Don't hide or remove — keep position, preserve preference. Alternatives A (always same) / C (hidden) dropped.
- **Icon sizing strategy**: 16×16 icon area is shared across all production sizes (32×32, 36×36) — as the button grows, the icon itself stays constant. Only the abstract demo keeps 12×12.

### Notes

- State matrix cells are rendered at 20×20 (abstract size). Since button sizes differ per production tier, the matrix is a state-semantics-only reference; actual sizes appear in the "Tier placements" section.
- Light OFF-disabled has very low contrast and is almost invisible — intentional (to discourage click invitation). Opacity (0.4 → 0.5) can be tuned during 074 implementation if needed.
- Disabled tooltip string `"Pixel Perfect (Pencil/Eraser only)"` is English-only — ko/ja translations added in 074.
- HITL exploration frames (`PP Icon — Variant Exploration`, `Q4 — ON/OFF state variants`) are preserved inside the .pen as rationale references for the design decisions.
