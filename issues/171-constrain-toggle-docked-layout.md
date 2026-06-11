---
title: "Constrain toggle in the docked layout"
status: ready-for-agent
created: 2026-06-11
parent: 168-touch-modifier-alternatives.md
---

## Parent

[168 — Touch modifier alternatives — touch-reachable Shift-constrain](168-touch-modifier-alternatives.md)

## What to build

Expose the Constrain latch in the **docked layout** (wide/x-wide). The parent PRD scoped UI placement to the touch tool surface, but iPad landscape (≥1024px) renders the docked layout — a touch device with no Shift key would otherwise lose access to the latch exactly where the screen is biggest. Desktop mouse users gain a latched constrain as a side benefit.

End-to-end behavior:

- The docked toolbar offers the same Constrain toggle, driving the **same workspace-scoped latch** as the touch strip — one shared state across layouts, not a second latch.
- Same display rule as the touch strip for consistency: visible only while a constrainable tool is active (line, rectangle, ellipse, selection).
- Active-state styling follows the docked toolbar's existing pattern; the tooltip reuses the i18n message introduced with the latch.
- Keyboard Shift remains unchanged and OR-combination semantics still hold; an iPad-with-keyboard user in docked mode can use either.

Extends parent user story 12 (and stories 1–9) to the docked layout.

## Acceptance criteria

- The Constrain toggle is reachable in the docked layout's toolbar and toggles the same workspace latch as the touch strip (latching in one layout is reflected in the other after a layout-mode change).
- The toggle is visible only while line, rectangle, ellipse, or selection is active.
- Its active visual state reflects the latch and matches the docked toolbar's existing active styling; the tooltip is localized (en/ko/ja) via the existing message key.
- With the latch on, drawing in docked mode constrains exactly as on the touch layout (45° line, square/circle, square DefineMarquee, axis-locked Floating drag).
- Keyboard Shift alone, latch alone, and both together still constrain.
- Tests/story: docked toolbar story (and component test if warranted) covering visibility gating and active/inactive toggle states.

## Blocked by

- [169 — Constrain latch + touch tool strip toggle](169-constrain-latch-touch-toggle.md)
