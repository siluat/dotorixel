# 060 — Sync: move tool icon added to toolbar across Editor frames (.pen)

## Plan

Move tool was implemented in code (PR #91), but the .pen design file's Editor frames don't have the move icon yet. Add the move tool button (lucide `move` icon) to all Editor frame toolbars for design-code consistency.

### Target Frames (8)

**Desktop leftToolbar** (width:48, gap:4, btn 36x36, icon 18px, cornerRadius:6):
- Editor — Desktop Light (`FfI2d`) — after eyedropBtn `QtSJf`
- Editor — Desktop Dark (`GS9ax`) — after eyedropBtn `1hcjH`
- Editor — Desktop Anim Light (`qEfNA`) — after eyedropBtn `p7ZuE`
- Editor — Desktop Anim Dark (`fks8p`) — after eyedropBtn `yuWXJ`

**iPad leftToolbar** (width:44, gap:2, btn 36x36, icon 18px, cornerRadius:6):
- Editor — iPad Landscape (`3Fwo4`) — after eyedropBtn `NOloG`
- Editor — iPad Anim (`ZN0d4`) — after eyedropBtn `yBSvL`

**Medium Tablet toolStrip** (horizontal, btn 44x44, icon 20px, cornerRadius:8):
- Editor — Medium Tablet (`J4iMv`) — after ts7 (pipette) `XKkqu`

**Mobile Draw toolStrip** (horizontal, btn 40x40, icon 18px, cornerRadius:8):
- Editor — Mobile Draw (`ogXPa`) — after ts7 (pipette) `UeGPT`

### Icon spec
- Icon font family: `lucide`, icon name: `move`
- Style: inactive state (`$--text-secondary`), matching other inactive tools

### Excluded Frames
- Tablet Timeline Tab, Mobile Timeline Tab: no tool toolbar
- Mobile Colors, Mobile Settings: no tool toolbar

## Results

| File | Description |
|------|-------------|
| `docs/pencil-dotorixel.pen` | Added move tool button (lucide `move` icon) to 8 Editor frame toolbars |

### Notes
- Insert appends to end of parent; used Move operations (index-based) to reposition after eyedropper/pipette
- All buttons use `$--text-secondary` fill for inactive state, consistent with other tool buttons
