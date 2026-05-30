---
title: "Cut (Cmd+X) — Copy followed by Delete"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Cmd/Ctrl+X cuts the Marquee region: capture pixels to the Selection Clipboard, then clear them from the active Pixel Layer. Single undo step restores both the cleared pixels and the previous clipboard contents (clipboard state is part of the Workspace persistence model but the cut operation is one journal entry — clearing pixels).

Scope:

- **Keyboard input** (`keyboard-input.svelte.ts`): `cutSelection()` host callback on Cmd/Ctrl+X.
- **`cutSelection` implementation**: from Idle, calls `copySelection()` (from 143) followed by `clear-marquee-pixels` (from 136). With a Floating Selection active, commit Floating first (matches the tool-switch pattern), then cut from the new Marquee position.
- With no Marquee: silent no-op.
- Reference-Layer-active: silent no-op.

Implementation notes:

- The Clipboard update from `copySelection` is workspace-state, not document-history. The `clear-marquee-pixels` journal intent is what becomes the undo step.
- Undo after Cut restores the pixels (the Clipboard state is not reverted by Undo — clipboard mutations are explicit user actions, not document history).
- Cut from Floating: commit-then-cut. The Floating commits as its own journal entry first, then a separate `clear-marquee-pixels` for the cut. Two undo steps — first restores the cut pixels, second restores the pre-commit Floating.

Tests:

- Cmd+X with active Marquee copies pixels to Clipboard AND clears them from the layer.
- Undo after Cut restores the pixels.
- Cmd+X with Floating Selection active commits Floating first, then cuts from the new Marquee position.
- Cmd+X with no Marquee is silent no-op.
- Cmd+X with empty Marquee region (zero pixels in the selection range) still functions — empty clipboard, no-op layer mutation.

## Acceptance criteria

- Cmd/Ctrl+X copies Marquee pixels to the Selection Clipboard AND clears the same pixels from the active Pixel Layer.
- Undo after Cut restores the cleared pixels.
- Cmd+X with Floating Selection active commits Floating first, then cuts.
- Cmd+X with no Marquee is silent no-op.
- Cmd+X on Reference-Layer-active is silent no-op.

## Blocked by

- [143 — Selection Clipboard + Copy (Cmd+C) + workspace persistence](143-selection-clipboard-and-copy.md)
