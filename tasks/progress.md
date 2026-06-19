# Progress

## Currently Working On

Frame management (add/delete/duplicate/reorder) — M4 entry ([PRD](../issues/186-frame-management.md)). Core [188](../issues/188-frame-cel-grid-core.md) + WASM/journal [189](../issues/189-frame-wasm-journal-intents.md) shipped (2/5 slices). Next runnable: [190 — Document schema V6](../issues/190-document-schema-v6-frames.md) (still parallel-safe); then [191 — ruler shell](../issues/191-frame-ruler-shell.md) (now waits only on 190) → [192 — operations UI](../issues/192-frame-operations-ui.md).

## Last Completed

[189 — Frame WASM binding + Change Journal intents](../issues/189-frame-wasm-journal-intents.md): exposed the frame model to the web shell via the WASM `Document` binding and routed 4 undoable + 1 persisted (`set-active-frame`) frame intents through the Change Journal. Undo/redo restores frame structure + per-cel pixels via the existing whole-`Document` snapshot. No persistence (190) or UI (191) yet.

## Next Up

- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
- Apple Phase 1 — Enable clear canvas (existing disabled button)
- Apple Phase 1 — Enable PNG export (existing disabled button)
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
- Project file format (JSON-based) + save/load
- Feature guide page (basic usage instructions)
- Apple Pencil: hover preview + palm rejection
- (review) In-editor feedback widget
- Feedback link to Google Form
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
