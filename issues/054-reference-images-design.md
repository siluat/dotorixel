---
title: Reference images — UI design spec
status: open
created: 2026-04-16
parent: 053-floating-reference-window.md
---

## What to build

Produce the Pencil (`.pen`) design spec for every surface the floating reference window feature introduces. This is a **HITL** slice: deliverable is design mockups + token usage + behavior notes, not code.

Surfaces to design (see parent PRD §Solution, §UI Entry Point, §Responsive):

- TopBar: new References icon button placed next to My Works (FolderOpen), using the existing `.icon-btn` pattern.
- References browser modal (desktop / wide + x-wide): gallery grid of cards, empty state with drag-drop target, per-card Hide/Delete controls.
- References BottomSheet (compact / medium): mirrors `SavedWorkBrowserSheet` layout.
- Gallery card: thumbnail, filename, dimensions, display toggle, delete button; active (displayed) state visually distinct.
- Floating reference window chrome: title bar (drag handle, minimize, close), body (image area), bottom-right resize handle, minimized state (title bar only).
- Confirmation dialog for delete (mirrors My Works' pattern).

Design tokens stay within the `--ds-*` namespace. Cross-reference `docs/design-system.md` and the existing Pebble-replacement docked layout patterns.

## Acceptance criteria

- `.pen` frames covering: TopBar (with new button), modal (desktop), BottomSheet (compact), empty state, populated gallery, card states (idle / displayed / hover / delete-confirming), floating window (normal / minimized / dragging / resizing), delete confirmation dialog.
- Every color, spacing, radius, shadow, and type size references an existing `--ds-*` token. New tokens only when reuse across components is confirmed.
- Touch targets ≥ 44×44 on compact/medium; floating window chrome usable with pointer and touch.
- Notes capture: z-order cue (active window), pointer-absorb (no pass-through indication), cascade offset (~24px), minimum window size (~80×80), minimize affordance (window-shade).
- Review with user; approved design unlocks downstream AFK slices.

## Blocked by

None — can start immediately.

## Scenarios addressed

Design deliverable only — no runtime scenarios. Provides the visual contract for all downstream slices.
