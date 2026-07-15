---
title: Apple native — move tool (drag to shift canvas pixels)
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Ship the **move** tool on the Apple shell: dragging shifts the entire canvas's
pixels by the drag delta, matching the web editor.

Behavior (web parity):

- The first sample marks the **anchor**. Every subsequent sample restores the
  pre-stroke snapshot and re-shifts by (current − anchor), so the transform is
  always relative to the drag origin — never cumulative.
- Pixels shifted past the canvas edge are **clipped** (lost on commit); vacated
  areas become transparent.
- Release commits the shifted state; one undo restores the pre-move pixels.
- Cancel restores the pre-stroke snapshot.

The shift is a row-by-row buffer copy. The web implements it shell-side (TS), so
there is no core function to wire — implement the equivalent in Swift on the
canvas's pixel buffer, mirroring the web's shift semantics. Per the Core
Placement criteria this simple, stable logic may stay native; if a third
implementation is ever needed, promote it to the core then.

This is a custom session on the 230 architecture (snapshot at start, restore +
re-shift per sample, restore on cancel).

UI: add a Move button to LeftToolbar after eyedropper (web display order).
Status bar shows the tool's display name.

## Acceptance criteria

- With Move active, dragging visibly translates the whole drawing with the
  pointer; releasing commits it.
- Reversing a drag mid-stroke returns pixels to their original positions
  (relative-to-anchor, not cumulative drift).
- Pixels dragged off-canvas are clipped after commit; vacated areas are
  transparent.
- One undo restores the pre-move canvas; redo re-applies the move.
- Touch-cancel restores the pre-stroke pixels.
- The Swift shift function is unit-tested against the web's semantics (clipping
  at all four edges, zero delta, full-canvas displacement); toolbar snapshot
  baselines updated.

## Blocked by

- [230 — stroke session architecture](230-apple-stroke-sessions.md)
