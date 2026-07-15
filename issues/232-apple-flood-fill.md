---
title: Apple native — flood fill tool
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Ship the **flood fill** tool on the Apple shell. Tapping the canvas fills the
4-connected region of same-colored pixels under the tap with the stroke's draw
color, matching the web editor.

The algorithm already lives in the Rust core (`PixelCanvas::flood_fill`) but is
not exposed through the UniFFI crate — expose it on the canvas wrapper object.
Do not reimplement the fill in Swift.

The tool is a **one-shot** session on the stroke architecture from 230: it fires
on the first sample and ignores the rest of the drag. The undo snapshot is
captured at stroke start, so one undo reverts the whole fill.

The fill uses the stroke's draw color — foreground today; once FG/BG lands (233)
a right-click fill draws with the background color with no further changes here.

UI: add a Fill button to LeftToolbar after ellipse (web display order), with an
SF Symbol icon and the existing tool-button active state. Status bar shows the
tool's display name.

## Acceptance criteria

- Tapping with Fill active fills the 4-connected same-color region under the tap
  with the foreground color; filling a region with its own color is a visual
  no-op that doesn't corrupt state.
- Dragging after the initial tap fills nothing further (one-shot).
- Out-of-bounds taps do nothing.
- One undo reverts the entire fill; redo re-applies it.
- `flood_fill` is callable across the FFI boundary and covered by a binding-level
  smoke test.
- Status bar shows the Fill display name while active; toolbar snapshot baselines
  updated; one-shot session behavior unit-tested.

## Blocked by

- [230 — stroke session architecture](230-apple-stroke-sessions.md)
