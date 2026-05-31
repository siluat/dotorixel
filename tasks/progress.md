# Progress

## Currently Working On

Selection tool — Marquee with move/copy/paste and per-tool clipping ([PRD](../issues/131-selection-tool-rectangle-select-move-nudge-copy-paste.md)).
5 of 21 sub-issues are done; 136 added Marquee pixel-region operations and Delete/Backspace clearing, unlocking downstream move/copy/cut/paste slices.

## Last Completed

[136 — Region pixel transformations + Delete](../issues/136-region-pixel-transformations-and-delete.md): Delete/Backspace now clears selected Pixel Layer pixels without moving or removing the Marquee. Reference-active documents stay no-op, and Undo restores the cleared pixels.

## Next Up

- [137 — Marquee clipping mask decorator](../issues/137-marquee-clipping-mask-decorator.md)
- [138 — Reference Layer × Marquee no-op](../issues/138-reference-layer-marquee-no-op.md)
- [139 — Touch long-press suppression inside Marquee](../issues/139-touch-long-press-suppression.md)
- [140 — StatusBar Marquee readout](../issues/140-statusbar-marquee-readout.md)
- [141 — Drag-time visual aids](../issues/141-drag-time-visual-aids.md)
- [142 — Drag-to-move (LiftAndDrag + commit + Undo)](../issues/142-selection-drag-to-move.md)
- [143 — Selection Clipboard + Copy + persistence](../issues/143-selection-clipboard-and-copy.md)
- Touch modifier alternatives (unblocks Selection sub-issues 151 + 152)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- Apple Pencil: hover preview + palm rejection
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- Feature guide page (basic usage instructions)
- (review) In-editor feedback widget
