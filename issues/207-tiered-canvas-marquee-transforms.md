---
title: "Tiered transforms — split flip/rotate into Canvas Transform and Marquee Transform tiers (PRD)"
status: done
created: 2026-07-04
---

## Problem Statement

DOTORIXEL shows four transform buttons — Flip Horizontal, Flip Vertical, Rotate
Right, Rotate Left — in a single "Transform" section directly under "Canvas
Size" (settings sheet and right panel). They read as four parallel canvas-level
operations, but with no Marquee active their scope silently diverges:

- **Flip** mirrors only the active Pixel Layer's active-frame Cel. Every other
  layer and every other frame stays untouched, so a multi-layer or animated
  Document comes out visually broken after what looked like a whole-canvas flip.
- **Rotate** turns the entire Document — every Cel of every Pixel Layer across
  every Frame — swaps the canvas width/height, and additionally rotates the
  Reference Layer the artist had positioned for tracing.

With a Marquee active, both buttons quietly switch to transforming the selected
region instead. Nothing in the UI signals any of this, so users cannot predict
what a transform button will affect. The flip/rotate difference in Reference
Layer treatment (filed as issue 206) is one symptom of this missing structure.

Established pixel-art editors avoid the problem by separating two symmetric
tiers: in Aseprite, *Sprite > Rotate Canvas* (including Flip Canvas) always
transforms the whole sprite — all layers, all frames — while *Edit > Flip* and
the transform tool operate on the selection/active cel. Flip and rotate are
symmetric within each tier.

## Solution

Adopt the same two-tier model, named in our domain vocabulary:

- **Canvas Transform** — the buttons grouped with Canvas Size always transform
  the whole artwork: every Pixel Layer, every Frame; rotate also swaps the
  canvas dimensions. The Reference Layer stays fixed (it is a tracing overlay,
  not artwork). An active Marquee is carried through the same mapping and
  clipped, so the selection still covers the same content afterwards. Button
  labels name the canvas scope (e.g. "Flip Canvas Horizontal") so the scope is
  visible at the trigger.
- **Marquee Transform** — flipping or rotating a selected region lives with the
  selection: the SelectionActionBar's flip/rotate actions transform only the
  Marquee region of the active Pixel Layer's active-frame Cel, exactly as they
  do today.

One button, one scope — no hidden mode switching, and flip/rotate become
symmetric within each tier.

## User Stories

1. As a pixel artist, I want the transform buttons grouped with Canvas Size to
   transform my whole artwork, so that buttons the UI presents together behave
   consistently.
2. As a multi-layer artist, I want a canvas flip to mirror all Pixel Layers
   together, so that composed artwork (line art, colors, shading) stays aligned
   after the flip.
3. As an animator, I want a canvas flip to mirror every frame, so that my
   animation stays coherent instead of only the active frame flipping.
4. As a pixel artist, I want canvas flip and canvas rotate to have the same
   scope, so that I don't have to remember which one means "whole document" and
   which means "just this cel".
5. As an artist tracing a reference, I want the Reference Layer to stay exactly
   where I placed it when I rotate the canvas, so that my tracing setup is not
   disturbed.
6. As an artist tracing a reference, I want canvas flips to leave the reference
   untouched too, so that both canvas transforms treat the reference the same
   way.
7. As a returning user with a saved document containing an already-rotated
   reference, I want it to keep rendering and sampling exactly as I saved it, so
   that this change never corrupts existing work.
8. As a pixel artist with an active selection, I want the Marquee to follow a
   canvas transform (mirrored/rotated with the artwork and clipped to the new
   bounds), so that my selection still covers the same content afterwards.
9. As a pixel artist, I want pressing a canvas transform while a selection
   exists to still transform the whole canvas rather than silently switching to
   region mode, so that a button always does what its label says.
10. As a pixel artist, I want the flip/rotate actions on the SelectionActionBar
    to transform only the selected region of my active layer, so that region
    edits stay local.
11. As a pixel artist, I want the canvas-tier buttons labeled with "Canvas", so
    that I can tell them apart from the selection's region transforms at a
    glance.
12. As a user, I want a canvas transform to be a single undo step that restores
    pixels, canvas dimensions, and my selection together, so that one undo fully
    reverses it.
13. As an animator, I want playback to stop when I apply a canvas transform, so
    that I see the result on the frame I am editing rather than a moving
    preview.
14. As a pixel artist with an uncommitted Floating Selection, I want it
    committed before a canvas transform runs, so that lifted pixels are not
    lost mid-air.
15. As a pixel artist, I want to flip a single layer's current frame by
    selecting all and using the selection's flip, so that the old
    single-cel flip capability remains achievable.
16. As a Korean or Japanese user, I want the new canvas-scoped labels
    translated, so that the scope is just as clear in my language.
17. As a mobile user, I want the compact settings sheet to expose the same
    canvas-scoped transforms, so that behavior matches across breakpoints.

## Implementation Decisions

- **Two explicit core operation sets on `Document`.** The current
  Marquee-presence dispatch inside flip/rotate is removed. Canvas Transform ops
  (flip H/V, rotate CW/CCW) act on the whole Document; Marquee Transform ops act
  on the Marquee region of the active Pixel Layer's active-frame Cel. Names
  follow the domain terms.
