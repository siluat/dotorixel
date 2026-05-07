# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 14 sub-issues (087–100); 087 + 088 done, 12 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. Newly unblocked: **089** (WASM Document facade — first slice that begins exposing the Rust document path to the web shell). **092** (TimelinePanel design, HITL) remains independently startable. The two run in parallel.

## Last Completed

[088 — Layer system: Rust HistoryManager — Document snapshot support](../issues/088-layer-system-rust-history-document-snapshot.md): extended `crates/core/src/history.rs` with a layer-aware undo/redo path. Internal `HistoryEntry` enum (`Canvas(Snapshot)` / `Document(Document)`) now backs the undo/redo stacks, with new public methods `push_document(&Document)`, `undo_document(&Document) -> Option<Document>`, `redo_document(&Document) -> Option<Document>`. The existing canvas-path API (`push_snapshot` / `undo` / `redo` returning the public `Snapshot` struct) is preserved unchanged on the surface — calls now wrap into `HistoryEntry::Canvas` internally — so WASM and Apple bindings continue compiling without modification. Variant guards (`expect_canvas` / `expect_document`) panic with actionable "do not mix paths" messages; one `HistoryManager` is meant to be driven through a single path during the transition. `DEFAULT_MAX_SNAPSHOTS=100` retained via a shared `push_entry` helper and verified for the document path by a dedicated eviction test. 9 new inline tests (T1–T9) exercise document round-trip across `set_pixel` / `add_layer` / `remove_layer` / `reorder_layer`, redo re-application, push-clears-redo, and `next_layer_number` preservation. All 24 pre-existing canvas-path tests still pass; 33 history tests / 267 core tests total. `history.rs` is clippy-clean; workspace builds clean. Slice remains dead-code — neither the new methods nor the new internal enum are reachable from main yet. Visibility/opacity round-trip test deferred to 097 (visibility toggle) where a public mutator will exist; `#[derive(Clone)]` already guarantees the round-trip mechanically. Next: 089 (WASM Document facade) is now unblocked — this is the first slice that exposes the document path beyond the Rust core.

## Next Up

- [089 — WASM Document facade](../issues/089-layer-system-wasm-document-facade.md)
  - Newly unblocked by 088. Wraps `Document` and the new history methods through wasm-bindgen so the web shell can call them.
- [092 — TimelinePanel design (Candidate A detail pass)](../issues/092-layer-system-timeline-panel-design.md)
  - Independent (no blockers); HITL `.pen` design task. Runs in parallel with 089.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
