---
title: "Onion skinning — adjacent-frame ghosts while editing (M4)"
status: done
created: 2026-07-05
---

## Problem Statement

Milestone 4 gave DOTORIXEL users a complete animation loop: frames to author (PRD 186),
per-frame durations to time (PRD 193), in-editor Playback to watch (PRD 199), and GIF /
spritesheet export to share (PRD 213). But the *drawing* half of animation work is still
done blind. The canvas shows only the Active Frame — one frozen moment — so a user
drawing frame 5 of a walk cycle cannot see frame 4 or frame 6 while they draw:

- To place the next pose relative to the last one, they flip the Active Frame back and
  forth, holding the previous pose in memory. Every flip is a context switch away from
  the pixels they're placing.
- Pixel art is unforgiving at this scale: a single pixel of drift between frames reads
  as jitter in Playback. Today that drift is only discoverable *after* the fact — draw,
  play, spot the wobble, hunt for which frame moved.
- In-betweens are the worst case: a pose that must land *between* two neighbors has no
  visual anchor at all. The user is interpolating in their head.

Playback shows motion but not while drawing; the frame ruler shows which frames exist
but not what's on them. Onion skinning — dimmed ghosts of adjacent frames rendered
under the working frame — is the standard solution in every animation tool, and it is
the missing authoring aid this milestone's whole frame + duration + playback investment
points at.

## Solution

A **toggle in the timeline's transport strip** that, while on, renders the neighboring
frames as dimmed, tinted **ghosts** beneath the Active Frame's artwork on the main
canvas:

- The **previous frame** appears as a warm-tinted ghost, the **next frame** as a
  cool-tinted one, so the direction of motion reads at a glance. Both are clearly
  dimmer than committed artwork, and the Active Frame's art always draws on top.
- Ghosts follow the Active Frame along the timeline and update live with every edit,
  undo, and frame switch — the user is always tracing against current art.
- Ghosts are a **pure view aid**: they never appear in Playback, exports, or
  thumbnails, never enter the document data, and drawing tools ignore them entirely.
- The toggle is **per tab** and persists with the workspace, like the grid toggle — an
  animator's setup survives reloads.

## User Stories

1. As a pixel artist animating a walk cycle, I want a dimmed ghost of the previous frame under the frame I'm drawing, so that I can place the next pose without flipping between frames.
2. As a pixel artist drawing an in-between, I want to see the next frame's ghost as well, so that I can draw a pose that lands between its two neighbors.
3. As a pixel artist, I want previous and next ghosts tinted differently (warm vs cool), so that the direction of motion reads at a glance.
4. As a pixel artist, I want ghosts clearly dimmer than committed artwork, so that I never mistake a ghost for real pixels.
5. As a pixel artist, I want my Active Frame's artwork always drawn on top of ghosts, so that the art I'm editing is never obscured.
6. As a pixel artist, I want the onion skin toggle in the transport strip next to the playback controls, so that the animation aids are grouped in one place.
7. As a pixel artist, I want the toggle to visibly show its on/off state, so that I always know whether ghosts are active.
8. As a pixel artist, I want ghosts to follow the Active Frame as I move along the timeline, so that they always show the literal neighbors of the frame I'm editing.
9. As a pixel artist on the first frame, I want only the next-frame ghost (no wrap-around), so that ghosts always mean adjacent positions on the axis.
10. As a pixel artist on the last frame, I want only the previous-frame ghost, for the same reason.
11. As a pixel artist, I want ghosts to reflect edits to neighboring frames immediately (including undo/redo), so that I never trace against stale art.
12. As a pixel artist, I want ghosts to respect layer visibility and opacity exactly like the on-canvas composite, so that a hidden layer stays hidden in ghosts too.
13. As a pixel artist tracing over a Reference Layer, I want the Reference Layer excluded from ghosts, so that the frame-independent underlay isn't double-drawn or tinted.
14. As a pixel artist, I want ghosts drawn above the Reference underlay but below my artwork, so that the reference stays a backdrop and ghosts sit with the art.
15. As a pixel artist, I want transparent ghost regions to stay transparent, so that the checkerboard and reference show through as usual.
16. As a pixel artist, I want ghosts hidden while Playback runs, so that the preview shows exactly what the exported animation will look like.
17. As a pixel artist, I want ghosts to come back when Playback stops, so that I can return straight to drawing.
18. As a pixel artist, I want drawing tools to paint only the Active Frame regardless of ghosts, so that onion skin is purely visual.
19. As a user, I want PNG/SVG/GIF/spritesheet exports and saved-work thumbnails to never contain ghosts, so that shared output is always clean.
20. As a pixel artist, I want toggling onion skin to never create an undo entry or touch my artwork, so that it is free to flip on and off.
21. As a pixel artist with a single-frame document, I want the toggle disabled like Play and Loop, so that the transport consistently signals "needs 2+ frames".
22. As a returning user, I want each tab's onion skin state restored when I reopen the app, so that my animating setup survives reloads.
23. As a multi-tab user, I want onion skin state per tab, so that animating in one document doesn't change how another displays.
24. As a mobile user, I want the toggle on the Timeline tab with a comfortable touch target, so that I can use onion skinning on a phone or tablet.
25. As a keyboard user, I want to focus and flip the toggle with the keyboard, so that onion skinning is operable without a pointer.
26. As a screen-reader user, I want the toggle to announce its name and pressed state, so that the mode is accessible without sight.
27. As an i18n user, I want the new strings localized in English, Korean, and Japanese together, so that the UI never shows mixed-language fallbacks.
28. As a pixel artist, I want the editor to stay responsive with onion skin on at typical document sizes, so that drawing never lags.

