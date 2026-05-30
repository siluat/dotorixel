---
title: "Touch long-press inside Marquee body suppresses Sampling Session"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

When the user long-presses (400 ms) inside an active Marquee body on a touch device, suppress the Sampling Session (color-pick loupe). Long-press outside the Marquee body continues to open the Sampling Session normally.

Scope:

- **`canvas-interaction.svelte.ts`** (or the `sampleStart` host callback): when the Selection tool is active AND the long-press target falls inside the current Marquee, return `false` from `onSampleStart` so the interaction does not enter the `'sampling'` mode.
- **`tab-state.svelte.ts` `sampleStart`**: extend the early-out condition (currently only checks for `eyedropper` active tool) to also short-circuit when the active tool is `selection` AND the pointer coordinate is inside the active Marquee.
- Outside-Marquee long-press preserves current behavior — Sampling Session opens normally.
- Mouse / pen behavior unchanged (long-press is touch-specific in the existing canvas-interaction logic).

Tests:

- TS test: touch long-press inside Marquee body → `sampleStart` returns false, no Sampling Session created.
- TS test: touch long-press outside Marquee body → Sampling Session opens as today.
- TS test: touch long-press with no active Marquee → Sampling Session opens as today.
- TS test: long-press while Selection tool is NOT active → Sampling Session opens regardless of Marquee position (Marquee is rendered for the Selection tool's context; other tools sample as before).

## Acceptance criteria

- Touch long-press inside Marquee body with Selection tool active does not open a Sampling Session.
- All other long-press scenarios continue to open the Sampling Session as today.
- Mouse / pen interactions unchanged.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)
