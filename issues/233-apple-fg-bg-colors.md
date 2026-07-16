---
title: Apple native — FG/BG color pair, swap, and right-click background drawing
status: done
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Introduce the **foreground/background color pair** to the Apple shell, matching
the web editor's color model:

- Editor state gains a background color alongside the existing foreground color.
  Align the defaults with the web: foreground black (`#000000`), background white
  (`#FFFFFF`).
- **RightPanel color section** shows the FG/BG preview — foreground swatch with
  the accent border, background swatch beside it, and a swap button that
  exchanges the two (web ColorsContent layout is the reference).
- **Right-click draws with the background color.** The draw color is resolved
  once at stroke begin — secondary button → background, otherwise foreground —
  and the whole stroke uses it. This applies uniformly to every drawing session
  on the 230 architecture (pencil, eraser is transparent regardless, shapes,
  fill) with per-tool code unaware of the distinction.

Platform scope for the secondary button: macOS right-click (and iPadOS
pointer devices that report a secondary button, if the input path already
surfaces it). Touch input always draws with the foreground color. The canvas
input path must carry the button identity from the platform event into the
stroke begin.

Palette swatches and the color picker continue to set the foreground color.
The X-key swap shortcut belongs to the keyboard shortcuts slice (241); the
eyedropper's right-click → background commit belongs to 234.

## Acceptance criteria

- Editor state holds FG and BG colors with web-matching defaults.
- RightPanel shows both swatches (FG visually primary, accent-bordered) and a
  swap button; tapping swap exchanges FG and BG and both swatches update.
- On macOS, right-click drag with pencil paints the background color; right-click
  with shape tools previews and commits in the background color; right-click fill
  fills with the background color (given 232; otherwise covered when it lands).
- The draw color is captured at stroke begin — swapping mid-stroke doesn't change
  an in-flight stroke.
- Left-click/touch behavior is unchanged (foreground).
- State and swap logic unit-tested; RightPanel snapshot baselines updated.

## Blocked by

- [230 — stroke session architecture](230-apple-stroke-sessions.md)

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/State/EditorState.swift` | `backgroundColor` state + `swapColors()`; web-matching defaults (FG `#000000`, BG `#FFFFFF`); `beginStroke(at:button:)` |
| `apple/Dotorixel/Tools/StrokeSession.swift` | `PointerButton` enum (`.primary`/`.secondary`); `StrokeSessionHost` gains `backgroundColor` |
| `apple/Dotorixel/Tools/StrokeEngine.swift` | Resolves the stroke's draw color once at `begin` (secondary → background) and injects it into session creation |
| `apple/Dotorixel/Tools/EditorTool.swift` | `makeSession(host:drawColor:)` threads the resolved color to every session species |
| `apple/Dotorixel/Tools/FreehandStrokeSession.swift` | Takes injected `drawColor` instead of reading `host.foregroundColor` |
| `apple/Dotorixel/Tools/ShapeStrokeSession.swift` | Same `drawColor` injection |
| `apple/Dotorixel/Rendering/InputMTKView.swift` | Button identity from platform events: macOS `rightMouseDown/Dragged/Up` overrides, iPadOS `UIEvent.buttonMask`; `CanvasInputDelegate.drawingBegan` carries `PointerButton` |
| `apple/Dotorixel/Rendering/PixelCanvasView.swift` | Coordinator forwards the button into `beginStroke` |
| `apple/Dotorixel/Views/RightPanel.swift` | FG/BG row mirroring web `.fgbg-row`: FG swatch (accent border), BG swatch, swap button (`arrow.left.arrow.right`) |
| `apple/DotorixelTests/EditorStateTests.swift` | Defaults, swap, secondary-button stroke, mid-stroke-swap capture, secondary eraser tests |
| `apple/DotorixelTests/StrokeEngineTests.swift` | Engine resolves draw color per button; fixture + injection updated to the 3-arg factory |
| `apple/DotorixelTests/ShapeStrokeSessionTests.swift` | Secondary shape stroke previews and commits in the background color |
| `apple/DotorixelTests/__Snapshots__/DockedRegionSnapshotTests/rightPanel*.png` | Baselines re-recorded (wide/x-wide) on the pinned host |

### Key Decisions

- Draw color is resolved once in `StrokeEngine.begin` — the same seam position as web `stroke-engine.ts` — and injected into sessions, so per-tool code never sees the FG/BG distinction (the issue's uniformity requirement). Fill (232) inherits right-click behavior for free when it lands on this seam.
- `PointerButton` enum instead of the web's raw button number: illegal states unrepresentable; platform events are interpreted only at the input boundary (`InputMTKView`).
- `button:` defaults to `.primary` on `beginStroke`/`begin` — touch and existing call sites stay unchanged, and the default is the documented meaning of "no button information".
- Swap button is static-styled like the other RightPanel controls; its 24px extent and 14px icon mirror the web's raw CSS values as named local constants (not tokens, same as the web).

### Notes

- macOS `rightMouseDown` intentionally skips `super`, which also suppresses AppKit's default context menu on the canvas.
- iPadOS pointer secondary button is read from `UIEvent.buttonMask` in `touchesBegan`; direct touch always draws with the foreground.
- Eyedropper right-click → background commit stays in 234; the X-key swap shortcut stays in 241 (both as scoped in this issue).
