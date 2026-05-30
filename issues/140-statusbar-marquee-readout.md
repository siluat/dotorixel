---
title: "StatusBar Marquee readout — persistent W×H + origin display"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Add a Marquee readout slot to `StatusBar.svelte` so the active Marquee's dimensions and origin are always visible.

Scope:

- **`StatusBar.svelte`**: new slot rendering `"Marquee: {W}×{H} at ({x}, {y})"` whenever a Marquee is active. Slot is hidden when no Marquee exists.
- **Compact breakpoint** (<600px): abbreviate to `"{W}×{H}"` (no `"Marquee:"` prefix, no origin) to fit narrow screens.
- **i18n** (`messages/{en,ko,ja}.json`): `status_marquee` for the full-form template and `status_marqueeCompact` for the abbreviated form. Use parameterized strings (e.g., Paraglide template params `{width}`, `{height}`, `{x}`, `{y}`).
- **Data source**: `EditorController` exposes a derived `marquee` getter that reads from `workspace.activeTab.document.marquee()`. Status bar consumes it through the controller.

Implementation notes:

- The slot updates reactively when the journal commits a `set-marquee` or `commit-floating-selection` intent (both trigger render invalidation, which Svelte 5 runes pick up).
- The slot does NOT update during interactive drag previews — only after commit. This matches the persistent vs transient information split (drag-time info comes from the dimension tooltip in 141).

Tests:

- StatusBar test: slot hidden when `marquee()` is `None`.
- StatusBar test: slot shows full form at medium+ breakpoint with correct values.
- StatusBar test: slot shows abbreviated form at compact breakpoint.
- StatusBar test: locale-switching renders the correct template.

## Acceptance criteria

- Active Marquee dimensions and origin displayed in the StatusBar whenever a Marquee exists.
- Compact breakpoint shows abbreviated `"W×H"` form.
- i18n keys exist in all three locales (`en`, `ko`, `ja`).
- Slot hides when no Marquee is active.
- Display reflects current Marquee state including post-commit position changes from move / nudge / paste.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)
