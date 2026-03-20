# Legacy TS Core Modules

TypeScript implementations replaced by the WASM (Rust) core. Preserved for reference.

## Replacement Map

| Legacy (TS) | Replaced by (WASM) |
|---|---|
| `canvas.ts` | `WasmPixelCanvas` (`wasm/src/lib.rs`, `crates/core/src/canvas.rs`) |
| `tool.ts` | `apply_tool()`, `wasm_interpolate_pixels()` (`wasm/src/lib.rs`, `crates/core/src/tool.rs`) |
| `history.ts` | `WasmHistoryManager` (`wasm/src/lib.rs`, `crates/core/src/history.rs`) |
| `viewport.ts` | `WasmViewport` (`wasm/src/lib.rs`, `crates/core/src/viewport.rs`) |

## Migration Date

2026-03-20. See `feat: migrate TS core to WASM` in commit history.

## TS Modules Not Migrated

The following modules remain active (no WASM equivalent — browser-only or simple utilities):

- `../color.ts` — Color interface, hex conversion
- `../renderer.ts` — Canvas2D rendering
- `../export.ts` — PNG export
- `../wheel-input.ts` — Browser input classification

## Tests

Test files in this folder are excluded from `vitest.config.ts` and do not run.
The same logic is covered by `src/lib/wasm/wasm-*.test.ts` and Rust unit tests (`crates/core/src/`).
