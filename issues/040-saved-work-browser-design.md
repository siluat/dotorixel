---
title: Saved work browser — UI design
type: design
status: done
created: 2026-04-09
---

## Design Scope

Design the saved work browser UI in `docs/pencil-dotorixel.pen`. Four frames covering two viewports and two states:

1. Desktop modal — with saved items
2. Desktop modal — empty state
3. Mobile bottom sheet — with saved items
4. Mobile bottom sheet — empty state

Also indicate the trigger button placement in TopBar (desktop) and AppBar (mobile).

## References

- Export UI pattern: `ExportPopover` (desktop modal) + `ExportBottomSheet` (mobile drawer) — same responsive strategy
- Session storage schema: `src/lib/session/session-storage-types.ts` — document fields (id, name, width, height, pixels, createdAt, updatedAt)
- Existing designs: `docs/pencil-dotorixel.pen` — editor layouts, Export UI frames

## Design Plan

| Decision | Choice |
|---|---|
| Entry point | Inside editor (TopBar/AppBar button) |
| UI pattern | Responsive — desktop: modal, mobile: bottom sheet |
| Item info | Thumbnail + name, canvas size, last modified date |
| Layout | Grid (cards) |
| Open action | Deferred to implementation (design shows selection interaction only) |
| Item management | Delete with confirmation dialog |
| Trigger location | Icon button in TopBar/AppBar |
| Empty state | Message + auto-save guidance |
| Frames | 4 frames (desktop/mobile x items/empty) |

## Constraints

- Follow Pebble UI theme (warm earth tones, rounded panels, acorn brown accent)
- Light mode as default (per design preference)
- Thumbnail rendered from pixel data — small preview at card size
- Reuse existing design tokens from the Design System Reference frame
- Delete confirmation must be explicit (not swipe-to-delete alone)

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | Saved Work Browser frame — 6 sections in one documentation frame |

### Key Decisions
- Cards show trash icon in info area (always visible) for discoverability in a learning-first tool
- Mobile AppBar works button matches export button style (icon-only, no border)
- Frame placed in UX Exploration area alongside Canvas Resize UX, Tooltip Design, and Export UI

### Notes
- "Open" action (tab-add vs session-replace) deferred to implementation PRD
- Canvas frames reorganized by category: Design System → Editor → UX Exploration → Animation → [Ref]

