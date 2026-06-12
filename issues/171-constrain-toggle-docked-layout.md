---
title: "Constrain toggle in the docked layout"
status: done
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

## Delivered in 169's branch (2026-06-11)

This issue's scope was delivered alongside 169 (`feat/constrain-latch-touch-toggle`), by user decision during implementation. Two design points diverge from the original wording above:

- **Re-tap instead of a dedicated toggle button.** 169's touch strip adopted "re-tap the active constrainable tool to toggle the latch" (the strip was past its width budget), and the user chose layout uniformity: the docked `LeftToolbar` uses the same gesture. The shared semantics live in `src/lib/ui-editor/tool-ui.ts` (`isConstrainToggleTap`, `showsConstrainState`, `toolButtonLabel`), consumed by both toolbars.
- **State display is a corner dot + accessible label**, not an active-styled button: while latched, the active constrainable tool button carries an accent dot and its label announces the constrain state (e.g. "Line (Constrain)"). Hover tooltips are unchanged — the dot and label carry the state.

An interim docked-entry reset guard was briefly added (an armed latch could otherwise enter docked invisibly via iPad rotation) and then removed in the same branch — uniform re-tap makes the latch visible and clearable everywhere, so no guard is needed.

Coverage: `LeftToolbar.svelte.test.ts` (re-click toggles / inert for non-constrainable / label announce), `LeftToolbar.stories.svelte` (`ConstrainLatchOn`), and E2E `e2e/editor/constrain-latch.test.ts` (docked arm/disarm + cross-layout survival — satisfying the "latching in one layout is reflected in the other" criterion).

## Blocked by

- [169 — Constrain latch + touch tool strip toggle](169-constrain-latch-touch-toggle.md)

## Results

Delivered in 169's branch (`feat/constrain-latch-touch-toggle`) — see the "Delivered in 169's branch" section above for the design divergences from the original wording, and [169's Results](169-constrain-latch-touch-toggle.md) for the full file table.

| File | Description |
|------|-------------|
| `src/lib/ui-editor/LeftToolbar.svelte` | Re-click toggle on the active constrainable tool + accent corner dot, same shared latch |
| `src/lib/ui-editor/LeftToolbar.svelte.test.ts` | Re-click toggles / inert for non-constrainable / accessible-label announce |
| `src/lib/ui-editor/LeftToolbar.stories.svelte` | `ConstrainLatchOn` story |
| `e2e/editor/constrain-latch.test.ts` | Docked arm/disarm + cross-layout latch survival (the "reflected in the other layout" criterion) |

### Key Decisions

- Re-tap/re-click gesture instead of a dedicated toggle button, for layout uniformity with the touch strip (user decision during 169).
- Hover tooltips unchanged; the dot and the accessible label carry the latched state.
