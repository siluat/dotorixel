---
title: Apple native — editor keyboard shortcuts
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Wire the web editor's keyboard shortcut set on the Apple shell, delivered the
native way (`.keyboardShortcut` / key-event handling / menu commands as fits),
for macOS and iPad hardware keyboards:

| Key | Action |
|-----|--------|
| P / E / L / U / O / F / I / V | Activate pencil / eraser / line / rectangle / ellipse / fill / eyedropper / move |
| X | Swap FG/BG colors |
| G | Toggle grid |
| ⌘Z | Undo |
| ⇧⌘Z (and ⌘Y, web parity) | Redo |
| Alt/Option (hold) | Temporarily switch to the eyedropper; releasing restores the prior tool |

(M/marquee is Phase 5; Space-pan and Shift are handled elsewhere — Shift in 240.)

Undo/redo should land as proper Edit-menu commands on macOS (the app currently
replaces the undo/redo command group with an empty one — replace it with real
commands bound to the history handlers, so menu items enable/disable with
`canUndo`/`canRedo`).

Guards (web parity):

- Shortcuts are ignored while a text field is focused (the canvas-size inputs
  must keep receiving plain letters).
- Tool switching is ignored while a stroke is in progress; undo/redo already
  no-op mid-stroke.
- Alt-hold restore: if the user starts a stroke while Alt is held and releases
  Alt mid-stroke, the prior tool is restored when the stroke ends, not
  mid-stroke. If Alt is tapped without drawing, release restores immediately.

Shortcut hints in tooltips (e.g. "Pencil (P)") may ride along where the toolbar
already has accessibility labels, but a dedicated hints overlay (web's `/` key)
is out of scope.

## Acceptance criteria

- Each tool key activates its tool (toolbar active state + status bar update);
  keys do nothing while typing in the canvas-size fields.
- X swaps FG/BG; G toggles the grid — both without modifiers only.
- ⌘Z / ⇧⌘Z / ⌘Y drive undo/redo, including via the macOS Edit menu, with menu
  items disabled when the corresponding stack is empty.
- Holding Alt/Option switches to the eyedropper and releasing restores the
  previous tool, including the deferred-restore-while-drawing case.
- Tool keys are inert mid-stroke.
- Works on macOS and iPad with a hardware keyboard; shortcut handling logic is
  unit-tested where it lives outside the SwiftUI modifier layer.

## Blocked by

- [231 — shape tools](231-apple-shape-tools.md)
- [232 — flood fill](232-apple-flood-fill.md)
- [233 — FG/BG color pair](233-apple-fg-bg-colors.md)
- [234 — eyedropper tool](234-apple-eyedropper.md)
- [236 — move tool](236-apple-move-tool.md)
