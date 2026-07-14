---
title: Apple native — enable PNG export (existing disabled button)
status: ready-for-agent
created: 2026-07-14
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 1: Layout
finish, "quick wins" group.

## What to build

The Apple shell's TopBar already renders an Export button, but it is permanently
disabled with its action deferred to this task. Enable it: tapping Export encodes the
current canvas as a PNG and saves it through the platform-native save flow.

The PNG encoder already exists across the FFI boundary (`ApplePixelCanvas.encodePng()`
in the UniFFI bindings, returning encoded bytes); this slice is shell wiring only.
Use SwiftUI's `.fileExporter` for the save flow so one implementation serves both
macOS (save panel) and iPadOS (Files document picker), consistent with the RFC's
"SwiftUI-native controls" principle.

Match the web's export conventions for parity:

- 1× scale — one canvas pixel per image pixel (the web exports the raw canvas;
  scaled export is a later concern on both shells).
- Default filename `dotorixel-{width}x{height}.png`.

Encoding can fail (`encodePng()` throws); a failure or a cancelled save panel must
not crash or corrupt editor state.

## Acceptance criteria

- The Export button in TopBar is enabled (full opacity, tappable).
- Tapping Export presents the platform save flow and, on confirm, writes a valid PNG
  file: correct pixel dimensions, drawn pixels in their drawn colors, undrawn pixels
  transparent.
- The default filename follows `dotorixel-{width}x{height}.png`.
- Cancelling the save flow leaves the editor unaffected; an encode failure surfaces
  without crashing.
- Works on both macOS and iPadOS destinations.
- Unit tests cover the export-document path (encoded bytes are a decodable PNG with
  expected dimensions and pixel content).

## Blocked by

None - can start immediately.
