---
title: "Onion skin transport toggle + ghost treatment — design (.pen)"
type: design
status: done
created: 2026-07-05
parent: 217-onion-skinning.md
---

## Parent

[217 — Onion skinning — adjacent-frame ghosts while editing (M4)](217-onion-skinning.md)

## What to build

The leading `.pen` design slice for PRD 217, sibling to the 187 / 194 / 200 design
slices: a finalized spec frame in the FEATURE SPECS band of the Pencil canvas that the
implementation slices (219, 220) build against. Run via `/ui-design`; read the pencil
canvas guide first and reuse existing `$--*` tokens — no new tokens without approval.

Design decisions this spec must resolve:

- **Transport toggle**: icon choice, position within the transport strip (relative to
  Loop and the position readout), idle / pressed / disabled treatments, tooltip and
  accessible label, light + dark, and the mobile Timeline-tab variant (≥44px touch
  target inside the 56px strip).
- **Ghost treatment**: the exact warm tint (previous frame) and cool tint (next frame)
  values drawn from existing tokens, the ghost alpha level, and how tint + dimming
  compose so ghosts read clearly against the checkerboard while committed artwork
  stays unmistakably on top. Include a worked canvas mock showing an Active Frame with
  a previous and a next ghost.
- **Disabled state** at a single frame, matching the strip's existing Play/Loop
  convention.
- **Theme note** (from the PRD): the canvas backdrop is theme-independent, so ghost
  tints are single values legible on the checkerboard, not theme-paired tokens.

## Design Plan — resolved in grill (do not re-litigate)

1. **New token pair approved**: `--ds-onion-prev` (red family) / `--ds-onion-next`
   (blue family) — the palette has no cool color, and red/blue follows the Aseprite
   convention while staying distinguishable under red-green color blindness.
   Single values, not theme-paired (the canvas backdrop is theme-independent).
   Mirrored in the `.pen` file as `$--onion-prev` / `$--onion-next`. Initial
   candidates: prev `#E5484D`, next `#3B82F6` — tuned against the checkerboard in
   the worked mock during review.
2. **Tint recipe**: medium-strong — ~60% tint blend over the ghost's own colors,
   ~40% overall ghost alpha. Direction reads clearly while some of the neighbor's
   art survives for tracing. Exact numbers pinned by the mock.
3. **Toggle icon**: lucide `Ghost` — 1:1 with the domain term "ghosts", visually
   unique in the app (stack/overlap icons collide with Layer and duplicate-frame
   semantics), fits the casual tone.
4. **Toggle position**: third control in the left cluster — `[Play] [Loop] [Ghost]`
   … `[n / N]`. Keeps the bar's grammar (interactive controls left, read-only info
   right), places the playback-suppression cause next to its effect, and keeps the
   mobile 44px touch layout natural.
5. **On-state treatment**: mirrors the Loop toggle's two-channel on-state (accent
   fill + outline, color-blind safe) with `aria-pressed`.

## Acceptance criteria

- A finalized spec frame lands in the FEATURE SPECS band, named per the canvas guide
  conventions, covering: anatomy, toggle states (idle / on / disabled), desktop
  light + dark, mobile Timeline tab (≥44px), and the ghost tint/alpha spec with token
  references.
- Previous vs next ghosts are visually distinguishable (warm vs cool) and both are
  clearly dimmer than committed artwork in the worked mock.
- Accessibility is specified: `aria-pressed` toggle semantics, focus treatment per
  existing editor conventions.
- No new design tokens introduced without explicit approval.
- The pencil canvas guide docs (band map, spec↔issue map) and the `00 — CANVAS GUIDE`
  frame are updated.
- Human design review completed (HITL slice).

## Blocked by

None — can start immediately (runs in parallel with 219). Unblocks 220.

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | `218 — Onion Skin Design Spec (M4)` appended to the FEATURE SPECS band (right of the 199 sheet): grill-decision chips, §1 bar anatomy `[Play · Loop · Ghost]` with legend, §2 worked ghost example (a bounce on a checkerboard — prev/next ghost swatches computed with the real 60%-blend / 40%-alpha formula, Active art on top of the overlaps), §3 states (off / on / on-while-playing-suppressed / single-frame disabled), §4 dark, §5 mobile ≥44px in the 56px strip, §6 pinned notes. Registered the approved token pair `$--onion-prev #E5484D` / `$--onion-next #3B82F6`. |
| `docs/agents/pencil-canvas.md` | FEATURE SPECS row gains `218 Onion Skin (M4)`. |

### Key Decisions

- All grill decisions are recorded in the **Design Plan** block above (token pair,
  60/40 recipe, lucide `ghost` icon, left-cluster position, Loop-mirrored on-state).
- The worked mock computes the ghost swatches with the actual blend formula rather
  than eyeballing colors, so the spec is an honest preview of the implementation.
- §4 Dark carries only the transport bar: ghost tints do not theme (they render on
  the theme-independent canvas checkerboard), stated in the sheet.

### Notes

- **220 must mirror the pair into the web tokens** (`--ds-onion-prev` /
  `--ds-onion-next` in the design-token stylesheet) and source the canvas tint
  constants from them — the `.pen` registration alone doesn't reach the shell.
- The `00 — CANVAS GUIDE` frame needed no change (it doesn't enumerate individual
  specs; the per-spec map lives in `docs/agents/pencil-canvas.md`).
- Initial hexes are review-tunable candidates; if in-app ghosts read muddy over
  low-saturation art, the blend ratio (not the alpha) is the knob to turn first.
