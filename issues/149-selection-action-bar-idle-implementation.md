---
title: "Selection Action Bar — Idle state implementation"
status: done
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

The Selection Action Bar component covering the Idle state (Marquee active, no Floating Selection). Provides touch-accessible Copy / Cut / Paste / Delete / Deselect buttons. The component renders whenever a Marquee is active; the Floating state is handled in 150.

Scope:

- **`SelectionActionBar.svelte` (new)**: floating horizontal toolbar.
  - Buttons (Idle state): `Copy`, `Cut`, `Paste`, `Delete`, `Deselect`.
  - `Paste` is rendered in a disabled variant when `workspace.shared.selectionClipboard === null`.
  - Button clicks dispatch to the same host callbacks the keyboard shortcuts use (`copySelection`, `cutSelection`, `pasteClipboard`, `deleteMarqueePixels`, `clearMarqueeOrFloating`).
- **Positioning logic**: default 8 px above Marquee top edge in screen space. When that overflows the viewport top, fall back to below Marquee bottom. When both overflow (Marquee fills the viewport), sticky to the viewport edge closest to the Marquee.
- **Visibility**: rendered whenever a Marquee is active (no Floating Selection). Hidden mid-drag (any pointer drag interaction); fades back on release. `prefers-reduced-motion` skips the fade.
- **Responsive sizing**: compact (<600px) = icon-only buttons with 44 × 44 pt invisible padding. Medium+ = icon + label. Wide+ = tooltip on hover. Follows the design slice in 133.
- **i18n** (`messages/{en,ko,ja}.json`): `action_selectionCopy`, `action_selectionCut`, `action_selectionPaste`, `action_selectionDelete`, `action_selectionDeselect`.
- **Icons**: per 133's design decisions (Lucide-based).
- **Mounted**: alongside `SelectionOverlay` in `PixelCanvasView.svelte`.

Implementation notes:

- The component is purely a UI wrapper that triggers the keyboard host callbacks. No new domain logic.
- Positioning math reuses the same viewport-aware projection that `ReferenceLayerPlacementOverlay` uses.
- Reference-Layer-active: the action bar still renders (since the Marquee renders too per 138), but the operations all no-op via their respective handlers.

Tests:

- Action bar renders when a Marquee is active and no Floating Selection.
- Action bar hidden mid-drag, fades back on release (or appears immediately under `prefers-reduced-motion`).
- Copy button dispatches `copySelection`; same for Cut / Paste / Delete / Deselect.
- Paste button is disabled when clipboard is null; clicking it is a no-op.
- Positioning: above Marquee top when there's room; below when top overflows; sticky to edge when both overflow.
- Responsive: compact renders icon-only; medium+ renders icon + label.
- i18n: labels render in all three locales.

## Acceptance criteria

- `SelectionActionBar.svelte` mounted in `PixelCanvasView`.
- Bar appears when Marquee is active without a Floating Selection.
- Bar positioning follows the "above top → below bottom → viewport-edge sticky" rules.
- Five buttons (Copy/Cut/Paste/Delete/Deselect) dispatch to the same host callbacks the keyboard shortcuts use.
- Paste button disabled when clipboard is empty.
- Mid-drag hide + fade-back on release; `prefers-reduced-motion` honored.
- Responsive layouts at compact / medium+ / wide+.
- i18n keys exist for all five labels in all three locales.

## Blocked by

- [133 — Selection Action Bar — UX detail design (.pen)](133-selection-action-bar-design.md)
- [136 — Region pixel transformations + Delete keyboard](136-region-pixel-transformations-and-delete.md)
- [143 — Selection Clipboard + Copy](143-selection-clipboard-and-copy.md)
- [146 — Cut (Cmd+X)](146-cut-cmd-x.md)
- [148 — Paste (Cmd+V)](148-paste-cmd-v.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/SelectionActionBar.svelte` | Added the Idle Marquee action bar with Copy, Cut, Paste, Delete, and Deselect controls, responsive labels, tooltip behavior, drag-time hiding, reduced-motion handling, and viewport-aware positioning. |
| `src/lib/canvas/SelectionActionBar.svelte.test.ts` | Covered command dispatch, disabled Paste behavior, Floating Selection suppression, positioning fallbacks, horizontal clamping, responsive labels, localization, and CSS motion/touch-target invariants. |
| `src/lib/canvas/PixelCanvasView.svelte` | Mounted the action bar alongside the selection overlay and passed selection command callbacks, clipboard availability, viewport data, and drag visibility state. |
| `src/lib/canvas/PixelCanvasView.svelte.test.ts` | Added integration coverage for idle Marquee mounting, Floating Selection suppression, and hide/restore behavior during pointer drag. |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Exposed controller methods for the same selection operations already available through keyboard shortcuts. |
| `src/routes/editor/+page.svelte` | Wired the editor controller selection operations into desktop and mobile canvas views. |
| `messages/en.json`, `messages/ko.json`, `messages/ja.json` | Added localized action labels and the action bar ARIA label. |

### Key Decisions

- The action bar stays a UI wrapper over existing selection commands, so keyboard shortcuts and touch/mouse toolbar actions share behavior.
- Horizontal positioning clamps against the measured toolbar width, with a label-length fallback for initial render and tests.

### Notes

- Floating Selection controls remain in [150](150-selection-action-bar-floating-state.md).
