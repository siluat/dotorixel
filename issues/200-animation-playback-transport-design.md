---
title: "Animation playback transport strip — design (.pen)"
type: design
status: done
created: 2026-06-23
parent: 199-animation-playback-transport.md
---

## Parent

[199 — In-editor animation playback (transport strip + preview, M4)](199-animation-playback-transport.md)

## What to build

The leading HITL design slice of PRD 199: finalize the **transport strip** in
`docs/pencil-dotorixel.pen`, filling the slot 187 reserved as a dim placeholder
above the frame ruler ("play/pause · FPS · loop", never built). The UI slice (203)
implements against this spec; the engine slices (201, 202) are design-independent and
run in parallel, so this is not on the critical path for the bulk of the work — only
203 waits on it.

Produce a finalized spec frame `199 — Animation Playback / Transport Strip Design
Spec` in the FEATURE SPECS band (sibling to `187 — Frame Ruler` and `194 — Per-frame
Duration Control`), covering:

- **Anatomy** — the transport strip in the reserved slot above the ruler. Minimum
  control set: **Play/Pause** (a toggle that shows its state) and a **Loop** toggle
  (that shows its state). Decide the single-toggle vs. separate Play / Pause / Stop
  affordance split.
- **Playhead treatment** during playback — the indicator for the currently-displayed
  frame, **visually distinct from the Active-Frame 2-channel highlight** (which marks
  the edit pointer and does *not* move during playback). Resolve how the two coexist
  without collision (a moving marker over the ruler / a separate playhead channel / a
  strip read-out).
- **"FPS" is a derived read-out only**, not a global-speed input — per PRD 193,
  per-frame ms is the source of truth. Decide whether to surface a derived fps at all.
- **Desktop expanded** (Light + Dark via tokens).
- **Mobile** (Timeline tab) — where the strip sits; touch targets ≥44px.
- **Single-frame / empty state** — any disabled or degraded treatment when there is
  nothing to animate.
- **Accessibility** — keyboard reachability and state announcement (e.g.
  `aria-pressed`) for the play/pause and loop controls.

## Design Plan — resolved in grill (do not re-litigate)

- **Placement = full-width fixed bar.** A dedicated transport bar spanning the full
  panel width, inserted between the header and the `[duration-corner | ruler]` band.
  It never scrolls (global controls stay put while the frame area scrolls). Cost: the
  panel grows ~28px (≈180 → ≈208). Chosen over (B) an above-ruler sticky-left strip
  and (C) header-integrated controls, via a 3-variant placement study.
- **Control model = single Play/Pause toggle.** One button morphs play ⇄ pause.
  Stopping returns the canvas to the Active Frame (which never moved) — matches the
  PRD transient-playhead invariant and the Aseprite precedent. No separate Stop
  button; no pause-resume-mid-playback in the MVP.
- **Playhead = sweeping ▾ marker.** A floating ▾ glyph above the ruler moves
  frame-to-frame during playback; the static Active-Frame highlight (2px top-bar +
  accent-subtle fill) stays visible. Two distinct channels (marker = transient
  playhead, top-edge bar/fill = edit pointer) — no fill collision.
- **Bar contents (left → right):** the Play/Pause button (accent-filled, primary),
  the Loop toggle (lucide `repeat`; off = secondary, on = accent fill +
  `aria-pressed=true`, a 2-channel color-blind-safe state), and a right-aligned
  **`n / N` position readout** (playhead frame while playing, Active-Frame ordinal
  when stopped; small `text-tertiary`).
- **No fps in the bar.** Per PRD 193, per-frame ms is the source of truth; the
  duration corner already surfaces a derived fps. A bar-level fps would imply a global
  speed it does not control.
- **Single-frame state:** Play is disabled when the document has one frame (nothing to
  animate).
- **Mobile (Timeline tab):** same placement (full-width bar between header and the
  band); play/pause + loop touch targets ≥44px; the readout persists.
- **Accessibility:** the bar is a `role="toolbar"` labelled "Playback"; Play/Pause and
  Loop expose state via `aria-pressed` and are keyboard-operable (Enter/Space); the ▾
  marker's motion respects `prefers-reduced-motion` (per-frame advances are content
  and remain instant).

## Acceptance criteria

- A finalized `199 — …` spec frame exists in the FEATURE SPECS band with **desktop
  (Light + Dark)** and **mobile** states.
- Play/Pause and Loop controls are specified with explicit playing/paused and
  loop-on/off state treatments.
- The **playhead** treatment is specified and is visually distinct from the
  active-frame highlight (no collision with the edit-pointer channel).
- Mobile touch targets are ≥44px; the canonical mobile chrome (`mStatusBar` /
  `mAppBar` / `Tab Bar`) is **reused** (copied from an `Editor — Mobile *` frame), not
  reinvented.
- Tokens only (`$--*` / `--ds-*`); no new tokens without approval.
- The strip grows in the reserved slot without restructuring the 187 panel (header +
  ruler + grid stay constant).
- `docs/agents/pencil-canvas.md` and the `00 — CANVAS GUIDE` frame are updated (band
  map + spec↔issue map gain the new spec).
- Human design review is obtained (HITL).

## Blocked by

None — can start immediately (runs in parallel with 201).

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` → `199 — Animation Playback / Transport Strip Design Spec` | New finalized spec sheet in the FEATURE SPECS band (right of 194): §1 Anatomy (transport bar + ▾ playhead vs Active-Frame, with legends) · §2/§3 Desktop in-context Light/Dark (full panel, playing state) · §4 States (idle / playing / loop-on / single-frame disabled) · §5 Mobile (≥44px) · §6 Design notes. |
| `docs/pencil-dotorixel.pen` (scratch) | A 3-variant placement study was built to choose placement, then removed after the decision. |
| `docs/agents/pencil-canvas.md` | FEATURE SPECS row gains `199 Animation Playback / Transport Strip (M4)`. |

### Key Decisions

- **Placement = full-width fixed bar** (between header and the `[duration-corner | ruler]` band), chosen over an above-ruler sticky-left strip and header-integrated controls via a 3-variant placement study. Grows the panel ~28px — a deliberate, documented bend of 187's "grow without restructuring".
- **Single Play/Pause toggle**; stopping returns to the Active Frame (the transient-playhead invariant from PRD 199; Aseprite precedent). No separate Stop.
- **Playhead = sweeping ▾ marker** above the ruler — a channel kept separate from the static Active-Frame highlight (top-bar + accent-subtle), so the edit pointer and the playhead never collide.
- **Bar contents:** Play/Pause + Loop (2-channel on-state: accent fill + outline) + a right-aligned `n / N` readout. **No global fps** — per PRD 193, per-frame ms is the source of truth.

### Notes

- §5 Mobile focuses on the bar's ≥44px touch targets; the full mobile Timeline chrome (`mStatusBar` / `mAppBar` / `Tab Bar`) is already specced in 187.
- The full grill resolution (8 decisions) is captured in the **Design Plan** section above (do not re-litigate).
- Pencil screenshots hit the known stale-render-cache glitch (blank); structure was verified via `snapshot_layout` (no layout problems) and the user reviewed in-app after a refresh.
- Unblocks **203** (Transport strip UI) — which still also needs **202**. The next actionable slice is **201** (per-frame composite seam, no blockers).
