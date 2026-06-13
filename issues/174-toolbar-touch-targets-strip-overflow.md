---
title: "Guarantee 44px toolbar touch targets and resolve the strip width debt"
status: done
created: 2026-06-12
---

## Context

Third of four follow-ups porting the strengths of the closed PR [#265](https://github.com/siluat/dotorixel/pull/265), per the [comparative review](https://github.com/siluat/dotorixel/pull/266#issuecomment-4691161728). The source PR fixed the touch targets with a whole-strip scroll; the review flagged that approach (it can leave Undo offscreen with no affordance), so this issue lands a revised layout decided in the breakdown review.

## What to build

Two touch-target violations, one per toolbar:

- The compact tool strip lets its buttons flex-shrink below the 44px touch-target minimum: 9 tools + Undo at 44px each need 440px against ~390px phone widths. Today this lives as a documented width-debt comment in the strip styles.
- The docked LeftToolbar's buttons are 36px, below the 44px hit-area requirement the screen inventory already states for wide/x-wide.

Make 44px hit targets structural in both toolbars.

Decision from the breakdown review — pinned-actions layout for the compact strip: Undo (and Redo where shown) stays fixed at the strip's edge outside the scroll area; only the nine tool buttons scroll horizontally (hidden scrollbar, pan-x touch action, contained overscroll). The tool button clipped at the boundary is the scroll affordance; Undo is always visible — it is the most frequent mid-drawing action and must never depend on scrolling. At ≥600px everything fits, so no scrolling and the current spacing behavior is preserved.

- Buttons in both toolbars get a non-shrinkable 44px flex basis from the touch-target token. LeftToolbar icons stay 18px — the button box provides the hit area, matching the screen inventory's "44px hit areas" note.
- The latched corner dot must remain visible on an active tool scrolled into view.
- Replace the stale width-debt comment with the actual fix; update the screen inventory's strip/toolbar rows where their described behavior changes.
- Storybook gains a 390px-wide strip story showing the overflow state with the pinned Undo.

## Acceptance criteria

- At 390×844 (compact), every visible toolbar button measures ≥44×44px, Undo is visible without scrolling, and all nine tools are reachable by horizontal scroll — asserted by a committed E2E test (the source PR verified this only manually)
- Re-tapping the active constrainable tool after scrolling it into view still toggles the latch
- Docked LeftToolbar tool/action buttons present ≥44px hit areas with unchanged 18px icons
- ≥600px layouts show no scrolling and no visual regression (Redo still appears on medium)
- The width-debt comment is gone; the screen inventory reflects the new strip behavior
- Full unit + E2E suites pass; svelte-check clean

## Blocked by

- [172 — Consolidate toolbar Constrain-latch specs into a shared contract](172-toolbar-constrain-latch-contract-tests.md)
- [173 — Tool selection radiogroup semantics + live-region Constrain announcements](173-toolbar-radiogroup-live-region.md) — content-independent, but sequenced to avoid churning the same markup and tests in parallel

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/ToolStrip.svelte` | Compact strip: the radiogroup becomes a horizontal scroll area (hidden scrollbar, `pan-x`, contained overscroll); tool buttons get a non-shrink 44px flex basis; Undo is pinned outside the scroll. Reverts to `display:contents` + space-around at ≥600px. Width-debt comment removed. |
| `src/lib/ui-editor/LeftToolbar.svelte` | Docked tool/action buttons 36px → 44px (`--ds-touch-target-min`), 48px at x-wide; icons stay 18px. |
| `src/routes/editor/+page.svelte` | Docked grid `toolbar` column `44px`/`48px` → `auto`, so the strip sizes to button + 1px divider (fixes the desktop horizontal scrollbar). |
| `src/lib/ui-editor/ToolStrip.stories.svelte` | Added the 390px `CompactOverflowPinnedUndo` story. |
| `docs/screen-inventory.md` | §3.1 / §3.2 / §7 updated to the pinned-Undo scroll + 44/48px hit-area behavior. |
| `e2e/editor/toolbar-touch-targets.test.ts` | New E2E: 44px targets + always-visible Undo, scroll reachability, latch toggle + badge on a scrolled-in tool, medium no-scroll with Redo, docked no horizontal overflow. |

### Key Decisions

- Pinned-actions layout: only the nine tools scroll; Undo stays fixed and always visible (the most frequent mid-drawing action), per the breakdown review — rejecting the source PR's whole-strip scroll that could hide Undo.
- Docked strip width is driven by the button: grid column set to `auto` (not `calc(44px + 1px)`) so it tracks the 44/48px button with no magic offset.
- x-wide LeftToolbar buttons use a one-off 48px literal — no comfortable-size token exists, so promote only when reuse is confirmed.

### Notes

- Sizing/scroll is verified by E2E only: happy-dom does no layout, so unit/component tests can't measure pixel sizes. Latch/radiogroup behavior stays covered by the shared contract tests (172).
- A desktop (docked) horizontal-scrollbar regression surfaced after enlarging the LeftToolbar buttons; fixed via the `auto` grid column and guarded by a new E2E test.
- Follow-up [175 — latch snapshot-restore guard + ownership wording](175-constrain-latch-snapshot-guard.md) is independent and still open.
