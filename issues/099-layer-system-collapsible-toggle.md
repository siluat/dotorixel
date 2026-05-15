---
title: "Layer system: collapsible chevron (no persistence)"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Add the desktop chevron that toggles the TimelinePanel between expanded (h=180) and collapsed (h=32). State lives in the runtime only — a page refresh resets to the default (expanded). Persistence is added in the next slice (E2).

Scope:

- Chevron control in the panel's top-right per the design (092).
- Click toggles the panel height between expanded and collapsed states.
- Collapsed state visually summarizes the panel without exposing per-row controls.
- Mobile is not affected — the mobile entry remains the BottomTabs Timeline tab from D.

## Acceptance criteria

- Chevron toggles between expanded (h=180) and collapsed (h=32).
- Default state on first load is expanded.
- Page refresh resets to expanded (no persistence yet).
- The chevron icon orientation reflects the current state.
- Mobile layout is unaffected.

## Blocked by

- [093 — TimelinePanel shell](093-layer-system-timeline-panel-shell.md)

## Scenarios addressed

- Partial coverage of Scenario 10 (toggle works; persistence in E2).

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/TimelinePanel.svelte` | Added `isCollapsed` `$state` (in-memory only), chevron button with `lucide-svelte`'s `ChevronDown`, `.timeline-panel--collapsed` BEM modifier, header label switches to `layer_panel_collapsed_label` when collapsed, body content gated behind `{#if !isCollapsed}`. Mobile hides the chevron via `@media (max-width: 1023px)`. |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | 7 new tests covering: toggle button renders, default-expanded, collapses on click, expands again on second click, header shows active layer name when collapsed, layer rows hidden when collapsed, aria-label swap between Collapse/Expand. Suite: 44/44 passing. |
| `src/routes/editor/+page.svelte` | Grid `timeline` row changed from fixed `180px` to `auto` (in both default and `min-width: 1440px` grid-template) so the canvas region expands when the panel collapses to header height. |
| `messages/{en,ko,ja}.json` | Added 3 keys × 3 languages: `layer_panel_collapsed_label` ("Layers · {name}"), `aria_collapseTimelinePanel`, `aria_expandTimelinePanel`. |

### Key Decisions

- **State is component-local** (`$state` in TimelinePanel) — by design, not lifted to Document yet. Persistence (`timelinePanelCollapsed` flag on Document + V3 schema wiring) is the explicit scope of sub-issue 100; lifting prematurely here would duplicate the work.
- **Chevron icon from `lucide-svelte` (existing dep)** rather than a custom inline SVG or a unicode glyph. Direction: `ChevronDown` when expanded, `rotate(180deg)` when collapsed (i.e. points up = "click to expand"). User-chosen direction after comparing both orientations.
- **Internal/external naming split**: the JS variable is `isCollapsed` per CLAUDE.md's boolean-as-question rule. External contracts (`data-collapsed` DOM attr, `.timeline-panel--collapsed` BEM modifier, `layer_panel_collapsed_label` i18n key) keep the noun form because they are domain identifiers, not boolean variable bindings.
- **Conditional rendering, not CSS hiding**: body uses `{#if !isCollapsed}` so collapsed state truly removes layer rows from the DOM (accessibility tree reflects collapsed state; no spurious focus targets).

### Notes

- Parent PRD-086's frontmatter already showed `status: done` before this task. Pre-existing inconsistency — left as-is. Sibling 100 is the only PRD-086 sub-issue still open after this lands.
- Page refresh resets the panel to expanded (no persistence yet) — verified manually. Persistence behavior is sub-issue 100's contract.
