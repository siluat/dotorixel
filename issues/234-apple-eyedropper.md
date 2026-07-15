---
title: Apple native — eyedropper tool (drag to sample, commit on release)
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Ship the **eyedropper** tool on the Apple shell, matching the web's
drag-to-refine model: pressing starts a sampling session, dragging moves the
sampled target pixel, and **releasing commits** the sampled color. A left-button
(or touch) release commits to the foreground color; a secondary-button release
commits to the background color.

The commit target is fixed at stroke begin from the pressed button (same
resolution point as 233's draw color). Reading pixels uses the already-exposed
`get_pixel` FFI call.

Commit rules (web parity):

- Only a valid opaque sample commits. Releasing over an out-of-bounds position or
  a transparent pixel commits nothing and leaves the active color unchanged.
- The eyedropper never captures an undo snapshot — color changes are not
  undoable, on either platform.
- A canceled stroke (touch cancel) discards the pending sample without
  committing — this exercises the deferred-commit path of the 230 session
  contract.

UI: add an Eyedropper button to LeftToolbar after fill (web display order).
Status bar shows the tool's display name. The magnifying **loupe overlay is a
separate slice (235)** — until it lands, the visible feedback is the color
swatch updating on release.

## Acceptance criteria

- With Eyedropper active: press-drag-release over an opaque pixel sets the
  foreground color to that pixel's color; the RightPanel FG swatch reflects it
  immediately.
- On macOS, a right-button eyedropper stroke commits to the background color.
- Dragging refines the target: the committed color is the pixel under the pointer
  at release, not at press.
- Releasing over a transparent pixel or outside the canvas commits nothing.
- Committing does not push an undo snapshot (undo still reverts the previous
  pixel-mutating action, not the color pick).
- Touch-cancel during sampling commits nothing.
- Session behavior unit-tested (commit on end, discard on cancel, opacity/bounds
  guards); toolbar snapshot baselines updated.

## Blocked by

- [230 — stroke session architecture](230-apple-stroke-sessions.md)
- [233 — FG/BG color pair](233-apple-fg-bg-colors.md)