## Implementation Decisions

- **No new core or WASM surface.** Ghost sources are the existing per-frame composite
  seam (`composite_at`) — the seam PRD 199 landed with onion skinning as a named future
  reader. It already returns committed art with layer visibility and opacity applied
  and the Reference Layer excluded, without consulting or moving the Active Frame.
  Tint and dimming are presentation, applied in the shell's Canvas2D draw step (Core
  Placement: web-only today, presentation concern, zero binding friction).
- **Fixed range in v1: previous 1, next 1.** Neighbor selection is parameterized by a
  config (previous/next counts) internally, so a future range control adds only UI;
  v1 ships the fixed default with no settings surface.
- **Neighbor selection is a pure function — the only new seam.** Given the ordered
  frame projection, the active frame id, and the config, it returns ghost descriptors
  (frame id, previous/next kind, distance), clamped at the axis ends, never wrapping.
  Mirrors the pure playback-advance decision from PRD 199.
- **Ghost projection on the per-tab state.** The tab state exposes an onion-skin
  projection (descriptor plus composite buffer per ghost) computed through the existing
  render-invalidation cache, exactly like the frame projection. The projection is empty
  while the toggle is off, while Playback runs, or on a side with no neighbor.
  Computing it never mutates the document, never moves the Active Frame, and never
  pushes History.
- **Renderer draw step.** Ghosts draw after the Reference underlay and before the pixel
  composite — farthest first, nearest last — each through the same ImageData →
  offscreen → nearest-neighbor scaled blit as the artwork, with a per-kind tint and
  reduced alpha applied via canvas compositing. The render contract: previous vs next
  distinguishable, ghosts dimmed, committed artwork on top, ghost transparency
  preserved. Exact tint values and alpha levels are pinned by the leading design slice,
  drawn from existing design tokens.
- **Toggle state is per-tab viewport state, persisted.** A boolean beside the grid flag
  in the per-tab viewport record (default off; absent in stored records reads as off,
  so no schema-version bump and no migration). Toggling flows through the same viewport
  chain as the grid toggle and persists through the existing workspace auto-save.
  Restoring a saved document (as opposed to the live workspace) resets to the default,
  matching grid behavior.
- **Toggle UI in the transport strip.** A pressed-state toggle (`aria-pressed`)
  alongside Loop, disabled when the document has a single frame (the strip's existing
  convention), ≥44px touch target on the mobile Timeline tab, strings in en/ko/ja. The
  transport strip stays a pure view (props in, callbacks out); the wiring follows the
  grid-toggle chain.
- **Playback suppression.** While Playback runs the ghost projection empties and the
  canvas shows the playhead composite only; stopping restores ghosts. The Playback
  WYSIWYG contract (preview equals GIF export) is preserved.
- **Committed art only.** `composite_at` reads committed cels; an in-flight Floating
  Selection on the Active Frame never appears in ghosts (neighbor frames have no
  floating state by construction). No special handling needed.
- **Exports and thumbnails untouched by construction.** They read document composites
  directly, never the view pipeline — an invariant to assert, not work to do.
- **Performance: recompute on invalidation, no extra caching.** At the current
  canvas-size cap, two extra per-frame composites per invalidation are negligible;
  ghost offscreen canvases rebuild per render like the artwork blit. Caching is a
  measured follow-up only if profiling demands it.
