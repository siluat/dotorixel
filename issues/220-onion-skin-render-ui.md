---
title: "Onion skin rendering + transport toggle — end-to-end"
status: ready-for-agent
created: 2026-07-05
parent: 217-onion-skinning.md
---

## Parent

[217 — Onion skinning — adjacent-frame ghosts while editing (M4)](217-onion-skinning.md)

## What to build

The user-visible half of PRD 217: render the ghost projection from 219 on the main
canvas per the 218 design spec, and ship the transport-strip toggle that drives it.
After this slice, onion skinning is demoable end-to-end on desktop and mobile.

- **Renderer draw step**: ghosts draw after the Reference underlay and before the
  pixel composite — farthest first, nearest last — each through the same ImageData →
  offscreen → nearest-neighbor scaled blit as the artwork, with the per-kind tint
  (previous warm, next cool) and reduced alpha from the 218 spec applied via canvas
  compositing. Ghost transparency is preserved (checkerboard and reference show
  through); an empty ghost list draws nothing extra.
- **Canvas view + wiring**: the canvas view takes the ghost projection as a prop
  (like the reference underlay) and both editor layouts (docked and mobile) wire it
  through, following the grid-toggle chain for the toggle callback.
- **Transport toggle**: a pressed-state toggle (`aria-pressed`) in the transport
  strip per the 218 spec, disabled at a single frame (the strip's existing
  convention), ≥44px touch target on the mobile Timeline tab. The strip stays a pure
  view (props in, callbacks out). New strings land in en / ko / ja together.
- **Playback suppression, visible end-to-end**: the 219 projection already empties
  during Playback; this slice makes the behavior observable — ghosts vanish on play
  and return on stop, preserving the Playback WYSIWYG contract.
- **E2E thin tracer**: author two frames with distinct art, enable onion skin, assert
  a canvas pixel differs from the background where only the neighbor has art, disable
  and assert it returns to background; reload and assert the toggle state was
  restored.

## Acceptance criteria

- Draw order is checkerboard → Reference underlay → ghosts (farthest first) → pixel
  composite → grid; mock-context renderer tests assert the order and arguments, tint
  and alpha applied and reset around ghost draws, smoothing off for ghost blits, and
  no extra draws for an empty ghost list. Prior art: the renderer draw-order tests.
- Ghost appearance matches the 218 spec: previous warm-tinted, next cool-tinted, both
  dimmed, committed artwork on top, transparency preserved.
- The toggle fires its callback, reflects pressed state via `aria-pressed`, is
  disabled at a single frame, and carries the localized label — component tests per
  the transport strip's play/loop prior art.
- Enabling the toggle shows ghosts on the canvas; during Playback no ghosts render;
  stopping restores them.
- Exports and saved-work thumbnails contain no ghosts (invariant asserted — existing
  export tests stay green, plus a targeted check that they read document composites,
  not the view pipeline).
- The E2E tracer passes, including the reload-restore assertion. Prior art: the
  playback E2E and the frames reload-persistence tests with the canvas pixel-reading
  fixtures.
- New i18n keys exist in all three locales; no mixed-language fallbacks.

## Blocked by

- [218 — Onion skin transport toggle + ghost treatment — design (.pen)](218-onion-skin-design.md)
- [219 — Onion skin state — neighbor selection, ghost projection, persisted per-tab flag](219-onion-skin-state.md)
