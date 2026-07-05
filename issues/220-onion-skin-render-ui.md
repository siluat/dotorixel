---
title: "Onion skin rendering + transport toggle — end-to-end"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/renderer.ts` | Ghost draw step between the Reference underlay and the pixel composite — farthest first, per-kind tint (prev `#E5484D` / next `#3B82F6`) via transparency-preserving `source-atop` 60% blend, 40%-alpha nearest-neighbor blit with alpha restored. `rasterFromPixels` extracted (now shared by pixel / Reference / ghost rasters); draw-order contract documented on `renderPixelCanvas` |
| `src/lib/canvas/renderer.test.ts` | Mock-context specs: full draw order, tint + alpha applied and reset around ghost blits, smoothing off, empty ghost list draws nothing extra |
| `src/lib/canvas/PixelCanvasView.svelte` | `onionSkinGhosts` prop (default `[]`) passed to the renderer, reference-underlay style |
| `src/lib/ui-editor/TransportBar.svelte` | Ghost toggle third in the left cluster (`[Play] [Loop] [Ghost]`, lucide `Ghost`), `aria-pressed`, single-frame disabled, Loop-mirrored two-channel on-state; mobile ≥44px inherited from the strip's existing media query |
| `src/lib/ui-editor/TimelinePanel.svelte` | `showOnionSkin` / `onToggleOnionSkin` forwarded to the transport strip (optional, Storybook-safe defaults) |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | `onionSkinProjection` getter + `handleOnionSkinToggle` (grid-chain parity) |
| `src/routes/editor/+page.svelte` | Both layouts wired: ghosts into `PixelCanvasView`, toggle into `TimelinePanel` (docked + mobile Timeline tab) |
| `messages/{en,ko,ja}.json` | `aria_toggleOnionSkin` — "Onion skin" / "어니언 스킨" / "オニオンスキン" |
| `src/styles/design-tokens.css`, `docs/design-system.md` | `--ds-onion-prev` / `--ds-onion-next` registered in `:root` only and documented as theme-independent, web-only (Apple has no frame axis) |
| `e2e/editor/onion-skin.test.ts` | Thin tracer: neighbor ghost pixel appears on enable, returns to background on disable, toggle + ghost restored after reload (IndexedDB-polled auto-save, frames-test prior art) |
| Component/unit tests | TransportBar (3 new + 2 extended to cover the toggle), TimelinePanel forwarding, controller delegation ×2, export invariant on `exportableSnapshot` in the tab-state suite |

### Key Decisions

- **Tint constants live in the renderer** as module constants cross-referenced with the
  `--ds-onion-*` tokens (`CHECKER_*` / `gridColor` precedent) — the renderer stays
  DOM-free rather than reading computed styles at runtime.
- **The renderer draws whatever ghosts it is given** — the off / Playback / single-frame
  gate stays upstream in the 219 projection (single gate); the renderer's contract is
  only "empty list → no extra draws".
- **Draw order is `distance` descending** via a stable sort, so the projection's axis
  order is preserved between equal distances.
- **Export invariant pinned as a regression test**, not new work: `exportableSnapshot`
  output is identical with ghosts live; animated exporters take only the `Document` by
  signature, so ghosts are unrepresentable there.

### Notes

- GUI-verified end-to-end via agent-browser (warm/cool ghosts, active art on top,
  Playback suppression and return, toggle off); tint legibility over black art on the
  checkerboard reads fine — 218's blend-ratio knob left untouched.
- Full suites green: unit 92 files / 1663 tests, E2E 110; `bun run check` 0 errors.
- This slice closes PRD 217 (218 design / 219 state / 220 render+UI all done).
