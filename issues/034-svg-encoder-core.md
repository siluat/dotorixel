---
title: SVG encoder — Rust core + WASM binding
status: done
created: 2026-04-09
parent: 031-svg-export.md
---

## What to build

Implement SVG export in Rust core as an `SvgExport` extension trait on `PixelCanvas`, following the same pattern as the existing `PngExport` trait. Each non-transparent pixel becomes a `<rect>` element. The root `<svg>` uses `viewBox` only (no fixed width/height) and `shape-rendering="crispEdges"`. Expose the encoder to TypeScript via a WASM binding `encode_svg()` that returns a `String`.

See parent PRD [031](031-svg-export.md) for full encoding rules (transparency handling, color format, SVG structure).

## Acceptance criteria

- `SvgExport` trait implemented as an extension trait on `PixelCanvas` in the export module
- Opaque pixels produce `<rect>` elements with correct x, y, fill attributes
- Transparent pixels (alpha=0) are omitted
- Semi-transparent pixels (0 < alpha < 255) include `fill-opacity` rounded to 3 decimal places
- SVG root has `viewBox="0 0 {width} {height}"` and `shape-rendering="crispEdges"`
- No fixed `width`/`height` attributes on the SVG root
- WASM binding `WasmPixelCanvas.encode_svg()` returns `Result<String, JsError>`
- All Rust tests pass covering: valid SVG output, rect generation, transparent pixel omission, semi-transparent handling, viewBox correctness, crispEdges attribute, edge cases (1x1 canvas, all-transparent canvas, non-square canvas)

## Blocked by

None — can start immediately.

## Scenarios addressed

From parent PRD [031](031-svg-export.md):

- Scenario 1: 16x16 canvas with opaque pixels → correct SVG with rects and viewBox
- Scenario 2: Exported SVG zoomed to 1000% → crisp rendering (crispEdges attribute)
- Scenario 3: Transparent pixels → no rect elements
- Scenario 4: Semi-transparent pixels → fill-opacity
- Scenario 5: 1x1 canvas → single rect
- Scenario 6: All-transparent canvas → empty SVG with root element only

## Results

| File | Description |
|------|-------------|
| `crates/core/src/export.rs` | `SvgExport` trait + `PixelCanvas` impl + 7 tests |
| `crates/core/src/lib.rs` | Re-export `SvgExport` |
| `wasm/src/lib.rs` | `WasmPixelCanvas.encode_svg()` WASM binding |

### Key Decisions

- Used `get_pixel()` public API instead of raw byte indexing to avoid coupling to RGBA byte layout
- Returns `Result<String, ExportError>` for API consistency with `PngExport`, even though current implementation is infallible
