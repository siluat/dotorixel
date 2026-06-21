---
title: "Per-frame duration control design — M4 (.pen)"
type: design
status: ready-for-agent
created: 2026-06-21
parent: 193-per-frame-speed-control.md
---

## Parent

[193 — Per-frame speed control (per-frame duration, M4)](193-per-frame-speed-control.md)

## What to build

The leading (HITL) slice of PRD 193: a finalized `.pen` design spec for the
**per-frame duration editing control**, produced via `/ui-design`, sibling to the
[187 frame-ruler spec](187-frame-ruler-design.md). The control edits the **active
frame's display duration** in milliseconds, reusing the existing ruler
frame-selection (click a frame, edit its duration).

187 deliberately left per-frame-speed UI out of scope ("No … per-frame speed UI
beyond the reserved strip"), so there is no existing mockup. This is **not** the
reserved transport strip — that strip is for **global** playback (play/pause, FPS,
loop), a separate M4 item; this control is a **per-frame** property editor.

The spec must resolve:

- **Placement** of the control relative to the ruler / header / collapsed readout.
- **Control type** — numeric input vs. stepper vs. scrub.
- **Per-frame surfacing** — active-frame-only editor, and/or a small ms caption
  per ruler cell.
- **Unit** — milliseconds; optionally a derived read-only fps helper.
- **States** — default, focused/editing, clamped (the boundary range is
  1 ms … 60 000 ms).
- **Desktop** expanded + collapsed, **mobile** (Timeline tab) states, **Light +
  Dark** via token theming. Mobile touch targets ≥44px.

## Acceptance criteria

- A finalized spec frame lands in the FEATURE SPECS band, named
  `194 — Per-frame Duration Control Design Spec` (sibling structure to 187 / 092).
- The control is shown bound to the active frame across desktop expanded,
  collapsed, and mobile states, in both Light and Dark.
- The spec specifies control type, ms unit (and whether fps is shown), placement,
  per-frame surfacing, and the clamp/edge states.
- Tokens only (`--ds-*` / the `.pen`'s `$--*`); no new tokens without approval.
- The reserved transport strip is **not** built or extended (global playback stays
  out of scope).
- The `00 — CANVAS GUIDE` frame, `docs/agents/pencil-canvas.md`, and the spec↔issue
  map are updated if layout/naming changes.
- The user reviews and approves the design (HITL).

## Blocked by

None — can start immediately (runs in parallel with 195; only 198 depends on it).
