---
title: Apple native — move tool (drag to shift canvas pixels)
status: done
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

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Tools/MoveStrokeSession.swift` | New: `shiftedPixels` (row-by-row shift, edge clipping, transparent vacated areas — web `shiftPixels` parity) + `MoveStrokeSession` (snapshot at start, restore + re-shift relative to anchor per sample, restore on cancel) |
| `apple/Dotorixel/Tools/EditorTool.swift` | `.move` case after `.eyedropper` (web display order): display name, SF Symbol, session factory. LeftToolbar/StatusBar pick it up via `allCases`/`displayName` |
| `apple/DotorixelTests/MoveStrokeSessionTests.swift` | New: `PixelShiftTests` (diagonal shift, zero-delta identity, clipping at all 4 edges, full-canvas displacement) + `MoveStrokeSessionTests` via the `EditorState` public stroke API (drag+commit, anchor-relative reversal, destructive clipping, undo/redo, cancel with no history entry) |
| `apple/DotorixelTests/EditorToolTests.swift` | `.move` added to the exhaustive displayName table |
| `apple/DotorixelTests/__Snapshots__/DockedRegionSnapshotTests/leftToolbar{Wide,XWide}.1.png` | Re-recorded on the pinned host (Move button after eyedropper) |

### Key Decisions

- **Shift stays native (Swift)** per the issue's Core Placement call — simple, stable
  logic mirroring the web's TS implementation; the doc comment records "promote to
  the core if a third implementation is ever needed".
- **`end` is a no-op** — the last per-sample shift already produced the final
  state, so release has nothing to commit (same structure as `ShapeStrokeSession`).
  No-op strokes (zero final delta) leave History untouched via the existing Edit
  Baseline resolution (243).
- SF Symbol `arrow.up.and.down.and.arrow.left.and.right` as the equivalent of the
  web's lucide `Move` icon.

### Notes

- `paintedPixelCount` test helper is now duplicated in three suites
  (FloodFill/Shape/Move) — candidate for a shared test helper if a fourth copy
  appears.
- Tests: full Apple suite 132 tests green on the pinned host (iPad Pro 11-inch
  (M5), iOS 26.4 sim).
