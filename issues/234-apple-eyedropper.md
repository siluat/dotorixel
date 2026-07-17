---
title: Apple native — eyedropper tool (drag to sample, commit on release)
status: done
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

## Results

| File | Description |
|------|-------------|
| `apple/Dotorixel/Tools/EyedropperStrokeSession.swift` | New deferred-commit session: drag refines the target pixel, `end` commits through bounds/opacity guards, `cancel` discards |
| `apple/Dotorixel/Tools/StrokeSession.swift` | `ColorPickTarget` enum + `commitColorPick` host seam; `PointerButton` doc updated for the second resolution product |
| `apple/Dotorixel/Tools/EditorTool.swift` | `eyedropper` case (display order after fill, web parity); `makeSession` now also receives the raw `button` so sampling tools resolve their commit target at the stroke-begin resolution point |
| `apple/Dotorixel/Tools/StrokeEngine.swift` | Passes the pointer button through to `makeSession` |
| `apple/Dotorixel/State/EditorState.swift` | `commitColorPick` conformance — writes FG/BG, never touches History |
| `apple/DotorixelTests/EyedropperSessionTests.swift` | Six behavior tests through the public `EditorState` stroke API (commit on release, drag refine, BG on secondary, opacity/bounds guards, no undo entry, cancel discards) |
| `apple/DotorixelTests/EditorToolTests.swift` | displayName expectation table gains Eyedropper |
| `apple/DotorixelTests/StrokeEngineTests.swift` | `makeSession` closure arity + fake host conformance updated |
| `apple/DotorixelTests/__Snapshots__/DockedRegionSnapshotTests/leftToolbar*.png` | Re-recorded on the pinned host with the new toolbar button |

### Key Decisions

- The commit target (FG/BG) resolves from the pointer button inside
  `EditorTool.makeSession` — the same stroke-begin resolution point as 233's
  draw color, so sessions still never see the button itself.
- The session never calls `beginEdit`; core `History::end_edit` no-ops without
  a pending baseline, so "color picks are not undoable" required no History
  API change.
- Host write access is a narrow `commitColorPick(_:to:)` seam (the analog of
  the web's `colorPick` effect) rather than making the host's FG/BG
  properties settable.

### Notes

- Until the loupe (235) lands, the only visible feedback is the RightPanel
  swatch updating on release — as scoped in this issue.
- The web's `addRecentColor` companion effect is deferred to 237 (recent
  colors slice).
