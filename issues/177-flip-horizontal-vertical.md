---
title: "Flip horizontal & vertical — region and active layer"
status: ready-for-agent
created: 2026-06-14
parent: 176-flip-and-rotate-transforms.md
---

# Flip horizontal & vertical

## Parent

[176 — Flip & rotate transforms](176-flip-and-rotate-transforms.md)

## What to build

The first tracer bullet for the transform feature: a complete end-to-end **flip
horizontal** and **flip vertical** path that also stands up the shared transform
pipeline (Rust primitive → Document mutator → WASM → Change Journal intent → TS
dispatch → UI → i18n) that later rotation slices extend.

Behaviour:

- The flip operation resolves its target **at apply time** from Document state:
  - **Marquee active** → mirror the pixels inside the Marquee on the active Pixel
    Layer; pixels outside the region and the Marquee position itself are
    unchanged.
  - **No Marquee** → mirror the **entire active Pixel Layer** in place (canvas
    dimensions unchanged).
- When the active layer is a **Reference Layer**, flip is a silent no-op (matches
  the existing drawing/clear no-op contract) and captures no undo snapshot.
- A live **Floating Selection** is committed first (as `resize` does via
  `#commitIdleFloatingSelection()`), then the flip applies to committed pixels.
- Each flip is a single undoable step in the Document Change Journal; redo
  re-applies it.

Entry points (both dispatch the same operations; target resolved by Marquee
state):

- **SelectionActionBar**: Flip H / Flip V actions (Lucide `FlipHorizontal` /
  `FlipVertical`), following the existing `SelectionAction` array pattern.
- **RightPanel → Canvas section**: a new **Transform group** (sibling to the
  resize control and Clear button) with Flip H / Flip V.

Reuse the existing region seams where natural (`lift_region` / `composite_region`)
and add whole-canvas in-place flips on `PixelCanvas`. New journal intents:
`flip-horizontal`, `flip-vertical` (no payload; target resolved in Rust). i18n
keys added to `en` / `ko` / `ja` (e.g. `action_transformFlipHorizontal`,
`action_transformFlipVertical`, and a `section_transform` group label).

## Acceptance criteria

- Flip H and Flip V are available from the SelectionActionBar (when a Marquee is
  active) and from the RightPanel Transform group (when none is).
- With a Marquee on a Pixel Layer, flip mirrors pixels within the region only;
  pixels outside are untouched and the Marquee position is unchanged.
- With no Marquee, flip mirrors the entire active Pixel Layer; canvas dimensions
  are unchanged.
- With a Reference Layer active, flip is a silent no-op and captures no undo
  snapshot.
- A live Floating Selection is committed before the flip applies.
- Each flip is a single undo step; undo restores the prior pixels exactly and
  redo re-applies.
- Button labels are localized in en / ko / ja.
- Rust unit tests cover buffer/region/whole-canvas flip including 1×1 region,
  region flush against each edge, partially off-canvas region, and double-flip
  identity.
- Journal tests cover: one snapshot captured per flip, undo restores, and the
  Reference-active guard suppresses the snapshot.
- Component tests cover: both entry points render the actions and invoke their
  handlers with localized labels.

## Blocked by

None - can start immediately.
