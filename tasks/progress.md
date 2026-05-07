# Progress

## Currently Working On

Layer system — basic infrastructure (add/delete/reorder) ([PRD](../issues/086-layer-system-basic-infrastructure.md)). PRD decomposed into 14 sub-issues (087–100); 087 + 088 + 089 done, 11 remaining (see `todo.md`). ADR `docs/decisions/web-document-layer-apple-preserved.en.md` records the web-only / Apple-preserved split. Newly unblocked: **090** (TS V3 schema + V2→V3 migration — first TS-side consumer of the WASM Document facade, still dead-code in `main`). **092** (TimelinePanel design, HITL) remains independently startable. The two run in parallel.

## Last Completed

[089 — Layer system: WASM Document facade](../issues/089-layer-system-wasm-document-facade.md): added a `WasmDocument` facade in `wasm/src/lib.rs` wrapping `dotorixel_core::document::Document`, plus three Document-snapshot methods on `WasmHistoryManager` (`push_document`, `undo_document`, `redo_document`). Surface: `new(width, height, first_layer_id, first_layer_name)`, getters (`width`, `height`, `active_layer_id`, `next_layer_number`, `layer_count`, `is_timeline_panel_collapsed`), index-based layer access (`layer_id_at`/`_name_at`/`_visible_at`/`_opacity_at`, all `Option<T>`), mutators (`add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`, `resize`, `set_pixel`), and `composite() -> Vec<u8>` (RGBA row-major, `width * height * 4` bytes, `ImageData`-compatible). Layer IDs accepted as UUID v4 strings (caller-supplied via `crypto.randomUUID()`), parsed at the boundary with `Uuid::parse_str` and surfaced as `JsError` on failure. Existing `WasmPixelCanvas` and canvas-path `WasmHistoryManager` methods unchanged — the two facades coexist while callers migrate. `wasm/Cargo.toml` extended with `rlib` in `crate-type` (enables native `cargo test` on the binding wrapper) and a top-level `uuid = "1"` dependency. 7 new inline native unit tests cover `new` round-trip, `add_layer` count/counter/active update, `remove_layer` happy path with active relocation, `composite` shape (all-zero on transparent doc), `set_pixel` → composite round-trip, and `push_document`/`undo_document`/`redo_document` history round-trips. JsError-returning paths (invalid UUID, oversize dims, RemoveLastLayer) are not testable from `cargo test` because `JsError::new` panics on non-wasm targets — they are mechanical `?`-propagation backed by `Display`-implementing core errors and verified end-to-end via wasm-pack output. Doc comments added on mutating methods so wasm-bindgen propagates the contract (`next_layer_number` increment, active relocation, index clamp, `RemoveLastLayer` rejection, anchor preservation) into the generated `.d.ts`. All 267 core tests + 7 new wasm tests pass; `cargo clippy -p dotorixel-wasm --all-targets -- -D warnings` clean; `bun run wasm:build` succeeds; `bun run check` reports 0 errors / 0 warnings — no impact on existing TS code. Slice remains dead-code in `main`: TS does not yet construct `WasmDocument`. Next: 090 (TS V3 schema + V2→V3 migration) is now unblocked — first TS consumer of the facade.

## Next Up

- [090 — TS V3 schema + V2→V3 migration (not yet wired)](../issues/090-layer-system-ts-v3-schema-migration.md)
  - Newly unblocked by 089. Adds `DocumentSchemaV3` and a V2→V3 migration on the TS side; not yet wired into `TabState`.
- [092 — TimelinePanel design (Candidate A detail pass)](../issues/092-layer-system-timeline-panel-design.md)
  - Independent (no blockers); HITL `.pen` design task. Runs in parallel with 090.
- Apple Phase 1 — Responsive tiers (iPad compact / iPad regular / Mac)
  - Independent. Now that the docked layout is in, this is the next Apple Phase 1 item.
- Apple Phase 1 — Enable clear canvas (existing disabled button)
  - Independent. Needs core wiring + button enable.
- Apple Phase 1 — Enable PNG export (existing disabled button)
  - Independent. Core export already done; wiring + UI enable only.
- Apple Phase 1 — Shift-constrain for shape tools (macOS keyboard modifier)
  - Independent, but blocked on shape tools not yet existing on Apple side; functionally on hold.
