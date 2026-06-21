---
title: "Per-frame duration — TimelinePanel control + i18n + E2E"
status: ready-for-agent
created: 2026-06-21
parent: 193-per-frame-speed-control.md
---

## Parent

[193 — Per-frame speed control (per-frame duration, M4)](193-per-frame-speed-control.md)

## What to build

Complete PRD 193 by wiring the per-frame duration control into the TimelinePanel
per the [194 design spec](194-per-frame-duration-design.md): the user selects a
frame and edits how long it is held, with undo/redo, persistence, and an E2E
tracer. This is the end-to-end demoable slice (the capstone, as 192 was for frame
management).

- `FrameColumn` gains a `durationMs` field; the panel renders the **active
  frame's** duration per the 194 design.
- A new `onSetFrameDuration(frameId, durationMs)` callback prop, wired in
  `+page.svelte` on **both** the docked and mobile TimelinePanel instances to
  `tab.setFrameDuration` — mirroring how `onReorderFrame` → `tab.reorderFrame` is
  wired. The dispatch fires on **commit** (release / blur / Enter) so one
  adjustment is one undo step (the 196 coalescing contract).
- `TimelinePanel` stays a **pure view** (props in, callbacks out — the 093
  decision); no WASM awareness.
- New i18n keys for the duration control's label / aria in en / ko / ja.

## Acceptance criteria

- The duration control matches the 194 design (placement, control type, ms unit,
  states) in both Light and Dark.
- The control displays the active frame's duration and updates when the active
  frame changes.
- Editing the value fires `onSetFrameDuration` with the right frame id and the
  clamped value; the change is a single undo step, and undo restores the prior
  value.
- The control is wired on both the docked and mobile TimelinePanel instances;
  mobile touch targets are ≥44px.
- Duration label / aria are localized in en / ko / ja.
- Component tests: the control displays the active frame's duration and fires
  `onSetFrameDuration` with the correct id and value.
- An E2E flow passes: set a frame's duration, reload and confirm the value
  persisted, undo and confirm the prior value is restored. (Playback timing is not
  asserted — there is no preview in this slice.)
- `TimelinePanel` remains a pure view (no WASM/`TabState` awareness).

## Blocked by

- [194 — Per-frame duration control design (.pen)](194-per-frame-duration-design.md)
- [196 — Per-frame duration WASM binding + journal intent + TabState](196-frame-duration-wasm-journal.md)
- [197 — Per-frame duration document schema V7 + snapshot persistence](197-frame-duration-schema-v7.md)
