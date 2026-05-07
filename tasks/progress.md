# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 14 sub-issues (087–100); 087 done, 13 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. Newly unblocked: **088** (Rust HistoryManager: Document snapshot support, AFK). **092** (TimelinePanel design — Candidate A detail pass, HITL) remains independently startable. The two run in parallel.

## Last Completed

[087 — Layer system: Rust core — Document/Layer + composite + add/delete/reorder](../issues/087-layer-system-rust-document-layer-core.md): added `crates/core/src/document.rs` and `crates/core/src/layer.rs` with the runtime layer-stack model. `Document` owns `width`/`height`, an ordered `Vec<Layer>`, an active-layer pointer (UUID), a monotonic `next_layer_number` counter, and a `timelinePanelCollapsed` flag. Mutators: `add_layer` (insert directly above active, becomes active), `remove_layer` (errors `RemoveLastLayer` on the only layer; relocates active to neighbor — below first, then above), `reorder_layer` (silently clamps out-of-range index; preserves active by id), `set_active_layer` (errors `LayerNotFound` for unknown id), `set_pixel` (routes to active layer), `resize` (same anchor applied to every layer). `composite()` returns a freshly-allocated row-major RGBA buffer with all visible layers blended bottom-to-top via straight (non-premultiplied) source-over; `opacity` multiplies into source alpha; `visible=false` layers are skipped. `LayerError` implements `Display + Error`. Core is name-agnostic (TS shell formats Paraglide-driven layer names from `next_layer_number`); UUID v4 generation stays out of Rust (prod = type only, dev = v4 feature for tests). 21 inline tests cover all acceptance criteria including active-layer preservation across reorder; 257 total core tests pass; clippy clean; workspace builds clean. Slice is dead-code from the user's perspective — main is unaffected. Independent audit verified `.claude/rules/rust-conventions.md` and `CLAUDE.md` compliance: doc comments added to all non-trivial public API for `canvas.rs` parity; `timeline_panel_collapsed()` renamed to `is_timeline_panel_collapsed()` per "Booleans read as questions". Next: 088 (Rust HistoryManager Document snapshot) is now unblocked.

## Next Up

- [088 — Rust HistoryManager: Document snapshot support](../issues/088-layer-system-rust-history-document-snapshot.md)
  - Newly unblocked by 087. Extend `Snapshot` to capture the full Document; undo/redo restores both structural and pixel changes. AFK.
- [092 — TimelinePanel design (Candidate A detail pass)](../issues/092-layer-system-timeline-panel-design.md)
  - Independent (no blockers); HITL `.pen` design task. Runs in parallel with 088.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
