---
title: Apple native — editor keyboard shortcuts
status: done
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

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/KeyboardShortcutController.swift` | New: pure Swift port of the web `createKeyboardInput` — `KeyboardShortcutHost` protocol, single keydown decision table (`resolveKeyDown`), Alt-hold temporary eyedropper with `consumePendingToolRestore()`, key-repeat policy, `isMenuOwnedShortcut` |
| `apple/Dotorixel/State/EditorState.swift` | Host conformance; `setActiveTool` (no latch toggle) + `toggleGrid`; `isTextInputFocused` signal; deferred tool restore applied in `endStroke`/`cancelStroke` |
| `apple/Dotorixel/Tools/EditorTool.swift` | `shortcutKey` per tool (p/e/l/u/o/f/i/v, web `TOOL_SHORTCUTS` parity) |
| `apple/Dotorixel/DotorixelApp.swift` | `EditorState` lifted to App scope; empty `.undoRedo` command group replaced with real Undo (⌘Z) / Redo (⇧⌘Z) commands, enabled off `canUndo`/`canRedo` |
| `apple/Dotorixel/Views/ShortcutKeyMonitor.swift` | New: macOS local NSEvent monitors (keyDown + flagsChanged) — first-responder-independent capture; resets held-key state when the window resigns key |
| `apple/Dotorixel/ContentView.swift` | Takes injected `EditorState`; attaches the macOS monitor modifier |
| `apple/Dotorixel/Rendering/InputMTKView.swift` | iPad hardware-keyboard capture: character keys + Option via `presses*`, new `CanvasInputDelegate` methods, `ShortcutModifiers` UIKit mapping |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | Coordinator forwards key events to the controller; iPad reclaims first responder when the size fields release focus (240 follow-up) |
| `apple/Dotorixel/Views/RightPanel.swift` | Publishes size-field focus to `isTextInputFocused` |
| `apple/Dotorixel/Views/LeftToolbar.swift` | Tool tooltips/accessibility labels carry shortcut hints ("Pencil (P)") |
| `apple/Dotorixel/Views/TopBar.swift` | Grid button routed through the shared `toggleGrid()` command |
| `apple/DotorixelTests/KeyboardShortcutControllerTests.swift` | New: 25 tests — fake-host controller suites (tool keys, X/G, undo/redo combos, Alt-hold incl. deferred restore, repeat, menu-owned) + `EditorState` integration |
| `apple/DotorixelTests/EditorToolTests.swift` | Exhaustive `shortcutKey` map suite |

### Key Decisions

- **Pure controller + host protocol** (mirror of web `KeyboardInputHost`), unit-tested with a fake host — shortcut logic lives entirely outside the SwiftUI modifier layer per the AC.
- **Shortcut ownership split**: ⌘Z/⇧⌘Z belong to the Edit-menu commands on both platforms (menu enable/disable comes free); the controller owns everything else (letters, X/G, ⌘Y, Alt-hold). `isMenuOwnedShortcut` is the shared guard both wirings use to prevent double-fire.
- **`setActiveTool` vs `activateTool`**: keyboard path sets the tool directly and never toggles the Constrain latch (a toolbar re-tap does) — same vocabulary split as the web.
- **Key-repeat policy (web parity)**: held undo/redo keeps firing, tool keys re-activate harmlessly, G/X repeats are swallowed without dispatching.
- **macOS capture via local NSEvent monitors** rather than responder-chain key handling — shortcuts work regardless of first responder; the text-input guard is state-driven (`isTextInputFocused`), not responder-based.

### Notes

- The controller's ⌘Z/⇧⌘Z branch is unreachable through production wiring (the menu owns those combos) — kept deliberately so the decision table stays a full mirror of the web handler and as a backstop if the menu path changes.
- PR #333 review follow-ups: macOS runs a single `Window` scene (app-scoped state must not alias across ⌘N windows until Phase 4 multi-tab); the Edit-menu undo/redo disable while a size field is focused (web parity); iPad detects key auto-repeat via a held-key-code set (`UIPress` has no repeat flag) and keeps consumed shortcut presses out of the responder chain; entering text focus resets held-key state so a temporary Alt-eyedropper can't stick when the release lands elsewhere.
- 240's open note (iPad first-responder recovery after a text field takes it) is addressed by the `updateUIView` reclaim.
- Automated coverage is at the controller/`EditorState` level (202 tests green on the pinned iPad host; macOS target builds). Real-hardware pass (macOS keys, iPad hardware keyboard incl. checking the Edit menu doesn't double-fire ⌘Z) is recommended before relying on it.
- The `/` shortcut-hints overlay and Space-pan remain web-only (out of scope here; M/marquee is Phase 5).
