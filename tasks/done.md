# Done

## 2026-03-21

### UniFFI setup — generate Swift bindings from `crates/core/`

#### Results

| File | Description |
|------|-------------|
| `apple/Cargo.toml` | New crate for UniFFI Swift bindings (cdylib + staticlib + lib) |
| `apple/src/lib.rs` | Object wrappers (ApplePixelCanvas, AppleHistoryManager, AppleViewport), AppleError, free functions |
| `apple/src/bin/uniffi-bindgen.rs` | CLI binary for generating Swift bindings |
| `crates/core/Cargo.toml` | Added optional `uniffi` dependency and feature flag |
| `crates/core/src/lib.rs` | Added conditional `setup_scaffolding!()` behind uniffi feature |
| `crates/core/src/color.rs` | `cfg_attr` Record derive on `Color` |
| `crates/core/src/canvas.rs` | `cfg_attr` Record derive on `CanvasCoords` |
| `crates/core/src/viewport.rs` | `cfg_attr` Record derive on `ScreenCanvasCoords`, `ViewportSize` |
| `crates/core/src/tool.rs` | `cfg_attr` Enum derive on `ToolType` |
| `Cargo.toml` | Added `apple` to workspace members |
| `.gitignore` | Added `apple/generated/` |
| `docs/decisions/uniffi-mutex-interior-mutability.{ko,en}.md` | ADR: Mutex interior mutability for UniFFI Object wrappers |
| `tasks/progress.md` | Task tracking |

#### Key Decisions
- Feature flag (`cfg_attr`) on core types for Records/Enums; wrapper Objects in `apple/` crate — follows Bitwarden pattern
- `Mutex<T>` for `ApplePixelCanvas` and `AppleHistoryManager` interior mutability (see `docs/decisions/uniffi-mutex-interior-mutability.ko.md`)
- Unified `AppleError` flat error in apple crate instead of annotating core errors (avoids `usize`/`char` incompatibility)
- `uniffi_reexport_scaffolding!()` in apple crate for robust multi-crate symbol export

#### Notes
- Generated Swift files (`apple/generated/`) are gitignored; regenerate with `cargo run -p dotorixel-apple --bin uniffi-bindgen -- generate --library target/debug/libdotorixel_apple.dylib --language swift --out-dir apple/generated`
- UniFFI Objects don't support associated functions (static methods) — constants/utilities exposed as free functions
- This does not produce a runnable macOS/iPadOS app; Xcode project integration is the next task

### UI theme migration — Move Pixel UI to `/pixel` page and switch default to Pebble

#### Results

| File | Description |
|------|-------------|
| `src/lib/ui-pixel/pixel-tokens.css` | Pixel design tokens scoped under `.pixel-editor` (extracted from `:root`) |
| `src/lib/ui-pixel/` | Renamed from `src/lib/ui/` — all Pixel components, stories, tokens |
| `src/lib/ui-pixel/DesignTokens.stories.svelte` | Moved from `src/lib/foundations/` into `ui-pixel/` |
| `src/routes/pixel/+page.svelte` | Pixel editor at `/pixel` route |
| `src/routes/+page.ts` | Universal load 307 redirect `/` → `/pebble` |
| `src/routes/+page.svelte` | Minimal empty fallback (redirect handles navigation) |
| `src/styles/global.css` | Trimmed to CSS reset + theme-neutral body |
| `.storybook/preview.ts` | Added `pixel-tokens.css` import |
| `src/lib/ui-pixel/*.stories.svelte` | `class="pixel-editor pixel-story-bg"` wrapper added to all 12 story files |

#### Key Decisions
- Universal load redirect (`+page.ts`) — `+page.server.ts` incompatible with `adapter-static` (no runtime server)
- Directory renamed `ui/` → `ui-pixel/` to mirror `ui-pebble/` structure; autotitle handles Storybook grouping
- `--font-size-lg: 18px` token added (was referenced but never defined)

#### Notes
- Dev server restart required after structural changes (new routes, CSS import graph changes) — Vite HMR alone doesn't handle module graph restructuring

## 2026-03-20

### Pebble UI design exploration

#### Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-state.svelte.ts` | Shared `EditorState` class — Svelte 5 runes-based reactive state + handlers |
| `src/lib/ui-pebble/pebble-tokens.css` | Design tokens scoped to `.pebble-editor` (`--pebble-*` prefix) |
| `src/lib/ui-pebble/pebble-palette-data.ts` | 2×9 preset color palette data |
| `src/lib/ui-pebble/FloatingPanel.svelte` | Pill-shaped translucent panel wrapper with `style` prop |
| `src/lib/ui-pebble/PebbleButton.svelte` | Icon button — acorn brown accent on active state |
| `src/lib/ui-pebble/PebbleSwatch.svelte` | Color swatch — hover scale, selected outline |
| `src/lib/ui-pebble/TopControlsLeft.svelte` | Undo/Redo/Grid toggle (absolute top-left) |
| `src/lib/ui-pebble/TopControlsRight.svelte` | Canvas presets, W×H input, Export, Clear (absolute top-right) |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Pen/Eraser toggle + zoom controls (bottom center) |
| `src/lib/ui-pebble/BottomColorPalette.svelte` | Active swatch + preset grid + custom picker (bottom center) |
| `src/lib/ui-pebble/*.stories.svelte` | Co-located Svelte CSF v5 stories for all 7 components |
| `src/routes/pebble/+page.svelte` | Full editor page — full-screen canvas with floating overlay UI |
| `.storybook/preview.ts` | Added `pebble-tokens.css` import for Storybook |

