# 006 — PNG export — Rust-side encoding

## Results

| File | Description |
|------|-------------|
| `crates/core/Cargo.toml` | Added `png = "0.17"` dependency |
| `crates/core/src/export.rs` | New module — `ExportError` enum, `PngExport` extension trait, 5 unit tests |
| `crates/core/src/lib.rs` | Registered `export` module and re-exported `ExportError`, `PngExport` |
| `wasm/src/lib.rs` | Added `encode_png()` method to `WasmPixelCanvas` |
| `src/lib/canvas/export.ts` | Replaced Canvas2D encoding with WASM `encode_png()` call, async → sync |
| `src/routes/+page.svelte` | Updated `handleExportPng` from async to sync |

### Key Decisions

- Used `Cursor<&mut Vec<u8>>` to write PNG into memory buffer without file I/O
- Converted `exportAsPng` from async to sync since Rust encoding is synchronous
