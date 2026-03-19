# Done

## 2026-03-19

### Tools — pencil, eraser (Rust core migration)

#### Results

| File | Description |
|------|-------------|
| `crates/core/src/tool.rs` | `ToolType` enum (Pencil, Eraser), `apply()` method, `interpolate_pixels()` free function, 16 tests |
| `crates/core/src/lib.rs` | Added `pub mod tool;` and `pub use tool::ToolType;` re-export |

#### Key Decisions
- `apply()` is a method on `ToolType` — natural receiver ("pencil applies to canvas"), follows CLAUDE.md "`impl` blocks for behavior" principle
- `interpolate_pixels()` is a free function — pure coordinate math with no natural type owner
- Coordinates accepted as `i32` — matches `screen_to_canvas()` output which can be negative; bounds checking handled internally
- Returns `bool` instead of `Result` — single failure mode (out-of-bounds) doesn't warrant a dedicated error type
- `Vec::with_capacity(max(|dx|, |dy|) + 1)` — Bresenham output size is predictable, avoids heap reallocation

## Pre-workflow Migration

Items completed before the task workflow was introduced. See git history for details.

### Build Pipeline Verification

- Vite + SvelteKit + wasm-pack + Tauri v2 integration verified

### Core

- Vitest setup (test environment for pure functions)
- Canvas creation (8x8, 16x16, 32x32) — pixel data structure + creation logic
- Pixel grid display — Canvas2D rendering
- Pencil tool (1px), eraser — first interaction, validates coordinate transform
- Single color picker
- Zoom in/out + panning — viewport transform, testable with drawing
- Undo/Redo (snapshot-based) — requires state-changing operations to exist
- PNG export

### UI

- Storybook setup — component preview environment for UI development
- Global styles & design tokens — CSS variables (light mode color tokens), pixel font (Galmuri), base reset
- Primitive components — PixelPanel (default/inset/raised), PixelButton (default/primary/secondary, sm/md/icon), ColorSwatch (sm/md, selected state)
- Toolbar component — lucide-svelte setup, tool selection, undo/redo, zoom, grid toggle, clear, export
- ColorPalette component — 36-color palette, current color preview, custom color input, recent colors
- CanvasSettings component — size presets (8/16/32/64), custom W/H input, resize
- StatusBar component — canvas size, zoom %, current tool display
- Layout integration — 3-column responsive layout (+page.svelte refactoring)
- Button style system — split PixelButton into BevelButton (3D border) and FlatButton (uniform border + shadow)
- Toolbar button abstraction — decouple Toolbar from specific button component to allow button style swaps without internal changes
- ColorSwatch border/shadow tinting — use color-relative border and shadow tones (matching the swatch color) as in the concept UI
- Zoom/scroll input separation — trackpad pinch gesture for zoom, trackpad scroll for canvas pan, mouse wheel for zoom (match standard editor behavior)
- Pan boundary clamping — prevent canvas from being panned entirely outside the visible panel area
- Cross-platform testing — verify web (Chrome) and Tauri desktop/iOS simulator builds

### Dual Shell PoC — Rust Core Migration

- TS unit test coverage for core logic (already in place)
- Cargo workspace setup — `crates/core/` with `wasm/` and `src-tauri/` as consumers
- Color type — Color struct, TRANSPARENT constant (from `src/lib/canvas/color.ts`)
- Color utilities — hex conversion, palette helpers (replaces remaining `src/lib/canvas/color.ts`)
- Pixel buffer — RGBA data structure, canvas creation (replaces `src/lib/canvas/canvas.ts`)
- Coordinate transform — screen↔canvas math (replaces `src/lib/viewport.ts`)

### Web Deployment

- Vercel project setup — GitHub integration, auto-deploy on `main` push
- Verify deployed build — WASM loading, all features working on `*.vercel.app`
