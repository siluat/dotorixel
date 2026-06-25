---
title: "Transport strip UI + playhead + i18n + E2E"
status: ready-for-agent
created: 2026-06-23
parent: 199-animation-playback-transport.md
---

## Parent

[199 — In-editor animation playback (transport strip + preview, M4)](199-animation-playback-transport.md)

## What to build

The end-to-end demoable capstone of PRD 199 (as 198 was for per-frame duration): wire
the transport strip into the editor per the [200 design spec](200-animation-playback-transport-design.md),
driving the playback controller (202) so the user can press Play and watch the
animation in the canvas.

- A transport-strip view in the reserved slot above the ruler, rendering **Play/Pause**
  and **Loop** controls per the 200 design, plus the **playhead** indication while
  playing (distinct from the active-frame highlight). Kept a **pure view** (props in,
  callbacks out — the 093 decision, exactly as `TimelinePanel` is): props for
  `isPlaying` / `isLooping` / playhead + frame state; `onTogglePlay` (or `onPlay` /
  `onPause`) and `onToggleLoop` callbacks.
- Wired in `+page.svelte` on **both** the docked and mobile instances to the playback
  controller (202) — mirroring how `onReorderFrame` → `tab.reorderFrame` is wired.
  Mobile (Timeline tab) touch targets ≥44px.
- New i18n keys for the play / pause / loop labels and aria-state in en / ko / ja.

## Acceptance criteria

- The strip matches the 200 design (placement in the reserved slot, control set,
  playhead treatment, states) in both Light and Dark.
- Pressing Play animates the canvas through the frames at their authored durations;
  Pause stops and returns to the active frame; Loop toggles repeat vs. play-once.
- The controls reflect `isPlaying` / `isLooping` state (e.g. `aria-pressed`) and are
  keyboard-operable; labels/aria are localized in en / ko / ja.
- Wired on both docked and mobile instances; mobile touch targets ≥44px.
- The strip is a pure view (no WASM / `TabState` awareness).
- Component tests: play/pause and loop controls fire their callbacks and reflect state.
- An E2E tracer passes (prior art `e2e/editor/frames.test.ts`): author two frames with
  distinct content, press Play and confirm the playhead advances (a stable data
  attribute, not a pixel-diff race), press Pause and confirm the canvas is back on the
  active frame, and confirm playback created **no** undo entry and left the active
  frame unchanged.

## Blocked by

- [200 — Animation playback transport strip design (.pen)](200-animation-playback-transport-design.md)
- [202 — Shell playback controller (transient playhead)](202-playback-controller.md)