- **Canvas flip** mirrors every Pixel Layer's every Cel in place; canvas
  dimensions are unchanged. **Canvas rotate** keeps the existing
  whole-document behavior (every Cel of every Pixel Layer rotated, width/height
  swap) minus the Reference remap.
- **Reference Layer is excluded from Canvas Transforms** (absorbs issue 206,
  Option B — the Aseprite fixed-overlay convention). The internal
  reference-placement remap used by rotation is deleted. The quarter-turn
  rendering/sampling/persistence machinery — including the core
  Reference Footprint (issue 204) — is kept so already-saved rotated references
  still render and sample correctly; only new production of reference rotation
  stops.
- **Marquee co-transform** (grilling Q1): a canvas flip mirrors the Marquee
  rectangle across the canvas axis; a canvas rotate maps it through the same
  quarter-turn into the swapped dimensions; the result is clipped to the new
  canvas. It stays non-empty by construction because the source rectangle was
  in-bounds.
- **Canvas Transforms are active-layer-agnostic** — they apply even while the
  Reference Layer is active. Marquee Transforms remain no-ops on a Reference
  Layer (and the SelectionActionBar is hidden there per issue 205).
- **Web journal intents split** into canvas/marquee variants. Each Canvas
  Transform is one undoable Document History entry; the existing mutate path
  keeps stopping Playback and committing a pending Floating Selection first.
- **Trigger surfaces**: the settings content and the right panel dispatch only
  Canvas Transform ops (no longer Marquee-aware); the SelectionActionBar
  dispatches only Marquee Transform ops.
- **WASM + TS facade**: bindings expose the split ops; the compile-time
  structural-compatibility check keeps the facade interface and the fake
  document in lockstep.
- **i18n**: new message keys for the canvas-scoped labels (en/ko/ja), following
  the "Flip Canvas …" naming direction (grilling Q2; exact copy is a design
  detail). SelectionActionBar labels are unchanged.
- **Domain vocabulary** (grilling Q3): "Canvas Transform" and
  "Marquee Transform" recorded in CONTEXT.md at design time (precedent:
  Reference Footprint in issue 204).
- **Apple shell untouched** — it has no Document binding; `cargo build
  --workspace` must stay green.

## Testing Decisions

- **Behavior over implementation**: assert observable outcomes — pixel values
  and positions, canvas dimensions, Marquee coordinates, Reference placement
  values — through public APIs; never private structure. A canvas-transform
  test should read as its specification.
- **Core `Document` unit suite is the primary seam** (existing): canvas
  flip/rotate parity across all Pixel Layers and all Frames; width/height swap
  on rotate; Reference placement unchanged through both canvas transforms;
  Marquee co-transform + clip; identity round-trips (flip twice, rotate four
  times — prior art: the existing whole-document rotate tests and the
  four-turns-restore round-trip).
- **Web TabState suite** (existing seam): intent routing for the split ops; a
  canvas transform is one undo step restoring pixels + dimensions + Marquee
  (prior art: the flip undo-restore tests); playback stops on transform (prior
  art: the stop-on-mutate playback tests).
- **Component tests** (existing seam): settings/right-panel buttons dispatch
  canvas ops both with and without a Marquee; the SelectionActionBar dispatches
  marquee ops (prior art: the existing component tests for these components).
- **WASM**: native smoke tests for the split ops; the compile-time structural
  check (`wasm-sync`) guards the facade contract.
- **No new E2E**: no transform-feature E2E exists today and the unit/component
  seams above cover the behavior; revisit only if a rendering-integration gap
  appears.

## Out of Scope

- New transform operations (180° rotate, arbitrary-angle rotation, transform
  handles/tool).
- Issue 205 (selection UI stuck while a Reference Layer is active) — separate
  fix, only adjacent.
- Option A — adding a mirror/flip field to the Reference placement so the
  reference could follow the artwork.
- Migrating already-saved rotated references to un-rotated; they keep rendering
  as saved.
- Keyboard shortcuts for transforms (none exist today; adding them is a
  separate feature).
- Apple shell transform UI (platform-status: Apple ⬜ for flip/transform).

## Further Notes

- **Supersedes issue 206** — its "exclude the Reference Layer from whole-canvas
  transforms" decision becomes part of the Canvas Transform tier definition.
  Fold it in as a sub-issue (re-parent) when this PRD is broken down.
- **Origin**: the flip/rotate asymmetry surfaced during manual regression
  testing of issue 204; the tier design was confirmed through a grilling pass
  (Marquee co-transform = Q1-A; canvas-scoped labels = Q2-A; tier names = Q3).
- **Research** (editor conventions):
  [Aseprite transformations](https://github.com/aseprite/docs/blob/main/transformations.md)
  ("Canvas-level transformations affect the entire canvas/sprite globally";
  selection-tier transforms apply to the timeline selection or active cel),
  [Rotate Canvas](https://www.aseprite.org/docs/rotate-canvas/),
  [Edit > Flip](https://www.aseprite.org/docs/flip/),
  [reference-layer rotation thread](https://community.aseprite.org/t/can-you-rotate-the-reference-layer/705)
  ("not possible yet" — reference layers are Move-tool-only overlays),
  [how to work with references](https://community.aseprite.org/t/how-to-work-with-references/14684),
  [Pixquare canvas docs](https://docs.pixquare.art/settings/canvas)
  ("flip everything on the canvas").
