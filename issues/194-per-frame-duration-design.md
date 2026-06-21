---
title: "Per-frame duration control design — M4 (.pen)"
type: design
status: done
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

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` → `194 — Per-frame Duration Control Design Spec` | New finalized spec sheet in the FEATURE SPECS band (sibling to 187). 6 sections: Desktop expanded Light · Desktop expanded Dark · Anatomy/control states (default / focused-editing / clamped) · Desktop collapsed · Mobile (Timeline tab) · Design notes. |
| `docs/pencil-dotorixel.pen` → `194 — … Placement Candidates (HITL · A chosen)` | HITL candidate-comparison frame (3 placements), moved to the exploration zone (below Layer UI Candidates) and kept per the canvas keep-don't-delete policy. |
| `docs/agents/pencil-canvas.md` | FEATURE SPECS row map updated to include 194. |

### Key Decisions

- **Placement — left corner (Candidate A)**: the active-frame duration editor reuses the previously-empty top-left corner, aligned with the ruler, so it reads as the selected frame's property with no new row/height and no collision with the reserved transport strip. Chosen over a bottom footer strip (B) and a header-right field (C) via visual HITL comparison.
- **Surfacing — active-frame-only**: the ruler stays ordinal-only (no per-cell ms captions); the corner edits whichever frame is selected.
- **Control — plain numeric input**, commits on Enter/blur so one retime = one undo step (coalescing falls out — PRD US16). Steppers/scrub deferred.
- **Unit — ms** as source of truth + a **read-only derived fps helper** (1000/ms): shown on desktop, dropped on mobile.
- **Clamp 1–60000 ms**: out-of-range snaps to the bound on commit; empty/invalid reverts to the prior value.
- **Collapsed**: the 187 summary gains a read-only `· <ms>` token (`Layers · <layer> · Frame n/N · 250 ms`); editing only when expanded.
- **Mobile**: ruler + corner grow to ≥48px for a comfortable touch target (also enlarging frame ordinals); sidebar ~140px; fps dropped. Touches 187's mobile ruler height — pairs with the TimelinePanel mobile touch-targets backlog.

### Notes

- The `.pen` lives in the Pencil-app worktree (`…/dotorixel-codex/docs/pencil-dotorixel.pen`) — **commit it from there**, not from this worktree.
- Mobile is shown as a bare timeline-panel region (not full phone chrome) — approved as sufficient for a control-focused spec; full chrome can be added later if wanted.
- A session render-cache glitch (blank screenshots / +50px offset) recurred during heavy edits; structure was verified via `snapshot_layout` and cleared by a Pencil reopen (documented in `docs/agents/pencil-canvas.md`).
- Unblocks **198 (TimelinePanel duration control)**; **195 (Rust core)** runs in parallel. PRD 193 stays open (195–198 remain).
