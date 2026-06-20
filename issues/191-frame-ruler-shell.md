---
title: "Frame ruler shell + selection — TimelinePanel"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/document-frame-projection.ts` | New read seam — `readDocumentFrameProjection` (pure fn) projects the Frame axis: frames in order, active frame, per-Cel occupancy |
| `src/lib/canvas/document-frame-projection.test.ts` | Projection tests: axis order, active frame, occupancy true/false, per-frame, Reference excluded |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `frameProjection` getter (renderVersion-cached), mirroring `layerProjection` |
| `src/lib/ui-editor/TimelinePanel.svelte` | Layer × Frame grid (pure view): ruler ordinals, cel dots, Reference spanning bar, 2-channel active highlight, ruler/cell selection, read-only collapsed summary, mobile sizing |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | Component tests: column count, dots, spanning bar, active highlight + aria-current, select callbacks, active-layer row tint, collapsed read-only |
| `src/lib/ui-editor/TimelinePanel.stories.svelte` | New stories: MultiFrame, WithReferenceLayer, ManyFramesScroll, SingleFrame, Collapsed (multi-frame grid is only visible here until 192) |
| `src/routes/editor/+page.svelte` | Wires `frames`/`activeFrameId` + `onSelectFrame`/`onSelectCel` (desktop + mobile) |
| `messages/{en,ko,ja}.json` | i18n: collapsed summary, Reference span caption, frame/cel select aria |

### Key Decisions
- Cel occupancy is computed web-side via `cel_pixels_at` behind an isolated `hasContent` seam, so a future core `cel_is_empty` (bool, no buffer copy) can replace it without touching the panel or page — no Rust/WASM rebuild this slice.
- Multi-frame persistence deferred to 192: with no frame-add UI yet, runtime holds a single frame, so "survives reload" is satisfied by the single-frame collapse; the snapshot frame-axis seam opens with 192.
- The frame projection is a **pure function**, not a class — unlike `DocumentLayerProjection` it holds no source cache, so the stateless-transform guideline applies.

### Notes
- Built to the finalized 187 `.pen` spec, verified against it via Storybook screenshots: ruler 24px / bg-elevated, active-layer row tint across both panes, active cel = accent border + accent dot, Reference spanning bar with image icon + "underlay — same under every frame", collapsed read-only `Frame n / N`, mobile 40px cells / 140px sidebar.
- Reserved but not built (a later M4 slice): the transport strip above the ruler. Out of scope and pending: frame add/duplicate/delete/reorder UI (192).
- Backlogged follow-up: TimelinePanel mobile touch targets — pre-existing 24px header/row icon buttons stay below ≥44px on the mobile Timeline tab (187 §5).