#### Key Decisions
- Acorn brown accent (`oklch(0.55 0.15 45)`) reused from existing primary color for brand consistency
- `EditorState` class extracted to eliminate duplicated state/handler logic between pages
- Full-screen canvas with `ResizeObserver`-driven viewport sizing (Figma-like infinite canvas pattern)
- Originally named "Blossom", renamed to "Pebble" to match the rounded panel shapes + warm earth tones

#### Notes
- Existing `/` page is untouched — `EditorState` can be adopted there later
- Canvas resize preserves viewport position (`clamp_pan`) instead of resetting (`for_canvas`)

### PNG export — Rust-side encoding

#### Results

| File | Description |
|------|-------------|
| `crates/core/Cargo.toml` | Added `png = "0.17"` dependency |
| `crates/core/src/export.rs` | New module — `ExportError` enum, `PngExport` extension trait, 5 unit tests |
| `crates/core/src/lib.rs` | Registered `export` module and re-exported `ExportError`, `PngExport` |
| `wasm/src/lib.rs` | Added `encode_png()` method to `WasmPixelCanvas` |
| `src/lib/canvas/export.ts` | Replaced Canvas2D encoding with WASM `encode_png()` call, async → sync |
| `src/routes/+page.svelte` | Updated `handleExportPng` from async to sync |

#### Key Decisions
- Used `Cursor<&mut Vec<u8>>` to write PNG into memory buffer without file I/O
- Converted `exportAsPng` from async to sync since Rust encoding is synchronous

### TS→WASM migration — replace TS core imports with WASM bindings in Svelte components

#### Results

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

#### Key Decisions
- Decoupled renderer and export from WASM via local interfaces (`RenderableCanvas`, `ExportableCanvas`) — avoids tight coupling to WASM types
- Co-located shared types with their consumers rather than a central types file
- Preserved legacy TS modules in `legacy/` folder with README for reference during migration verification
- Async WASM initialization at layout level — single `init()` call before any component mounts

#### Notes
- 161 Rust tests + 93 TS tests passing (legacy tests excluded)
- All core logic (canvas, viewport, history, tool) now executes Rust-compiled WASM

### WASM bindings — wasm-bindgen interface, Svelte integration verified

#### Results

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

#### Key Decisions
- `js-sys` dependency not needed — `Option<Vec<u8>>` auto-converts to `Uint8Array | undefined` in wasm-bindgen 0.2.114
- Wrapper pattern with `Wasm*` prefix — keeps `dotorixel-core` free of wasm-bindgen dependency, reusable for UniFFI
- Copy semantics for pixel data — `Vec<u8>` → `Uint8Array` copy (4KB at 32×32), no SharedArrayBuffer complexity
- `ViewportSize` flattened to `(viewport_width, viewport_height)` params in `clamp_pan`/`fit_to_viewport` — avoids extra JS object construction
- `interpolate_pixels` returns flat `Int32Array` `[x0, y0, x1, y1, ...]` — simpler JS consumption than array of tuples
- Associated constants exposed as static methods — wasm-bindgen limitation workaround

#### Notes
- Placeholder functions (`add`, `greet`) removed; `core_version()` retained
- WASM binary size: 68.64KB (gzip: 28.11KB) including all core logic
- 231 total tests passing (187 existing TS + 44 new WASM integration)

## 2026-03-19

### History — undo/redo snapshot logic (Rust core migration)

#### Results

| File | Description |
|------|-------------|
| `crates/core/src/history.rs` | `HistoryManager` struct with `VecDeque`-based undo/redo stacks, `Default` trait impl, 20 tests |
| `crates/core/src/lib.rs` | Added `pub mod history;` and `pub use history::HistoryManager;` re-export |
| `CLAUDE.md` | Added doc comment guideline to Rust Migration section |

#### Key Decisions
- `Vec<u8>` snapshots instead of `PixelCanvas` — keeps history module decoupled from canvas module, matches TS approach
- `VecDeque<Vec<u8>>` for undo stack — O(1) eviction via `pop_front()` vs `Vec::remove(0)` O(n)
- `&[u8]` input with `.to_vec()` copy — ownership-based mutation safety, equivalent to TS `.slice()`
- No error type — all operations are infallible, `undo`/`redo` return `Option<Vec<u8>>`
- Doc comment guideline added — write when it adds signal (non-obvious side effects), skip when the signature speaks (trivial getters, `Option`/`Result` return semantics)

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
