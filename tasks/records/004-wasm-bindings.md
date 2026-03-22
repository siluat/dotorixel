# 004 — WASM bindings — wasm-bindgen interface, Svelte integration verified

## Results

| File | Description |
|------|-------------|
| `wasm/src/lib.rs` | Full rewrite — WasmColor, WasmPixelCanvas, WasmToolType, WasmHistoryManager, WasmViewport, WasmScreenCanvasCoords, WasmViewportSize wrappers + `apply_tool`, `wasm_interpolate_pixels`, `core_version` free functions |
| `src/lib/wasm/setup.ts` | Vitest WASM initialization helper — `readFileSync` + `initSync` for Node.js test environment |
| `src/lib/wasm/wasm-color.test.ts` | 6 tests — construction, getters, hex round-trip, transparent, error cases |
| `src/lib/wasm/wasm-canvas.test.ts` | 12 tests — creation, with_color, pixels Uint8Array, get/set_pixel, bounds, clear, resize, constants, errors |
| `src/lib/wasm/wasm-tool.test.ts` | 6 tests — apply_tool pencil/eraser, out-of-bounds, interpolate_pixels flat format |
| `src/lib/wasm/wasm-history.test.ts` | 7 tests — push/undo/redo round-trip, can_undo/can_redo, clear, default_manager |
| `src/lib/wasm/wasm-viewport.test.ts` | 13 tests — for_canvas, screen_to_canvas, display_size, zoom_at_point, pan, clamp_pan, fit_to_viewport, zoom utilities, constants |
| `src/routes/wasm-test/+page.svelte` | Browser integration test page — async `init()`, Color/Canvas/Tool smoke test |
| `vitest.config.ts` | Added `setupFiles: ['src/lib/wasm/setup.ts']` for automatic WASM init in test workers |
| `package.json` | Updated `test` script to `bun run wasm:build && vitest run` |
| `tasks/todo.md` | Added "TS→WASM migration" task between WASM bindings and PNG export |

### Key Decisions

- `js-sys` dependency not needed — `Option<Vec<u8>>` auto-converts to `Uint8Array | undefined` in wasm-bindgen 0.2.114
- Wrapper pattern with `Wasm*` prefix — keeps `dotorixel-core` free of wasm-bindgen dependency, reusable for UniFFI
- Copy semantics for pixel data — `Vec<u8>` → `Uint8Array` copy (4KB at 32×32), no SharedArrayBuffer complexity
- `ViewportSize` flattened to `(viewport_width, viewport_height)` params in `clamp_pan`/`fit_to_viewport` — avoids extra JS object construction
- `interpolate_pixels` returns flat `Int32Array` `[x0, y0, x1, y1, ...]` — simpler JS consumption than array of tuples
- Associated constants exposed as static methods — wasm-bindgen limitation workaround

### Notes

- Placeholder functions (`add`, `greet`) removed; `core_version()` retained
- WASM binary size: 68.64KB (gzip: 28.11KB) including all core logic
- 231 total tests passing (187 existing TS + 44 new WASM integration)
