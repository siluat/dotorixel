---
title: TabStrip component — visual tab management
status: open
created: 2026-04-05
parent: 002-tab-system.md
---

## What to build

Implement the TabStrip Svelte component placed below the Top Bar / App Bar. This is the user-facing slice that makes the tab system visible and interactive: tab switching, creating new tabs, closing tabs, responsive sizing, overflow scrolling, and active tab styling. The .pen designs for all 4 breakpoints serve as the visual reference.

See parent PRD sections: "Tab strip UI", "Tab closure behavior", "New image defaults".

## Acceptance criteria

- [ ] TabStrip component renders below Top Bar (docked layout) and App Bar (tab layout)
- [ ] Responsive heights: 36px (desktop), 32px (iPad/tablet), 28px (mobile) matching .pen designs
- [ ] Active tab styled with `--ds-bg-elevated` background and `--ds-accent` bottom 2px indicator
- [ ] Inactive tabs show no background, `--ds-text-secondary` text color
- [ ] Each tab shows a close "x" button; clicking it closes the tab
- [ ] "+" button after the last tab creates a new tab
- [ ] New tabs automatically become active and scroll into view
- [ ] Horizontal scroll with hidden scrollbar when tabs overflow; supports trackpad and touch swipe
- [ ] First tab flush to left edge, "+" button immediately follows last tab
- [ ] Clicking a tab switches to it via `workspace.setActiveTab()`
- [ ] Tab strip is visually consistent across desktop, iPad, tablet, and mobile breakpoints
- [ ] Storybook story for TabStrip component

## Blocked by

- [005 — Wire Workspace into +page.svelte](005-wire-workspace-to-page.md)

## User stories addressed

- User story 2 — click a tab to switch
- User story 3 — close a tab via "x" button
- User story 10 — new tabs auto-activate and scroll into view
- User story 11 — horizontal scroll for overflow
- User story 12 — visually consistent across breakpoints
- User story 13 — "+" button affordance
- User story 14 — close "x" button on each tab
- User story 15 — active tab visually distinct
