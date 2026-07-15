---
title: Apple native — shape tools (line, rectangle, ellipse) with drag preview
status: done
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Ship the three shape tools on the Apple shell: **line**, **rectangle**, and
**ellipse**, with live drag preview, matching the web editor's behavior.

Dragging previews the shape from the stroke's anchor point to the current pointer
position; releasing commits it. The preview uses the snapshot-restore strategy the
web validated: capture the canvas pixels at stroke start, and on every drag sample
restore the snapshot then draw the shape anchor→current. The core's
snapshot-restore performance guard (canvas ≤ 512px) makes this safe.

The geometry already lives in the Rust core — `interpolate_pixels` (already
exposed), `rectangle_outline`, and `ellipse_outline` (not yet exposed). Expose the
two outline functions through the UniFFI crate following the existing
tuple→`ScreenCanvasCoords` conversion pattern. Do not reimplement the geometry in
Swift.

Each tool is a session on the stroke architecture from 230:

- `start` — snapshot pixels, capture the undo snapshot.
- First sample — degenerate single-pixel stamp (the core outline functions treat
  start == end as one pixel).
- Subsequent samples — restore snapshot, redraw anchor→current.
- `end` — the preview is already the final shape; nothing extra.
- `cancel` — restore the pre-stroke snapshot (no shape committed).

UI: add Line, Rectangle, Ellipse buttons to LeftToolbar after eraser (web display
order), with SF Symbol icons and the existing tool-button active state. The status
bar shows the new tools' display names via the shell tool identity. Core
`ToolType` already has the three variants for the per-pixel apply path.

Shift-constraining (45° / square / circle) is a separate slice (240) — do not
include it here.

## Acceptance criteria

- Selecting Line/Rectangle/Ellipse in the toolbar and dragging on the canvas shows
  a live preview that follows the pointer; releasing commits the shape.
- Rectangle and ellipse are outlines (not filled), drawn with the foreground
  color; drag direction doesn't matter (corners normalize).
- A single click (press + release without moving) stamps one pixel.
- One undo removes the entire committed shape; pixels under the preview are
  untouched after undo.
- An interrupted stroke (touch cancel) restores the canvas to its pre-stroke state
  and leaves history consistent.
- `rectangle_outline` / `ellipse_outline` are callable across the FFI boundary and
  covered by a binding-level smoke test.
- Status bar shows "Line" / "Rectangle" / "Ellipse" while the tool is active.
- Toolbar snapshot baselines updated; session behavior unit-tested (preview
  restore, commit, cancel).

## Blocked by

- [230 — stroke session architecture](230-apple-stroke-sessions.md)

## Results

| File | Description |
|------|-------------|
| `apple/src/lib.rs` | `apple_rectangle_outline` / `apple_ellipse_outline` exposed over UniFFI, following the existing `apple_interpolate_pixels` tuple→`ScreenCanvasCoords` conversion pattern |
| `apple/Dotorixel/Tools/ShapeStrokeSession.swift` | One snapshot-restore preview session shared by all three shape tools: pixel snapshot + undo capture at `start`, first sample stamps the degenerate single-pixel shape, later samples restore + redraw anchor→current, `end` commits as-is, `cancel` restores |
| `apple/Dotorixel/Tools/EditorTool.swift` | `.line` / `.rectangle` / `.ellipse` cases (displayName, core `ToolType` mapping, session factory with injected geometry); `symbolName` for toolbar icons; `CaseIterable` — case order is the toolbar display order |
| `apple/Dotorixel/Views/LeftToolbar.swift` | Tool buttons are data-driven (`ForEach(EditorTool.allCases)`); line/rectangle/ellipse follow eraser (web display order) |
| `apple/DotorixelTests/GeometryBindingsTests.swift` | Binding-level smoke tests for both outline functions (FFI marshalling, drag-direction normalization, outline-only) |
| `apple/DotorixelTests/ShapeStrokeSessionTests.swift` | Session behavior via the `EditorState` public stroke API: commit, preview restore on shrink, single-click stamp, one-undo removal, cancel restore + history consistency, line anchor→release semantics, ellipse-core parity, mid-stroke color capture, out-of-canvas cases |
| `apple/DotorixelTests/EditorToolTests.swift` | displayName cases for the three new tools |
| `apple/DotorixelTests/__Snapshots__/DockedRegionSnapshotTests/leftToolbar*.png` | Toolbar baselines re-recorded on the pinned host, visually reviewed |

### Key Decisions

- One `ShapeStrokeSession` class parameterized by an injected geometry closure
  (line = interpolate, rect/ellipse = outline) instead of three session classes —
  mirrors the web's `shapeTool` authoring sugar.
- Re-render signaling tracks `lastPreviewPainted`: restoring the snapshot needs a
  re-render exactly when the erased preview had painted in-bounds pixels. This
  fixed a ghost-preview bug (pointer dragged fully out of canvas left the stale
  preview on screen) while preserving 230's "no re-render on out-of-canvas begin".
- Cancel keeps the undo entry pushed at stroke start (web parity): after cancel,
  one undo restores an identical state rather than popping the entry.
- SF Symbols `line.diagonal` / `rectangle` / `circle` — closest equivalents of the
  web's lucide Slash / Square / Circle.

### Notes

- Shift-constraining (45° / square / circle) is intentionally excluded — issue
  240, unblocked by this slice.
- The status bar picked up the new display names with no change of its own (it
  reads `EditorTool.displayName`).
- Verified: full iOS suite (78 tests) green on the pinned simulator, macOS build
  green, `cargo clippy`/`fmt` clean, manual launch on the iPad simulator.
