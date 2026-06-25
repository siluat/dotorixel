---
title: "Shell playback controller — transient playhead engine"
status: ready-for-agent
created: 2026-06-23
parent: 199-animation-playback-transport.md
---

## Parent

[199 — In-editor animation playback (transport strip + preview, M4)](199-animation-playback-transport.md)

## What to build

The headless playback **engine** for PRD 199 — a per-tab controller that owns the
transient playhead and the clock, and feeds the playhead composite into the display
buffer the renderer already reads. No transport-strip UI yet (203 wires that); this
slice is verifiable through its API and the display buffer. The decisive contract:
**playback never mutates the Document or the Active Frame** — no dirty mark, no
history entry, no moved edit pointer.

- **State (transient, never persisted):** `isPlaying`, `isLooping`, and the current
  **playhead** frame. None of it enters the document schema, the WASM document, the
  history, or the workspace snapshot — a tab always starts stopped. **No schema
  change.**
- **Clock:** a `requestAnimationFrame` loop accumulates elapsed wall-clock time and
  advances the playhead when the accumulated time reaches the current playhead frame's
  `duration_ms` (read from `frames_metadata()`); leftover time carries into the next
  frame so variable durations don't drift. At the sequence end it loops to the first
  frame (Loop on) or stops (Loop off). The canvas re-composites (via `composite_at`,
  201) **only when the playhead frame changes**, not every tick.
- **Pure advance function (the testability seam):** the advance decision is a pure
  function — `(playheadIndex, accumulatedMs, durations, isLooping) → { nextIndex,
  carryMs, stopped }` — unit-tested deterministically with synthetic elapsed values;
  the rAF loop is a thin wrapper feeding it real deltas.
- **Display-buffer override:** while playing, the buffer the renderer reads (the
  `compositeBuffer` seam) returns `composite_at(playheadFrameId)` (no floating-
  selection overlay — playback previews committed art); while stopped it is the normal
  edit composite. **The renderer and viewport are untouched.**
- **Start resolves edit state:** starting playback first commits any in-flight Floating
  Selection (mirroring the active-frame-switch precedent in PRD 186), so the preview
  shows the committed Document.
- **Stop returns to the Active Frame:** Pause, a Loop-off completion, or a tab/document
  change discards the playhead; the canvas returns to the Active Frame, which never
  moved. **Play starts from the first frame** (predictable, repeatable).
- **Lifecycle:** switching tabs, closing a tab, or a structural document change (e.g.
  deleting the frame under the playhead) stops playback.
- **CONTEXT.md** gains **Playback** and **Playhead** in the Frames & Cels section; the
  Active Frame entry's existing _avoid_ note on "playhead" now points at a defined
  term.

## Acceptance criteria

- Starting playback exposes the playhead composite through the display buffer and
  advances it over time honoring each frame's `duration_ms`; a longer-duration frame
  holds proportionally longer.
- Playback loops with Loop on and stops on the last frame with Loop off; a single-frame
  document never advances.
- The pure advance function is unit-tested with synthetic elapsed values: advance when
  the duration is reached, proportional holds, leftover-time carry (no drift), loop vs.
  stop-at-end, single-frame no-op.
- No playback action pushes a history entry or marks the document dirty; the Active
  Frame and document state are unchanged throughout; stopping returns the display
  buffer to the active-frame composite.
- Starting playback commits an in-flight Floating Selection first.
- A tab/document change (incl. deleting the playhead frame) stops playback.
- Playback state is not persisted (a reopened/duplicated tab starts stopped); no schema
  change.
- `TabState` real-WASM integration tests assert the above via external behavior.
- CONTEXT.md gains Playback + Playhead.

## Blocked by

- [201 — Per-frame composite seam (composite_at)](201-per-frame-composite-at.md)
