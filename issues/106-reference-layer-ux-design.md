---
title: "Reference Layer: UX detail design (Timeline Panel updates + placement overlay)"
status: done
created: 2026-05-16
parent: 105-reference-layer-type.md
---

## Parent

[105 — Reference Layer type — tracing reference for pixel artwork](105-reference-layer-type.md)

## What to build

Detail the Reference Layer UX in the project's `.pen` design file. This slice is **HITL** — run the `/ui-design` flow.

Two surfaces are in scope:

1. **Timeline Panel additions** — a Reference Layer add icon next to the existing `+` (Pixel add); a per-row kind icon distinguishing Pixel vs Reference; the Restore original size inline action affordance (on row or near the overlay — pick one in the design and document); a loading skeleton row state.
2. **Viewport placement overlay** — corner-handle layout, body interaction zone, cursors per zone (`nwse-resize` / `nesw-resize` / `move` / tool default outside), screen-space sizing across desktop (~12px) and touch (~16px with 44pt hit-area), and the minimum-size visual treatment (placement size floor of 8×8 projected pixels).

Scope:

- Reference the existing TimelinePanel design (092 `iDAOA` frame in `docs/pencil-dotorixel.pen`) for the Timeline Panel additions.
- All design tokens come from the existing token system; new tokens require explicit agreement during the flow.
- Mobile and desktop variants for both surfaces.
- Light + Dark for both surfaces.

## Acceptance criteria

- Reference Layer add icon (next to `+`) finalized — pixel-level spec with desktop / mobile and light / dark.
- Per-row kind icon finalized — Pixel and Reference variants in active and inactive row states.
- Restore original size action affordance finalized — placement (on row or overlay) decided and documented in the `.pen`.
- Loading skeleton row state finalized.
- Placement overlay finalized — corner handles, body zone, cursors per zone, screen-space sizing across desktop and touch, minimum-size visual treatment.
- Design uses existing tokens only (or new tokens are agreed during the flow).

## Blocked by

None — can start immediately, parallel to the Rust core slices.

## User stories addressed

- Visual specification for #5, #6, #7, #8, #11, #27, #28, #31.

## Design Decisions (grilled 2026-05-16)

### Timeline Panel additions

- **Reference add icon glyph** — Lucide `image`. Reuses the same glyph as the per-row Reference kind icon, so the entry-point and identity share one mark.
- **Header button order** — Pixel `+` (left) → Reference `image` (right). Frequency-of-use order; honors PRD User Story #6.
- **Add button chrome** — identical to existing Pixel `+`. Kind is conveyed by glyph only, not by chrome differentiation.
- **Per-row kind icon position** — between the visibility eye and the layer name (`[eye] [kind] [name] [×] [≡]`). Forms a meta-info cluster on the row's left edge; keeps the name uncoupled from variable-width layer titles.
- **Pixel kind glyph** — Lucide `grid-2x2`. Aligns with the "pixel canvas" mental model and contrasts visually with `image`.
- **Reference kind glyph** — Lucide `image` (reused from add icon).
- **Active vs inactive kind icon treatment** — single asset; color inherits the row's text color hierarchy (inactive = `--text-secondary`, active = `--text-primary` over the active accent background). No separate "active variant" icon.
- **Restore original size location** — inline on the row, **only when the row is `active && kind = Reference`**. Sits to the left of the delete `×`.
- **Restore original size glyph** — Lucide `maximize-2` (diagonal corner arrows). Conveys "expand to natural size" without colliding with the generic undo metaphor.
- **Loading skeleton row** — kind-icon slot shows an animated spinner; name slot echoes the imported file's display name (fallback: localized "Loading…"). Visibility eye, delete `×`, and drag handle are visually dim (e.g., `--text-tertiary` / reduced opacity) and non-interactive during decode.
- **Busy import icon** — the `image` glyph is replaced with a spinner glyph in-place; button is disabled (cursor: default) and visually dimmed. Same footprint, no size jump.

### Placement overlay

