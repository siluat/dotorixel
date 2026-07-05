# Progress

## Currently Working On

Onion skinning — adjacent-frame ghosts while editing ([PRD](../issues/217-onion-skinning.md)): 1/3 sub-issues done — 218 (design spec) shipped. Remaining: **[219 state](../issues/219-onion-skin-state.md) (AFK, unblocked)** → [220 rendering + toggle](../issues/220-onion-skin-render-ui.md) (needs 219).

## Last Completed

[218 — Onion skin transport toggle + ghost treatment — design (.pen)](../issues/218-onion-skin-design.md): the 217 spec — a lucide-ghost toggle third in the transport strip's left cluster (on-state mirrors Loop), ghosts at ~60% tint blend + ~40% alpha via the newly approved `$--onion-prev` / `$--onion-next` red/blue pair (single values — the canvas backdrop is theme-independent). 220 mirrors the pair into the web `--ds-*` tokens.

## Next Up

- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
- Feedback link to Google Form
- (review) In-editor feedback widget
- Reference image window polish — opacity slider, lock toggle, flip H/V, rotate
- Reference image import — clipboard paste support
- Design: share artwork dialog — URL sharing dialog UI (.pen)
- FG/BG swap UI improvements
- Dark mode toggle UI
- Document error conditions on `PixelCanvas` public API
- IndexedDB quota exceeded error handling
- Document rename
- Canvas resize via border drag
- Timelapse recording
- TimelinePanel mobile touch targets — frame + row icon buttons ≥44px on the mobile Timeline tab
