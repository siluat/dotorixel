---
title: Apple native — FG/BG color pair, swap, and right-click background drawing
status: ready-for-agent
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