- **Design slice leads.** Per the 187/194/200 precedent, a `.pen` design spec (toggle
  placement and icon, ghost tint treatment, disabled/mobile states, light + dark) lands
  before shell implementation, reusing existing tokens.
- **Domain vocabulary (CONTEXT.md).** Add **Onion Skin** to the Frames & Cels section:
  the per-tab view aid that renders adjacent Frames' composites as dimmed, tinted
  **ghosts** beneath the Active Frame's composite in the canvas viewport — never part
  of any document pixel output, never visible during Playback. _Avoid_: ghosting (the
  GIF-export disposal artifact), tracing (Reference Layer vocabulary), overlay (the
  tool / Floating Selection preview term), underlay (the Reference render step).

## Testing Decisions

- A good test asserts **external behavior at a seam** — ghost descriptors and buffer
  contents, draw-call order and arguments, ARIA state, persistence round-trips — never
  internal representation.
- **Neighbor pure function** (unit): a middle frame yields previous + next; first/last
  clamp to one side; a single frame yields none; counts flow from the config; no
  wrap-around. Prior art: the playback-advance decision tests.
- **Tab-state ghost projection** (real-WASM integration — the highest behavior seam):
  enabling exposes ghosts whose pixels equal the neighbors' `composite_at`; toggle off
  / Playback running / single frame → empty; switching the Active Frame re-targets
  ghosts; undo/redo and neighbor edits refresh ghost pixels; computing ghosts pushes no
  History entry and leaves the document unchanged. Prior art: the composite-buffer
  playback tests.
- **Renderer** (mock-context draw-order): ghosts render between the Reference underlay
  and the pixel composite, farthest first; tint and alpha are applied and reset;
  smoothing stays off for ghost blits; an empty ghost list draws nothing extra. Prior
  art: the renderer draw-order tests.
- **Transport strip component** (pure view): the toggle fires its callback, reflects
  pressed state, disables at a single frame, and carries the localized label. Prior
  art: the transport strip's play/loop tests.
- **Persistence**: the viewport record round-trips the new flag; a stored record
  without the flag reads as off. Prior art: the session-persistence viewport tests.
- **E2E** (one thin tracer): author two frames with distinct art, enable onion skin,
  assert a canvas pixel differs from the background where only the neighbor has art,
  disable and assert it returns to background; reload and assert the toggle state was
  restored. Prior art: the playback E2E and the frames reload-persistence tests with
  the canvas pixel-reading fixtures.

## Out of Scope

- **Range configuration UI** (previous/next counts beyond 1/1) — the internal config is
  parameterized; the control surface is a follow-up.
- **Tint/opacity customization** — no user-facing appearance settings in v1.
- **Loop-aware wrap-around ghosts** (last ↔ first neighbors for cycles).
- **Layer-scoped onion skin** ("current layer only" mode) — ghosts composite the whole
  frame.
- **Ghosts during Playback** — deliberately suppressed, not an option.
- **A dedicated keyboard shortcut** — the shortcut space is governed by the keyboard
  shortcut review; a candidate follow-up.
- **Apple shell** — the preserved single-canvas model has no frame axis, per the
  standing web-document-layer decision.
- **Onion skin in any export or thumbnail** — never.
- **Caching / performance schemes** beyond recompute-on-invalidation.

## Further Notes

- **Sequencing sketch for `/to-issues`** (each slice keeps `main` shippable):
  1. `.pen` design slice (HITL, `/ui-design`) — transport toggle + ghost treatment.
  2. Shell state slice — the pure neighbor function, the tab-state ghost projection,
     the viewport flag + persistence.
  3. Render + UI slice — the renderer draw step, the transport toggle wiring, i18n,
     E2E.

  `/to-issues` owns the actual cuts.
- **Direction fit**: serves all three future directions at once — learning aid (seeing
  motion flow is a teaching primitive), game dev (walk/idle cycles), casual (smoother
  hobby animations) — a multi-direction investment per the project guidance.
- **The landing page already promises this**: the roadmap blurb lists "onion skinning"
  alongside layers and timeline; this PRD delivers that promise.
- **Vocabulary guard**: PRDs 213/216 use "ghosting" for the GIF disposal artifact; the
  Onion Skin entry's avoid-list keeps the two senses separate.
- **Theme note for the design slice**: the canvas backdrop (checkerboard) is
  theme-independent, so ghost tints are single values legible on that backdrop, not
  theme-paired tokens.
- **Zero core seams added**: `composite_at` (201) was built for exactly three readers —
  Playback, export, onion skinning. This PRD is the third and final planned reader; the
  seam ledger for M4 closes with one shared primitive, as designed.