- **Corner handle shape** — square. Accent fill (`--accent`) with a 1px `--bg-base` outer border for contrast over arbitrary reference images. Aligns with the pixel-art aesthetic; circular handles would feel vector/Figma-native and out of place.
- **Body outline** — dashed 1px (`--accent`) with a 1px `--bg-base` outer "wash". Dashed signals an editable/temporary frame, avoiding visual competition with the underlying reference image.
- **Minimum-size visual** — at the 8×8 projected-pixel floor (or whenever the body would render smaller than the handle cluster), handles "pop outside" the body and sit at the corner anchor's exterior so each remains individually targetable. Drag hits a hard stop at 8×8; no warning flash or color change.
- **Handle size** — ~12px (desktop) / ~16px (touch). PRD-fixed. Hit area extends to 44pt minimum via invisible padding.
- **Cursor zones** — corner = `nwse-resize` / `nesw-resize`; body = `move`; outside = tool default. Touch has no cursor; the always-visible overlay carries the affordance.
- **Non-active Reference Layer** — no overlay rendered. Overlay is bound to "active && kind = Reference".

## Design file

Frame **`106 — Reference Layer UX detail design`** in `docs/pencil-dotorixel.pen`:

- §1 Header — native (256×32) + 2× magnified callout (light only; header chrome is identical across themes).
- §2 Per-row kind icon — light + dark, 4 row variants per theme (Pixel inactive/active, Reference inactive/active with Restore icon).
- §3 Loading skeleton + busy import — light + dark panel showing header-with-spinner and skeleton row.
- §4 Placement overlay (normal) — light + dark, desktop (12px handle) and touch (16px handle with 44pt hit tint).
- §5 Placement overlay (min size + cursor zones) — light only. Dark variant inherits the §4 dark treatment (canvas-bg dark, accent-text on dark); only the bg/text tokens swap.

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | New top-level frame `106 — Reference Layer UX detail design` (x=-430, y=37595, w=2100). Five sections: §1 header, §2 row anatomy, §3 skeleton+busy import, §4 placement overlay normal, §5 min-size+cursor zones. Light + dark variants for §2–§4; §5 dark documented via §4 cross-reference. |
| `issues/106-reference-layer-ux-design.md` | Twelve grilled design decisions captured in "Design Decisions (grilled 2026-05-16)"; design-file map in "Design file"; results recorded here. |

### Key Decisions

- Reference add icon uses Lucide `image` (same glyph as per-row Reference kind), placed to the **right** of Pixel `+` to match frequency-of-use order. Chrome identical to existing `+`.
- Per-row kind icon sits between visibility eye and layer name (`[eye] [kind] [name] [×] [≡]`). Pixel = `grid-2x2`, Reference = `image`. Single asset; color inherits row text hierarchy — no separate active-state variant.
- Restore original size: inline on row, **only when `active && kind = Reference`**, left of delete `×`, Lucide `maximize-2`.
- Loading skeleton: spinner replaces the kind icon, name slot echoes imported file name (fallback "Loading…"), visibility/delete/drag dimmed and non-interactive.
- Busy import: header `image` glyph swaps to spinner in-place; button disabled; no size jump.
- Placement overlay handles: **square** with `--accent` fill and 1px `--bg-base` outer border. Square matches pixel-art aesthetic; circular would feel vector-native.
- Body outline: 1px dashed `--accent` + 1px `--bg-base` outer "wash" — temporary/editable signal that doesn't compete with reference image content.
- Min-size visual: at the 8×8 projected-pixel floor (or whenever body < handle cluster), handles **pop OUTSIDE** the body's corner anchors so each remains individually targetable. Drag hits a **hard stop** at 8×8 — no warning flash or color change.
- Handle size: ~12px desktop / ~16px touch (PRD-fixed). Hit area extends to 44pt minimum via invisible padding.
- Cursor zones: corner = `nwse-resize` / `nesw-resize`; body = `move`; outside = tool default. Touch has no cursor — always-visible overlay carries the affordance.
- Non-active Reference Layer renders no overlay (binding: `active && kind = Reference`).

### Notes

- §5 dark variant uses the same overlay treatment as §4 dark (square accent handles, 1px `--bg-base` border, dashed `--accent` outline; only `--canvas-bg` and `--accent-text` swap to the dark palette). This is documented in the §5 description text inside the `.pen` rather than rendered as a separate stage — there is no unique dark-mode behavior to communicate beyond what §4 already shows.
- Loading skeleton uses Lucide `loader-circle` for the spinner glyph (consistent in both the kind-slot skeleton and the busy header button).
- Implementation sub-issues (107–125) can pick handle/outline/cursor specifications directly from §4 and §5 light stages, and apply the row anatomy + kind icons from §2.
