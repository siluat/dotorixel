---
title: "Reference Layer: UX detail design (Timeline Panel updates + placement overlay)"
status: needs-triage
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
