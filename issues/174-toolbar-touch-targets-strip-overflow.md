---
title: "Guarantee 44px toolbar touch targets and resolve the strip width debt"
status: ready-for-agent
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
