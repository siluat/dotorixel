# 023 — Circle/Ellipse tool

## Plan

Add ellipse drawing tool: two-point drag defines a bounding box, ellipse outline is inscribed. Uses the same snapshot-restore preview pattern as line and rectangle tools. Core algorithm in Rust, WASM bindings, TypeScript integration, toolbar UI.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/tool.rs` | `Ellipse` enum variant, `ellipse_outline()` (Zingl's Bresenham algorithm), 19 unit tests |
| `wasm/src/lib.rs` | `WasmToolType::Ellipse = 4`, `wasm_ellipse_outline()` |
| `src/lib/canvas/tool-types.ts` | `'ellipse'` added to `ToolType` union |
| `src/lib/canvas/editor-state.svelte.ts` | `#handleEllipseDraw()`, shape tool condition branches updated |
| `src/lib/ui-pixel/Toolbar.svelte` | Circle icon + Ellipse button after Rectangle |
| `src/lib/ui-pixel/StatusBar.svelte` | `'ellipse'` added to `TOOL_LABELS` map |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Ellipse button added to Pebble theme toolbar |
| `src/lib/canvas/editor-state.svelte.test.ts` | 4 integration tests (draw, preview cleanup, undo atomicity, recentColors) |

### Key Decisions

- Zingl's Bresenham-style ellipse over midpoint ellipse algorithm — midpoint approach failed for small sizes (2x2, 2x3) where semi-axis = 0 causes out-of-bounds reflections. Zingl's scans from bounding box edges inward, handling even/odd sizes naturally via a `height_parity` flag.

### Notes

- `#handleEllipseDraw` follows the same structure as `#handleRectangleDraw` — three shape tool methods now share identical pattern (snapshot restore + outline + apply). If a fourth shape tool is added, extracting a shared helper would be warranted.
