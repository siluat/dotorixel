# 020 — Line tool (Bresenham line drawing)

## Plan

### Context

DOTORIXEL currently has only Pencil and Eraser tools. The Line tool is the first two-point drag interaction, establishing the foundation for Rectangle/Circle tools. Since the Bresenham algorithm already exists in Rust core (`interpolate_pixels`), the focus is on type extensions and UI interaction rather than new algorithms.

### Core Design: Snapshot-Restore Preview

Line preview during drag uses a **snapshot-restore** approach:

1. Pointer down → save current pixel state as preview snapshot, record start point
2. Pointer move → restore preview snapshot → draw line from start to current point
3. Pointer up → line is finalized (pixels already in correct state), release preview snapshot

No separate preview render layer needed. At current MAX_DIMENSION=128, the maximum buffer is 64KB memcpy — negligible performance cost.

#### Scaling Limits

Each mouse move triggers buffer copy (JS→WASM→internal) + rendering (ImageData + drawImage), with cost proportional to canvas area.

| Canvas Size | Buffer Size | Est. Cost per Move | 60fps Headroom |
|-------------|-------------|-------------------|----------------|
| ≤256×256 | ≤256 KB | ~1ms | Sufficient |
| 512×512 | 1 MB | ~2-3ms | Stable |
| 1024×1024 | 4 MB | ~5-10ms | Borderline (jank possible) |
| ≥2048×2048 | ≥16 MB | ≥20ms | Frame drops |

**≤512×512**: Snapshot-restore is safe. **~1024×1024**: Borderline. **2048+**: Must switch to overlay preview — render preview on a separate canvas layer, no pixel buffer modification during drag, commit once on pointer up.

#### MAX_DIMENSION Change Detection

**Guard test** (`crates/core/src/tool.rs`): Fails if MAX_DIMENSION exceeds 512 with an actionable message. Developer must either confirm performance and raise the threshold, or switch to the overlay approach.

### Cross-Platform Design

#### Rationale for `ToolType::Line` in Rust Core

1. **Apple native shell needs tool discrimination** — Swift's `EditorState.activeTool` uses Rust `ToolType`, so Line must be in the Rust enum for both shells to manage tools with the same type.
2. **`apply()` behavior identical to Pencil** — `ToolType::Line` sets pixels to foreground color. Handled via `Pencil | Line => foreground_color` in the match arm.

#### Architecture Compliance

| Layer | Role | Location |
|-------|------|----------|
| Tool algorithm (Bresenham) | Rust core | `interpolate_pixels()` — already exists |
| Tool type enum | Rust core | `ToolType::Line` — new |
| Pixel application | Rust core | `ToolType::apply()` — reuses Pencil behavior |
| Snapshot-restore preview | Shell (TS/Swift) | UI interaction belongs in the shell layer |

Apple shell two-point drag implementation is out of scope (separate Apple task).

### Changed Files

1. `crates/core/src/tool.rs` — `ToolType::Line` variant, `Pencil | Line` match arm, guard test
2. `wasm/src/lib.rs` — `WasmToolType::Line = 2`, `to_core()` mapping
3. `src/lib/canvas/tool-types.ts` — add `'line'`
4. `src/lib/canvas/editor-state.svelte.ts` — `#lineStart`, `#previewSnapshot`, `#handleLineDraw`
5. `src/lib/ui-pebble/BottomToolsPanel.svelte` — `Slash` icon Line button
6. `src/lib/ui-pixel/Toolbar.svelte` — `Slash` icon Line button
7. Stories — add line active state stories
8. Tests — Rust (apply, guard), TS (basic draw, snapshot-restore, undo, recentColors)

### No PixelCanvasView Changes

Reuses the existing callback structure (`onDrawStart`, `onDraw`, `onDrawEnd`). The View operates without knowledge of tool type.

#### Known Limitation: pointerLeave Behavior

`handlePointerLeave` calls `onDrawEnd()` during drawing, finalizing the line at the exit point. Most pixel editors maintain drag outside the canvas, but this applies to pencil/eraser too and is deferred as a shared improvement.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/tool.rs` | Added `ToolType::Line` variant, `Pencil \| Line` match arm, guard test for MAX_DIMENSION ≤ 512 |
| `wasm/src/lib.rs` | Added `WasmToolType::Line = 2` and `to_core()` mapping |
| `src/lib/canvas/tool-types.ts` | Added `'line'` to `ToolType` union |
| `src/lib/canvas/editor-state.svelte.ts` | Snapshot-restore preview logic: `#lineStart`, `#previewSnapshot`, `#handleLineDraw` |
| `src/lib/canvas/editor-state.svelte.test.ts` | New file — 4 tests: basic draw, snapshot-restore, undo, recentColors |
| `src/lib/ui-pebble/BottomToolsPanel.svelte` | Added Line button with `Slash` icon |
| `src/lib/ui-pebble/BottomToolsPanel.stories.svelte` | Added `LineSelected` story |
| `src/lib/ui-pixel/Toolbar.svelte` | Added Line button with `Slash` icon |
| `src/lib/ui-pixel/Toolbar.stories.svelte` | Added `LineActive` story |
| `src/lib/ui-pixel/StatusBar.svelte` | Added `'line'` to `TOOL_LABELS` record |
| `src/routes/pixel/+page.svelte` | Added `line` to `WASM_TOOL_MAP` |
| `vitest.config.ts` | Added `svelte()` plugin for `.svelte.ts` rune support in tests |

### Key Decisions

- Snapshot-restore pattern for preview (not overlay canvas) — safe at current MAX_DIMENSION=128 (64KB buffer)
- `#lineStart` and `#previewSnapshot` are plain fields, not `$state` — no UI reactivity needed for internal draw state
- Guard test in Rust enforces MAX_DIMENSION ≤ 512; failing test provides actionable migration guidance

### Notes

- Apple native shell line tool is out of scope — separate task
- `pointerLeave` during line draw confirms at exit point — known limitation, shared with pencil/eraser (separate improvement)
- `vitest.config.ts` svelte plugin addition enables future `.svelte.ts` tests beyond this task
