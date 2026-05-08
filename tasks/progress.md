# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 15 sub-issues (087–101); 087 + 088 + 089 + 090 + 101 done, 10 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. With **101** (Document builder + tool bindings + TS facade) landed, the FFI plumbing is complete: Rust `Document::from_layers` + `apply_tool`/`flood_fill`/`clear` + `layer_pixels_at`, WASM `WasmDocumentBuilder` + matching extensions, TS read-only `Document` structural interface + `documentFromSchemaV3` + `HistoryManager` document path. **091** (TabState switch) is now pure shell-side wiring with a 10-slice strangler TDD strategy (shadow `document` field, advance one consumer at a time). **092** (TimelinePanel design, HITL) remains independently startable. 091 + 092 run in parallel; 093 (TimelinePanel shell) needs 091 + 092.

## Last Completed

[101 — Layer system: Document builder + tool bindings + TS facade](../issues/101-layer-system-document-builder-and-tool-bindings.md): closed the three FFI gaps surfaced during 091 grilling. **Rust core**: `DocumentBuildError` enum (`Display + Error`) with 4 variants (`EmptyLayers` / `DuplicateLayerId` / `LayerDimensionsMismatch` / `UnknownActiveLayer`); `Document::from_layers(width, height, layers, active_layer_id, next_layer_number, timeline_panel_collapsed)` validates non-empty stack → unique ids → per-layer dimension match → active id presence; `Document::apply_tool` / `flood_fill` / `clear` delegate to the active layer; `Document::layer_pixels_at(index) -> Option<&[u8]>` reads the layer's RGBA buffer for the save path. **WASM**: `WasmDocumentBuilder` (`new` / `add_layer` / `build`) sidesteps `wasm-bindgen`'s `Vec<MyType>` limitation via accumulator pattern; `WasmDocument` extensions (`apply_tool` / `flood_fill` with negative-coord short-circuit / `clear` / `layer_pixels_at`). **TS facade**: read-only `Document` structural interface in `canvas-model.ts` (snake_case methods mirroring `WasmDocument`); `documentFromSchemaV3(schema)` hydration helper backed by `WasmDocumentBuilder`; `HistoryManager` interface gains `push_document` / `undo_document` / `redo_document`. New compile-time check `expectTypeOf<WasmDocument>().toMatchTypeOf<Document>()` in `wasm-sync.test.ts` makes interface drift fail compilation — equivalent to a hand-written fake without the maintenance cost. Document hydration round-trip + history document path tests under `document-hydration.test.ts`. Decisions: TS facade is read-only by design (mutators stay on `WasmDocument`, reached via extended `DrawingOps` in 091, mirroring the `PixelCanvas` ↔ `DrawingOps` pattern); compile-time structural compat satisfies the "hand-written fake" AC. `cargo test --workspace` 287/287 pass (8 new core, 4 new wasm); `bun run check` 0 errors / 0 warnings. Slice remains dead code in `main` until 091 wires it into `TabState`. Five caller-reference doc comments tightened per CLAUDE.md style rule during the post-implementation audit.

## Next Up

- [091 — TabState switch: `pixelCanvas` → `document`](../issues/091-layer-system-tab-state-document-switch.md)
  - Now unblocked by 101. Pure shell-side wiring with the 10-slice strangler TDD strategy (shadow `document` field, one consumer at a time).
- [092 — TimelinePanel design (Candidate A detail pass)](../issues/092-layer-system-timeline-panel-design.md)
  - Independent (no blockers); HITL `.pen` design task. Runs in parallel with 091.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
