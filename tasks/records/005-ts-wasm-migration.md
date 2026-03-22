# 005 — TS→WASM migration — replace TS core imports with WASM bindings in Svelte components

## Results

| File | Description |
|------|-------------|
| `crates/core/src/canvas.rs` | Added `restore_pixels` for bulk pixel buffer restoration (needed for undo/redo) |
| `wasm/src/lib.rs` | Added `restore_pixels` WASM binding |
| `src/lib/wasm/init.ts` | Async WASM initialization module for SvelteKit layout and Storybook |
| `src/lib/canvas/renderer.ts` | Decoupled from WASM via `RenderableCanvas` local interface |
| `src/lib/canvas/export.ts` | Decoupled from WASM via `PngEncodable` local interface |
| `src/lib/canvas/view-types.ts` | Co-located shared canvas view types |
| `src/lib/ui/toolbar-types.ts` | Co-located `ToolType` with toolbar consumer |
| `src/lib/canvas/PixelCanvasView.svelte` | Migrated to WASM-backed canvas, viewport, history, tool |
| `src/lib/ui/Toolbar.svelte` | Updated to WASM tool types |
| `src/lib/ui/CanvasSettings.svelte` | Updated to WASM canvas creation |
| `src/lib/ui/StatusBar.svelte` | Updated to WASM types |
| `src/routes/+layout.ts` | Added WASM initialization at app startup |
| `.storybook/preview.ts` | Added WASM initialization for Storybook |
| `src/lib/canvas/legacy/` | Preserved replaced TS modules with migration guide README |
| `vitest.config.ts` | Excluded legacy folder from test discovery |

### Key Decisions

- Decoupled renderer and export from WASM via local interfaces (`RenderableCanvas`, `ExportableCanvas`) — avoids tight coupling to WASM types
- Co-located shared types with their consumers rather than a central types file
- Preserved legacy TS modules in `legacy/` folder with README for reference during migration verification
- Async WASM initialization at layout level — single `init()` call before any component mounts

### Notes

- 161 Rust tests + 93 TS tests passing (legacy tests excluded)
- All core logic (canvas, viewport, history, tool) now executes Rust-compiled WASM
