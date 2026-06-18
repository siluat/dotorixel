---
title: "Frame ruler shell + selection — TimelinePanel"
status: ready-for-agent
created: 2026-06-18
parent: 186-frame-management.md
---

# Frame ruler shell + selection — TimelinePanel

## Parent

[186 — Frame management (add/delete/duplicate/reorder) — M4 entry](186-frame-management.md)

## What to build

Grow the TimelinePanel's static single-column placeholder ("M3 placeholder —
frame ruler grows here in M4") into the real **Layer × Frame grid** from the 187
design, with **display and selection only** — frame add/duplicate/delete/reorder
land in the next slice (192). Keep TimelinePanel a **pure view** (props in,
callbacks out, no WASM awareness) per the 093 decision; the page / `TabState`
owns the Document seam and wires `set-active-frame`.

Per the finalized [187 design spec](187-frame-ruler-design.md):

- Render a **column per frame** with 1-based ordinals in a frame ruler row; the
  `[layer row × frame column]` cell shows the cel's occupancy as a **dot**
  (content-bearing cel = dot, empty cel = blank). Thumbnails are deferred.
- The Reference Layer renders as a single **continuous spanning bar** across all
  frame columns (a muted band, not discrete cells), captioned as the underlay
  that's the same under every frame — the discrete-dots-vs-spanning-bar contrast
  is what makes frame-independence legible. The divider above the Reference row
  spans both sidebar and grid; the Reference row omits the reorder handle.
- **Active highlight (2-channel, color-blind safe)**: active frame column =
  `accent-subtle` fill across the ruler cell + the column's cells, plus a 2px
  accent bar on the ruler cell's top edge; the active cel (active row ∩ active
  column) gets combined emphasis.
- **Selection**: clicking a ruler ordinal activates the **frame only** (keeps the
  active layer); clicking a grid cell activates **both** that layer (row) and
  frame (column).
- Layout: 32px square columns; layer sidebar 256px frozen, only the frame area
  scrolls horizontally; panel height 180 expanded / 32 collapsed. Collapsed shows
  `Layers · <active layer name> · Frame n/N` (read-only).
- **Mobile**: the same grid (incl. the Reference row + spanning bar) in the
  Timeline tab takeover, narrower sidebar, frame area scrolls horizontally, touch
  targets ≥44px. Reuse the canonical mobile chrome.
- The **reserved transport strip** above the ruler is a dim placeholder only
  (future playBar) — not built here.

## Acceptance criteria

- N frames render N frame columns with correct 1-based ordinals; each Pixel Layer
  cell shows a dot when its cel has content and is blank when empty.
- The Reference Layer renders as a continuous spanning bar (not per-frame cells)
  below the divider, with no reorder handle.
- The active frame column and active cel are highlighted via the 2-channel
  treatment; the panel exposes the active frame to assistive tech (e.g.
  `aria-current`).
- Clicking a ruler ordinal fires a select-frame callback (frame only); clicking a
  grid cell fires callbacks selecting both the layer and the frame.
- Selecting a frame updates the canvas to that frame's composite and persists the
  active frame (survives reload via 190).
- Selecting a frame does not create an undo step.
- Collapsed state shows `Layers · <active layer> · Frame n/N`; the reserved
  transport strip is present as a placeholder.
- Mobile Timeline tab renders the same grid with ≥44px touch targets and
  horizontal frame scroll, using the canonical mobile chrome.
- TimelinePanel stays a pure view; component tests cover column count, active
  highlight, the spanning-bar Reference row, and select callbacks firing with the
  right ids.

## Blocked by

- [189 — Frame WASM binding + Change Journal intents](189-frame-wasm-journal-intents.md)
- [190 — Document schema V6 — frames + per-cel persistence](190-document-schema-v6-frames.md)
