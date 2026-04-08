---
title: SVG export
status: done
created: 2026-04-08
---

## Problem Statement

Users can only export their pixel art as PNG. When they want to use their artwork in contexts that benefit from vector scalability (web pages, print, presentations), the PNG becomes blurry when scaled up. A vector format export would let pixel art stay crisp at any size.

## Solution

Add SVG export to the editor. Each pixel becomes a `<rect>` element in the SVG, with `shape-rendering="crispEdges"` to prevent anti-aliasing artifacts. The SVG uses only a `viewBox` (no fixed width/height) so it scales freely to any container. Transparent pixels (alpha=0) are omitted; semi-transparent pixels use `fill-opacity`.

The implementation lives in Rust core as an `SvgExport` trait, following the same pattern as the existing `PngExport`. WASM bindings expose `encode_svg()` to TypeScript, and the web shell wires it through the existing download mechanism.

## Key Scenarios

1. The user exports a 16x16 canvas with opaque pixels → an SVG file is downloaded containing 256 `<rect>` elements (minus any transparent pixels), with `viewBox="0 0 16 16"` and no width/height attributes.
2. The user opens the exported SVG in a browser and zooms to 1000% → every pixel remains a sharp, crisp square with no blurring or seam artifacts.
3. The user exports a canvas where some pixels are fully transparent (alpha=0) → those pixels do not appear as `<rect>` elements in the SVG output.
4. The user exports a canvas with semi-transparent pixels (e.g., alpha=128) → those pixels appear as `<rect>` elements with `fill-opacity` set proportionally (e.g., 0.502).
5. The user exports a 1x1 canvas with a single red pixel → a valid SVG with one `<rect fill="#ff0000"/>` element.
6. The user exports a canvas where all pixels are transparent → a valid SVG with only the root `<svg>` element and no `<rect>` children.

## Implementation Decisions

- **Encoding location**: Rust core, as an `SvgExport` trait on `PixelCanvas` (extension trait in an export module, mirroring `PngExport`).
- **Pixel representation**: One `<rect x y width="1" height="1">` per non-transparent pixel. Maximum 65,536 rects for a 256x256 canvas — well within practical limits.
- **Anti-aliasing prevention**: The root `<svg>` element includes `shape-rendering="crispEdges"` to ensure pixel-perfect rendering without seams between adjacent rects.
- **ViewBox only**: The SVG sets `viewBox="0 0 {width} {height}"` without explicit `width`/`height` attributes, allowing the SVG to scale to fit any container.
- **Transparency**: Pixels with alpha=0 are skipped entirely. Pixels with 0 < alpha < 255 use `fill-opacity` (rounded to 3 decimal places). Fully opaque pixels omit `fill-opacity`.
- **Color format**: Hex `#rrggbb` for fill colors, matching the existing `Color::to_hex()` output.
- **SVG structure**: Minimal — `<svg>` root with xmlns, viewBox, and shape-rendering, containing flat `<rect>` children. No `<g>` grouping, no `<defs>`, no CSS classes.
- **WASM binding**: `WasmPixelCanvas.encode_svg()` returns `Result<String, JsError>`, unlike `encode_png()` which returns bytes.
- **Web download**: TypeScript `exportAsSvg()` function creates a Blob with `type: "image/svg+xml"` and triggers download via the same anchor pattern as PNG.
- **Default filename**: `dotorixel-{width}x{height}.svg`. The upcoming export UI will allow users to customize this.
- **Apple native**: Out of scope. The Rust core trait will be available via Uniffi bindings but will not be wired into the native UI in this task.

## Testing Decisions

Tests focus on the Rust core `SvgExport` implementation, verifying observable SVG output characteristics. Prior art: the 5 existing `PngExport` tests in `crates/core/src/export.rs`.

- **Valid SVG output**: The output is well-formed XML that parses without errors.
- **Correct rect generation**: Opaque pixels produce `<rect>` elements with the correct x, y, and fill attributes.
- **Transparent pixel omission**: Alpha=0 pixels produce no `<rect>` elements.
- **Semi-transparent pixel handling**: Pixels with 0 < alpha < 255 produce `<rect>` elements with the correct `fill-opacity`.
- **ViewBox correctness**: The `viewBox` attribute matches the canvas dimensions.
- **crispEdges attribute**: The root `<svg>` element includes `shape-rendering="crispEdges"`.
- **Edge cases**: Single-pixel canvas, all-transparent canvas, non-square canvas.

TypeScript download logic (`exportAsSvg`) follows the identical blob-anchor pattern as PNG and does not require separate tests.

## Rejected Alternatives

- **Run-length or 2D region merging**: Merging adjacent same-color pixels into larger rects would reduce file size, but the maximum canvas size (256x256) keeps rect counts manageable. The added complexity is not justified for the MVP. Can be revisited if file size becomes a concern.
- **TypeScript-side SVG generation**: Would work for web but would not be available to the Apple native shell without reimplementation. Rust core keeps the logic shared across platforms.
- **Fixed width/height on SVG**: Setting explicit dimensions would constrain how the SVG displays by default. Omitting them lets the SVG adapt to its container, which is more versatile for a vector format.
- **Checkerboard background for transparent regions**: Would add visual noise to the exported file. Transparency is better represented by actual SVG transparency, matching user expectations for vector exports.

## Out of Scope

- Export UI changes (format selector dropdown, filename input field) — tracked as a separate prerequisite task.
- Apple native shell SVG export UI wiring — to be addressed in a future Apple native task.
- SVG import / round-trip editing.
- Path tracing or vectorization (converting pixel clusters into smooth vector paths).

## Further Notes

- The export UI task (format selection + filename customization) is a prerequisite and should be completed before this implementation begins.
- A new todo item for the export UI task should be added to `tasks/todo.md` under "Export & sharing".
