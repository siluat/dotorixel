---
title: "Paste (Cmd+V) — Floating Selection at viewport ∩ canvas center"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Cmd/Ctrl+V pastes the Selection Clipboard contents onto the active Pixel Layer as a Floating Selection. Paste position centers on the intersection of viewport and canvas; if the intersection is empty (canvas fully off-screen), falls back to canvas center.

Scope:

- **Keyboard input** (`keyboard-input.svelte.ts`): `pasteClipboard()` host callback on Cmd/Ctrl+V.
- **Paste position computation**: compute the visible-document area (intersection of viewport rect and canvas rect in document coordinates). Center the clipboard buffer on that area. If the intersection is empty, center on canvas geometric center.
- **Selection stroke session / paste handler**:
  - If a Floating Selection is already active → commit it first (matches the tool-switch / Cmd+V pattern from 131 PRD).
  - Any pre-existing Marquee is discarded.
  - Create a new Floating Selection: `{ buffer: clipboard.pixels, sourceRegion: <virtual region at paste position>, offset: (0, 0) }`.
  - The Marquee becomes the rectangle at the paste position with `clipboard.{width, height}` dimensions.
- **Journal**: `paste-clipboard: { clipboard, destRegion }` intent does NOT snapshot at paste time. The snapshot fires when the resulting Floating Selection commits on release. The pre-paste Marquee is captured into the post-commit snapshot's "previous" state so Undo restores it.
- **Empty clipboard**: silent no-op.
- **Reference-Layer-active**: silent no-op.
- **Off-canvas paste**: buffer can extend past canvas; commit clips at canvas boundaries (matches 142).

Implementation notes:

- The Floating Selection from paste behaves exactly like the Floating from drag — same drag-to-reposition, same Escape-to-cancel, same commit-on-release (but paste doesn't have a "release" — the user explicitly commits via tool switch, click outside, action bar Done, or Cmd+V'ing again).
- "Cancel" of a pasted Floating reverts to the pre-paste state (no pixels mutated; pre-paste Marquee restored).

Tests:

- Cmd+V with clipboard content creates a Floating Selection centered on visible-document intersection.
- Cmd+V with canvas off-screen falls back to canvas center.
- Cmd+V with empty clipboard is silent no-op.
- Cmd+V with active Floating Selection commits first, then pastes.
- Cmd+V with pre-existing Marquee discards the old Marquee and creates the new Floating.
- Commit-after-paste captures one undo snapshot; Undo restores pre-paste pixels and pre-paste Marquee.
- Cmd+V on Reference-Layer-active is silent no-op.

## Acceptance criteria

- Cmd+V pastes the clipboard buffer as a Floating Selection centered on (viewport ∩ canvas).
- Empty intersection falls back to canvas center.
- Cmd+V with empty clipboard is silent no-op.
- Cmd+V with active Floating Selection commits first.
- Cmd+V with pre-existing Marquee discards it.
- Undo of a committed paste removes the pasted pixels and restores the pre-paste Marquee.
- Cmd+V on Reference-Layer-active is silent no-op.

## Blocked by

- [143 — Selection Clipboard + Copy (Cmd+C) + workspace persistence](143-selection-clipboard-and-copy.md)
- [142 — Selection drag-to-move](142-selection-drag-to-move.md)
