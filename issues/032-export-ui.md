---
title: Export UI — format selector and filename input
type: design
status: done
created: 2026-04-08
---

## Design Scope

Design the Export UI for the web editor in `docs/pencil-dotorixel.pen`. Frames to create or update:

- **Desktop**: Popover below the Export button in TopBar (Editor — Desktop Light, Editor — Desktop Dark)
- **iPad**: Popover in TopBar (Editor — iPad Landscape)
- **Mobile**: Bottom Sheet (Editor — Mobile Draw, Editor — Mobile Settings)

## References

- Current Export button in TopBar: accent-colored button with download icon + "Export" label
- Mobile AppBar and Settings tab both have export buttons
- PRD context: [issues/032-export-ui.md (original PRD)](https://github.com/user/dotorixel/issues/032)

## Design Plan

### Interaction pattern

- **Desktop/iPad**: Popover (~300px wide) anchored below the Export button
- **Mobile**: Bottom Sheet (full width, top corners rounded)

### Popover/Sheet layout (top to bottom)

1. **Header**: Desktop — none. Mobile — "Export" title
2. **Format selector**: Dropdown/Select. Only shows available formats (PNG for now; SVG, GIF etc. added as implemented)
3. **Filename input**: Text input with placeholder showing default name (e.g., `dotorixel-16x16`). No separate extension label — format is already visible in the dropdown and export button
4. **Export button**: Full-width, accent color, label includes format name (e.g., "Export PNG")

### Button states

- Popover open → Export button shows active/pressed state (darker accent #8A5D20, not $--accent-hover which resolves to black)
- Export button toggles popover open/closed

### Close behavior

Desktop Popover:
- Click outside → close
- Re-click Export button → toggle close
- Click Export (confirm) → download + close
- ESC key → close

Mobile Bottom Sheet:
- Tap overlay → close
- Tap Export (confirm) → download + close
- Swipe down → close

### Mobile entry points

- AppBar export button → opens Bottom Sheet
- Settings tab export button → opens same Bottom Sheet

## Constraints

- Web shell only (Apple native export UI handled separately)
- Only display formats that have a working encoder; do not show disabled/coming-soon items
- Follow existing design tokens and component patterns in the .pen file

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | Export UI frame: desktop popover, mobile bottom sheet, desktop/mobile in-context views |

### Key Decisions
- Format selector uses Dropdown/Select (not segmented control) for scalability as formats grow
- No extension label on filename input — format visible in dropdown and export button
- Export button active state uses #8A5D20 (darker accent), not $--accent-hover (resolves to black)
- Desktop: Popover. Mobile: Bottom Sheet with "Export" title and drag handle

### Notes
- Original PRD content (032) was replaced by this design issue. Code implementation needs a new PRD when picked up.
- .pen file `layout: "none"` does not support overlapping child rendering; in-context views use vertical stacking instead of true overlay

