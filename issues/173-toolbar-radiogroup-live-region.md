---
title: "Tool selection radiogroup semantics + live-region Constrain announcements"
status: ready-for-agent
created: 2026-06-12
---

## Context

Second of four follow-ups porting the strengths of the closed PR [#265](https://github.com/siluat/dotorixel/pull/265), per the [comparative review](https://github.com/siluat/dotorixel/pull/266#issuecomment-4691161728). This issue ports the accessibility model: radio semantics for tool selection and a live region for latch announcements. Both AI structural reviews agreed the radio model fits tool selection better than the current toggle-button markup.

## What to build

Tool selection in both toolbars (touch strip and docked) is a mutually exclusive choice, but the buttons are marked up as independent toggle buttons (`aria-pressed`). Convert tool selection to the WAI-ARIA radio group pattern, and announce Constrain-latch flips through a polite live region instead of the accessible-name suffix.

End-to-end behavior:

- The tool buttons form a radiogroup with its own localized label — add a new dedicated message key (the source PR reused a landing-page key; don't). The active tool is the checked radio (`aria-checked`), and `aria-pressed` disappears.
- Roving tabindex: only the active tool participates in the tab order. Arrow Right/Down move selection (and focus) to the next tool, Arrow Left/Up to the previous, wrapping at the ends. Space/Enter on the active constrainable tool toggles the Constrain latch — the keyboard equivalent of the pointer re-tap; on an unchecked tool they select it.
- Handled arrow/activation keys must not leak into global handlers while focus is inside the radiogroup — Space is also the global canvas-pan shortcut, and single letters switch tools.
- While the active tool can constrain, an SR-only `role="status" aria-live="polite"` region carries a full-sentence localized description of the latch state (on: "Constrain is on. Activate this tool again to turn it off." / matching off variant) in all three locales, and the active constrainable radio references it via `aria-describedby`. Status element ids must be instance-unique so multiple mounted toolbars don't collide.
- Decision from the breakdown review: the latched "(Constrain)" accessible-name suffix is removed. The accessible name stays the plain tool name; latch state lives in the description/status channel. The visual corner-dot indicator stays.
- Keep the feature's semantics shared: the existing shared tool-ui functions remain the single source for re-tap/badge meaning, and the new keyboard-navigation logic lives in one shared module consumed by both toolbars. The source PR duplicated ~45 lines of handler code per component — don't repeat that.
- E2E assertions that rely on the old label suffix or `aria-pressed` move to the new semantics (`aria-checked` / status region).

## Acceptance criteria

- Both toolbars expose tool selection as a labeled radiogroup with `aria-checked` and roving tabindex; `aria-pressed` is gone; the radiogroup label is a new dedicated message key in en/ko/ja
- Arrow navigation wraps and moves selection with focus; Space/Enter on the active constrainable tool toggles the latch; the shared contract (issue 172) covers all of this once for both toolbars
- Latch flips are announced via a polite, instance-unique status region referenced by `aria-describedby` from the active constrainable radio; full-sentence on/off messages exist in en/ko/ja
- The "(Constrain)" label suffix is removed; the corner-dot visual remains
- Arrow/Space/Enter handling inside the radiogroup does not trigger global shortcuts (Space pan, single-letter tool switch) or canvas interactions
- Unit, component, and E2E suites pass; svelte-check clean
- Post-merge maintainer checklist: VoiceOver smoke check — tool focus announcement, latch flip announcement, describedby read-out

## Blocked by

- [172 — Consolidate toolbar Constrain-latch specs into a shared contract](172-toolbar-constrain-latch-contract-tests.md)
