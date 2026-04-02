# 065 — Sliding active indicator animation (tab bar navigation)

## Plan

Add a smoothly sliding indicator to the TabBar component, replacing the instant background-color change on the active tab.

### Approach

- Pure CSS: derive `activeIndex` from `activeTab`, position indicator via `translateX(calc(var(--active-index) * 100%))`
- Indicator width = 1/3 of pill content area, absolutely positioned behind tab buttons
- Transition: `transform 180ms cubic-bezier(0.645, 0.045, 0.355, 1)` (ease-in-out-cubic — on-screen movement, not enter/exit)
- `will-change: transform` for GPU acceleration
- `prefers-reduced-motion: reduce` → `transition: none`
- Tab buttons get `position: relative; z-index: 1` to render above indicator
- Active tab loses background, keeps `color: #ffffff`

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/TabBar.svelte` | Sliding indicator div + pure CSS positioning via `--active-index` custom property |

### Key Decisions

- Scoped to tab bar navigation only — toolbar tool switching is too frequent for animation (pixel art workflow involves rapid tool changes via keyboard shortcuts). Tab navigation is infrequent enough that spatial continuity adds value.
- ease-in-out-cubic (not ease-out) per animation course principle: the indicator is an on-screen element moving between positions, not entering/exiting.
- 180ms duration: within standard UI range (150-250ms), slightly above existing 150ms button transitions to account for longer travel distance.

### Notes

- Toolbar sliding indicator was prototyped (LeftToolbar + ToolStrip) but reverted — animation frequency concern.
- The Sync task ("sliding indicator style updated in Editor frames") should reflect tab-bar-only scope.
