---
title: Apple native — Shift constrain + constrain latch for shape tools
status: done
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color. (Re-sequenced here from Phase 1 — there was nothing to
constrain before the shape tools existed.)

## What to build

Bring the web's **Shift-constrain** behavior to the Apple shape tools, plus the
touch-first **constrain latch** for devices without a Shift key:

- **Line + Shift**: the endpoint snaps to the nearest 45° multiple from the
  anchor (8-directional).
- **Rectangle/Ellipse + Shift**: the bounding box is forced square (circle).
- **Constrain latch**: a sticky toolbar toggle that supplies the same held state
  without a keyboard — the primary affordance on iPad, a clickable convenience on
  Mac. Shown/enabled in LeftToolbar when the active tool is constrainable; the
  active constrainable tool button carries a small badge while the latch is on
  (web LeftToolbar is the reference). Session-transient: resets to off on
  relaunch, mirroring how a held key is never remembered.

The two sources are **OR-combined at the single seam** the shape sessions read
("is constrain held?") — from a tool's perspective, the latch is
indistinguishable from physical Shift. Mid-stroke changes (pressing/releasing
Shift, tapping the latch) re-render the in-flight preview immediately via the
session's modifier-refresh hook from 230.

The constraint math mirrors the web's shell-side functions (`constrainLine`,
`constrainSquare`): snap the current point before computing the preview. The web
deliberately keeps this in shell code, not the shared core — simple, stable
math; implement the Swift equivalents (unit-tested against the web's cases).

Platform scope for the physical key: macOS Shift (modifier flags) and iPad
hardware-keyboard Shift if the event path surfaces it; the latch covers all
other input.

## Acceptance criteria

- Holding Shift (macOS) while dragging a line snaps it to 0°/45°/90°/…; while
  dragging a rectangle/ellipse forces a square/circle; releasing Shift mid-drag
  relaxes the preview immediately, re-pressing re-constrains.
- The latch button toggles on/off, only applies when a constrainable tool is
  active, and produces identical constrained results to holding Shift, including
  turning it on/off mid-drag.
- The latch state is visible (button state + badge on the active tool button)
  and resets on app relaunch.
- Pencil/eraser/fill/eyedropper/move ignore the constrain state.
- Constraint math unit-tested (45° snapping quadrants, square normalization with
  negative drags); toolbar snapshot baselines updated for the latch.

## Blocked by

- [231 — shape tools](231-apple-shape-tools.md)

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Tools/ToolConstraints.swift` | Swift equivalents of the web's `constrainLine` (45° snap incl. the 2:1 half-angle boundaries) and `constrainSquare` (negative-drag normalization, zero delta counts positive) — pure shell-side integer math, mirroring the web's placement decision |
| `apple/Dotorixel/Tools/StrokeSession.swift` | `modifierChanged() -> Bool` added to the session protocol (protocol-extension default: no-op) + `StrokeSessionHost.isConstrainHeld` — the single OR-combined seam sessions live-read |
| `apple/Dotorixel/Tools/StrokeEngine.swift` | `modifierChanged()` forwarding to the active session |
| `apple/Dotorixel/Tools/ShapeStrokeSession.swift` | Per-tool constrain function injected next to the geometry closure; constrain state live-read on every sample; `repaintPreview()` shared by `draw` and `modifierChanged` |
| `apple/Dotorixel/Tools/EditorTool.swift` | `isConstrainable` (line/rect/ellipse); session factory wires line→`constrainLine`, rect/ellipse→`constrainSquare` |
| `apple/Dotorixel/State/EditorState.swift` | `isShiftKeyHeld` + `isConstrainLatchOn` (didSet → engine modifier refresh while drawing), `isConstrainHeld` OR seam, `activateTool` re-tap gesture |
| `apple/Dotorixel/Views/LeftToolbar.swift` | Tool buttons route through `activateTool`; active constrainable tool carries the badge while the latch is on |
| `apple/Dotorixel/Style/ToolButtonStyle.swift` | `showsConstrainBadge` — 8pt accent dot, top-right of the visual box (web `.constrain-badge`) |
| `apple/Dotorixel/Rendering/InputMTKView.swift` | macOS: `flagsChanged` + mouse-down re-sync; iPadOS: `pressesBegan/Ended/Cancelled` for hardware Shift (view becomes first responder) + touch-event modifier-flag fallback |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | `shiftStateChanged` delegate forwarding into `EditorState.isShiftKeyHeld` |
| `apple/DotorixelTests/ToolConstraintsTests.swift` | 45° quadrants + 2:1 boundaries, square normalization with negative drags, zero-delta web parity |
| `apple/DotorixelTests/ConstrainStrokeTests.swift` | Via the `EditorState` public stroke API: latch-snapped line commit, Shift-forced square, mid-stroke latch and Shift toggles re-render the stationary preview both ways, pencil ignores constrain; `ToolActivationTests` — re-tap toggles / inactive selects / non-constrainable never toggles |
| `apple/DotorixelTests/EditorToolTests.swift` | `isConstrainable` classification keyed by case (new tool fails until classified) |
| `apple/DotorixelTests/DockedRegionSnapshotTests.swift` + `__Snapshots__/…/leftToolbarConstrainBadge.1.png` | Badge content-regression baseline, recorded on the pinned host and visually reviewed |
| `apple/DotorixelTests/StrokeEngineTests.swift` | Fake host gained `isConstrainHeld` conformance |

### Key Decisions

- Latch UI mirrors the web exactly (user-approved): **no separate latch button** — re-tapping
  the active constrainable tool toggles the latch (`activateTool`, web `tool-ui.ts` parity),
  and the badge on the active tool button is the visible state.
- The issue text referenced "the session's modifier-refresh hook from 230", but no such hook
  existed — `modifierChanged` was added here, as a protocol-extension default no-op so
  freehand/one-shot/deferred sessions are untouched.
- Shift and latch are OR-combined in `EditorState` behind `StrokeSessionHost.isConstrainHeld`;
  sessions structurally cannot distinguish the sources.
- iPad hardware Shift is best-effort per the issue's platform scope: `presses*` (requires
  first responder, taken on `didMoveToWindow`) plus modifier-flag re-sync from touch events.

### Notes

- The latch is in-memory only (resets on relaunch by design); it joins the Phase 4
  persistence scope alongside 239's pixel-perfect toggle only if the web ever persists it
  (it doesn't today).
- iPad first-responder recovery after another view takes it is not handled — 241
  (keyboard shortcuts) is the natural place to consolidate key handling.
- `paintedPixelCount` is now duplicated across 4 test suites (pre-existing per-suite
  convention); extract-to-test-support is a candidate for a test refactor slice (cf. 248).
- macOS `flagsChanged` calls `super` (unlike the mouse handlers, which suppress the AppKit
  context menu) — modifier changes have no default behavior to block.
- Verified: full iOS suite (173 tests) green on the pinned simulator, macOS build green.
  The live NSEvent wiring is untested by unit tests — worth a quick manual Shift-drag check
  on macOS when convenient.
