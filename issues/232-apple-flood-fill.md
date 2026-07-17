---
title: Apple native — flood fill tool
status: done
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

## Results

| File | Description |
|------|-------------|
| `apple/src/lib.rs` | `ApplePixelCanvas::flood_fill(i32, i32, Color)` — negative coordinates short-circuit to `false` (mirrors the wasm binding's contract), delegates to core |
| `apple/Dotorixel/Tools/OneShotStrokeSession.swift` | New session species: undo snapshot at start, fires its effect on the first sample only, ignores the rest of the drag; `end`/`cancel` are no-ops |
| `apple/Dotorixel/Tools/EditorTool.swift` | `.floodFill` case after `.ellipse` (web display order), displayName "Flood Fill", SF Symbol `drop.fill`; `coreToolType` property removed and inlined into `makeSession` |
| `apple/DotorixelTests/CanvasBindingsTests.swift` | New binding-level smoke suite for `ApplePixelCanvas` FFI methods |
| `apple/DotorixelTests/FloodFillSessionTests.swift` | 6 behavior tests through the `EditorState` public stroke API: region fill, one-shot, out-of-bounds, same-color no-op, undo/redo, secondary-button BG fill |
| `apple/DotorixelTests/EditorToolTests.swift` | displayName expectation for the new case |
| `apple/DotorixelTests/__Snapshots__/DockedRegionSnapshotTests/leftToolbar*.png` | Baselines re-recorded on the pinned host (iPad Pro 11-inch (M5) · iOS 26.4 · @2x) and reviewed |

### Key Decisions

- **`coreToolType` inlined into `makeSession`**: fill has no core `ToolType` (that enum covers pixel-stamping tools only). Removing the total property instead of making it Optional keeps "non-stamping tool with a core mapping" unrepresentable; `makeSession` is now the single shell→core tool mapping point.
- **SF Symbol `drop.fill`**: SF Symbols has no paint bucket (web uses lucide `PaintBucket`); the filled drop matches Procreate's ColorDrop fill metaphor familiar to iPad users.
- **displayName "Flood Fill"**: exact web parity with `en.json` `tool_floodfill`, consistent with the other five tools.
- **`fire` receives the host as a parameter** instead of capturing it, so `makeSession` closures can't strongly retain the host — the session's `unowned` reference stays its only host link (documented inline).

### Notes

- Right-click background fill arrived with **zero fill-specific code** via the 233 draw-color seam, as the RFC predicted; pinned by a regression test.
- The web `oneShotTool` sugar's `capturesHistory: false` opt-out was deliberately **not** ported — add it when 234 (eyedropper) needs it.
- Like the existing freehand/shape sessions, the undo snapshot is pushed at stroke start even when the tap turns out to be a no-op (out-of-bounds or same-color); undo then restores an identical state, which is harmless.
- `xcodegen` globs snapshot PNGs as test resources: deleting a baseline requires regenerating the project before the recording run (documented gotcha for future re-records).
