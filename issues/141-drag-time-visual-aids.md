---
title: "Drag-time visual aids — dimension tooltip + crosshair guides"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Two helpers that render only while the user is actively dragging a Marquee corner (the `DefineMarquee` phase): a dimension tooltip showing `"W×H"` and 1 px crosshair guides extending from the pointer to the viewport edges.

Scope:

- **Dimension tooltip** (part of `SelectionOverlay.svelte` or a new sibling component): a small label that follows the live pointer position, biased above the contact point (so finger doesn't cover it on touch), clamped to viewport edges. Renders the in-progress region's width × height. Disappears on pointer release.
- **Crosshair guides**: 1 px subtle stroke using `--ds-border-subtle`, extending from the pointer along both axes to the viewport edges. No animation, so `prefers-reduced-motion` requires no special handling. Disappears on pointer release.
- Both helpers render identically for `mouse`, `pen`, `touch` (no `pointerType` branching — precision aids are useful for all input modalities).
- Both render only during `DefineMarquee`. They do NOT render during `LiftAndDrag` (Floating Selection has its own dimensions, and the user already sees the Marquee outline tracking).

Implementation notes:

- The tooltip's positioning logic should reuse the same viewport-edge clamping pattern as `Loupe.svelte` (which positions itself to avoid the pointer).
- The crosshair lines render as SVG inside `SelectionOverlay` to share the overlay's coordinate system.
- Touch-target rule: no touch interaction with the tooltip / crosshair (they are display-only).

Tests:

- Visual snapshot test: during `DefineMarquee`, tooltip renders at the expected location with correct dimensions.
- Visual snapshot test: during `DefineMarquee`, crosshair lines extend from the pointer to viewport edges.
- Behavior test: both helpers disappear on pointer release.
- Behavior test: neither helper renders during `LiftAndDrag`.

## Acceptance criteria

- Dimension tooltip renders during `DefineMarquee` and shows current `W×H`.
- Crosshair guides render during `DefineMarquee` along both axes to viewport edges.
- Both helpers disappear on pointer release / cancel / end of DefineMarquee.
- Neither helper renders during `LiftAndDrag`.
- Identical rendering across `mouse` / `pen` / `touch`.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)
