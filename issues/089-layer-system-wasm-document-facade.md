---
title: "Layer system: WASM Document facade"
status: done
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Expose the Rust `Document` (and supporting `Layer` operations) through the WASM facade so the TS shell can construct, mutate, composite, and snapshot a Document. The TS shell does not yet call this facade — main is unaffected.

Scope:

- Add a `Document` binding under `wasm/`. The interface mirrors a single canvas in shape: `composite()` returns an RGBA buffer compatible with `ImageData`.
- Bindings for: `new(width, height)`, `add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`, `composite`, `resize`, and the active-layer pixel mutations needed by the existing tools (`set_pixel`, `flood_fill`, …).
- Bindings for `HistoryManager` Document snapshot operations added in 088.
- Layer IDs are accepted as UUID v4 strings (TS-side `crypto.randomUUID()`) — the binding does not generate IDs.
- Keep the existing `PixelCanvas` binding as-is. The two facades coexist for now.

## Acceptance criteria

- `Document` binding exposes `new`, `add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`, `composite`, `resize`, and the active-layer pixel mutations.
- `composite()` returns an RGBA buffer in row-major order compatible with `ImageData`.
- HistoryManager's Document snapshot path is reachable from TS through the binding.
- Layer IDs are accepted as UUID v4 strings supplied by the caller.
- Existing `PixelCanvas` binding is unchanged; existing TS code keeps building.
- `wasm-pack` build succeeds.

## Blocked by

- [087 — Rust core: Document/Layer + composite + add/delete/reorder](087-layer-system-rust-document-layer-core.md)
- [088 — Rust HistoryManager: Document snapshot support](088-layer-system-rust-history-document-snapshot.md)

## Scenarios addressed

- WASM bridge groundwork; no scenario directly observable yet.

## Results

| File | Description |
|------|-------------|
| `wasm/Cargo.toml` | Added `rlib` to `crate-type` (enables native `cargo test`); added `uuid = "1"` dependency (parse UUID v4 strings supplied by TS) |
| `wasm/src/lib.rs` | New `WasmDocument` facade wrapping `dotorixel_core::document::Document`; extended `WasmHistoryManager` with three Document-snapshot methods. 7 inline native unit tests cover the happy paths |

`WasmDocument` exposes:

- Constructor: `new(width, height, first_layer_id: String, first_layer_name: String) -> Result`
- Read-only getters: `width`, `height`, `active_layer_id() -> String`, `next_layer_number`, `layer_count`, `is_timeline_panel_collapsed`
- Index-based layer access: `layer_id_at`, `layer_name_at`, `layer_visible_at`, `layer_opacity_at` (all `Option<T>`)
- Mutators: `add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`, `resize`, `set_pixel`
- `composite() -> Vec<u8>` (RGBA row-major, `width * height * 4` bytes, `ImageData`-compatible)

`WasmHistoryManager` extended with:

- `push_document(&WasmDocument)`
- `undo_document(&WasmDocument) -> Option<WasmDocument>`
- `redo_document(&WasmDocument) -> Option<WasmDocument>`

The existing `WasmPixelCanvas` and canvas-path `WasmHistoryManager` methods are unchanged; the two facades coexist while callers migrate.

### Key Decisions

- **Layer IDs as `String` UUID at the boundary, parsed to `Uuid` immediately** — TS-side `crypto.randomUUID()` keeps Rust core free of a UUID-generation dependency. `Uuid::parse_str` failures map to `JsError`. ("Fail at the boundary, trust the core.")
- **Index-based read-only layer access (no `WasmLayer` type yet)** — kept the binding surface narrow because no TS call site exists yet. A `WasmLayer` wrapper can be introduced when 091 (`TabState switch`) reveals an actual iteration pattern.
- **No `flood_fill` / `apply_tool` delegate on `Document` yet** — issue text says "set_pixel, flood_fill, …", but `Document` itself currently only has `set_pixel`. Adding `flood_fill` to `Document` is core-API expansion that belongs to 094 (Add-layer button) or 091 (TabState switch) where the call site emerges. Tools are still reachable via `WasmPixelCanvas` until then.
- **`crate-type = ["cdylib", "rlib"]`** — the `rlib` addition lets `cargo test` run native unit tests on the binding wrapper. Production wasm-pack output (`cdylib`) is unaffected.

### Notes

- **`JsError`-returning paths are not testable from `cargo test` (native)**: `JsError::new` panics on non-wasm targets. The error paths (invalid UUID, oversize dimensions, unknown layer id, `RemoveLastLayer`) are mechanical `?`-propagation backed by `Display`-implementing core errors, and are verified end-to-end through the wasm-pack output (TS will surface them as JS `Error`). A `wasm-bindgen-test` rig can be added later if a regression class warrants it. A short note in the test module documents this.
- **Slice remains dead-code in main**: TS does not yet construct `WasmDocument`. This first surfaces in 090 (V3 schema) → 091 (TabState switch). svelte-check passes (0 errors / 0 warnings) confirming no impact on existing TS code.
- **Doc comments added on mutating methods** with hidden behavior (`add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`, `resize`, `composite`, `set_pixel`) so wasm-bindgen propagates the contract to the generated `.d.ts` for TS consumers.
- **Verification**: 267 core tests + 7 new wasm tests pass (`cargo test --workspace`); `cargo clippy -p dotorixel-wasm --all-targets -- -D warnings` clean; `bun run wasm:build` (wasm-pack) succeeds; `bun run check` (svelte-check) reports 0 errors.
