---
title: "Layer system: switch main canvas render to `document.composite()`"
status: done
created: 2026-05-11
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Make the main canvas render the full document composite — every visible layer blended bottom-to-top with source-over alpha — instead of mirroring only the active layer's pixels.

Today, `tab-state.svelte.ts` keeps a `pixelCanvas` field that is initialized and updated from `activeLayerPixels(document)`. `+page.svelte` (and the surrounding UI) passes this `pixelCanvas` to the renderer, so anything drawn on a non-active layer is invisible and any layer below the active one is treated as transparent. This contradicts both the PRD's "Document is the sole source of truth" decision and the way users expect layer stacks to behave (Aseprite, Photoshop, Procreate).

Scope:

- Remove the `pixelCanvas` mirror from `TabState` (`tab-state.svelte.ts`). Callers that need width/height/pixels read from `document` directly.
- The main canvas renderer receives a `RenderableCanvas`-shaped wrapper whose `pixels()` returns `document.composite()` (cached per render trigger if the per-frame allocation matters; otherwise unmemoized to keep things simple).
- Tools mutate the active layer through `document.set_pixel` / `document.apply_tool` / `document.flood_fill`. The existing `toolRunner` host indirection stays — only the backing object changes.
- `tab-state.exportPng` already uses `document.composite()` and is unchanged.
- `tab-state.toSnapshot` keeps using `document.composite()` until **103** lands; the persistence format swap is intentionally scoped out of this slice.
- `+page.svelte` callers that currently read `editor.pixelCanvas.width` / `.height` / `.pixels()` switch to `editor.document.width` / `.height` / `editor.document.composite()` (or a thin convenience getter on `TabState` like `compositeBuffer()` if the call sites get noisy).

Out of scope:

- Render performance work (caching the composite, dirty-region invalidation, WebGL2). M3 explicitly defers composite caching until measurement.
- Persistence wiring — owned by **103**.
- Visibility toggle UI — owned by **097** (this slice only ensures the renderer respects `visible === false`, which the Rust composite already does).

## Acceptance criteria

- With two layers — bottom: opaque red, top: partially-transparent blue (e.g. `rgba(0, 0, 255, 128)`) — the canvas shows the source-over blend on screen, not the top layer alone over the checkerboard.
- After clicking "+ add layer", drawing on the new (now-active) layer immediately shows the stroke on top of whatever was visible before. Switching the active layer back to a lower one does not erase the upper layer from the canvas.
- A layer with `visible = false` does not contribute to the composite (already covered by the Rust unit test; this slice locks the wiring path end-to-end).
- Pixel Perfect e2e and other existing canvas-render e2e/component tests still pass against the composite path (no regression for single-layer documents).
- `TabState` no longer exposes a `pixelCanvas` field. Any test or call site referencing it is migrated.

## Blocked by

- [094 — Add-layer button](094-layer-system-add-layer-button.md) — provides the only existing entry point to create a second layer, which this slice's manual and e2e verification both rely on.

## Scenarios addressed

Prerequisite for visual verification of Scenarios 5 (reorder), 6 (undo across layer changes), 7 (visibility toggle), and 11 (mobile Timeline tab). Directly satisfies the rendering half of Scenario 2 ("draw applies to the active layer") by making non-active layers visible while the active layer accepts the stroke.

## Results

| File | Description |
|------|-------------|
| `crates/core/src/document.rs` | Added `Document::restore_active_layer_pixels(&[u8]) -> Result<(), PixelCanvasError>` — overwrites the active layer's pixel buffer for shape/move-tool snapshot-restore previews. Other layers unaffected; buffer-length validated by `Layer::restore_pixels`. |
| `wasm/src/lib.rs` | Bound `WasmDocument::restore_active_layer_pixels(&[u8]) -> Result<(), JsError>`. |
| `src/lib/canvas/canvas-model.ts` | Extended the read-only `Document` structural interface with `restore_active_layer_pixels(data: Uint8Array): void` so the compile-time `expectTypeOf` check stays honest. |
| `src/lib/canvas/wasm-backend.ts` | New helper trio over `Document` active layer: `activeLayerPixels` (read), `restoreActiveLayerPixels` (write), `clearActiveLayerPixels` (rename from `clearDocumentActiveLayer`). All three pivot on the `ActiveLayerPixels` naming axis. Stripped strangler-migration phrasing from `createDocumentDrawingOps` doc-comment. |
| `src/lib/canvas/renderer.ts` | Exported `RenderableCanvas` interface (`{width, height, pixels()}`) — the minimal shape the renderer needs; satisfied by both `PixelCanvas` and the new `TabState.compositeBuffer` getter. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Removed `pixelCanvas` field and all derived projections. Replaced with `compositeBuffer` getter that returns `{width, height, pixels: () => document.composite()}`. `exportableSnapshot()` builds a fresh `PixelCanvas` for PNG/SVG export via `canvasFactory.fromPixels(width, height, document.composite())`. |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Projections updated: `document`, `compositeBuffer`, `exportableSnapshot()` (replaces `pixelCanvas`). |
| `src/lib/canvas/tool-authoring.ts` | `SessionHost.pixelCanvas` → `document`. `ToolContext.canvas` field removed entirely. `shapeTool` start/redraw use `activeLayerPixels` / `restoreActiveLayerPixels` instead of `pixelCanvas.pixels()` / `restore_pixels`. |
| `src/lib/canvas/tools/move-tool.ts` | Uses `activeLayerPixels` / `restoreActiveLayerPixels` on the document; reads `document.width`/`height` for shift bounds. |
| `src/lib/canvas/draw-tool.ts` | `ToolContext.canvas: PixelCanvas` field removed. Tools that need dimensions read from `host.document`. |
| `src/lib/canvas/stroke-engine.ts` | `createStrokeEngine` no longer composes `createDrawingOps(pixelCanvas)` with `createDocumentDrawingOps(document)` via `teeDrawingOps`; the tool runner writes only through `createDocumentDrawingOps`. `SessionHost.document` forwarded from `ToolRunnerHost.document`. |
| `src/lib/canvas/tool-runner.svelte.ts` | `ToolRunnerHost.pixelCanvas` field removed. `clear()` only clears the active document layer via `clearActiveLayerPixels`. |
| `src/lib/canvas/PixelCanvasView.svelte` | `pixelCanvas` prop type widened from `PixelCanvas` to the exported `RenderableCanvas` interface. Prop name retained (out-of-scope rename). |
| `src/routes/editor/+page.svelte` | Renderer prop wired to `editor.compositeBuffer`; UI labels (canvas width/height in TopBar/StatusBar/RightPanel/ExportBottomSheet) read `editor.document.width/height`; blank-canvas check on tab close reads `tab.compositeBuffer.pixels()`; export confirmation captures `editor.exportableSnapshot()` once and reuses it for filename + export + analytics. |
| `src/lib/canvas/fake-drawing-ops.ts` | Added `createFakeDocument(width, height): FakeDocument` for tool-authoring tests — in-memory single-layer document stub with `restoreActiveLayerCalls` for assertion. |
| `src/lib/canvas/{tab-state,editor-controller,workspace}.svelte.test.ts`, `tool-runner.svelte.test.ts`, `stroke-engine.test.ts`, `{shape,one-shot,continuous,custom}-tool.test.ts`, `session.test.ts` | Migrated assertions from `pixelCanvas.{width,height,pixels()}` to `document.{width,height}` / `compositeBuffer.pixels()` / `document.layer_pixels_at()`. Deleted `TabState — document shadow` and `TabState — pixelCanvas shadow removed` describe blocks. Setup helpers accept an optional shared `Document` so seed+main test patterns can route writes through one document. |

### Key Decisions

- **Helper naming — Pattern B (`ActiveLayerPixels` axis)**: The active-layer mutator/accessor trio is named `clearActiveLayerPixels` / `activeLayerPixels` / `restoreActiveLayerPixels` rather than the `Document…ActiveLayer` series (the previous `clearDocumentActiveLayer` was renamed in this PR). All three pivot on the same noun phrase, making the read/clear/restore intent legible at a glance. The query helper keeps the noun form (`activeLayerPixels(doc): Uint8Array`) rather than a `get…` prefix to read naturally at the call site.
- **Renderer interface formalized as `RenderableCanvas`**: Both `PixelCanvas` (single-buffer) and `TabState.compositeBuffer` (per-frame document composite) satisfy the structural shape `{width, height, pixels()}`. Exporting the interface lets the renderer depend on it explicitly instead of duck-typing inside `renderer.ts`.
- **Composite is unmemoized for now**: `compositeBuffer.pixels()` calls `document.composite()` each invocation. The renderer triggers once per `renderVersion` bump, so allocation is bounded by user-perceived strokes. Caching is deferred until measurement justifies it (per M3 scope note in the issue body).
- **`pixelCanvas` prop name on `PixelCanvasView` retained**: Renaming the prop and the component itself would ripple through call sites and is unrelated to the render-path switch. Left as a follow-up cosmetic cleanup.

### Notes

- **Persistence still on V2 — out of scope for 102**: `tab-state.toSnapshot()` continues to read `document.composite()` (single buffer) and `WorkspaceRecord` round-trips remain on V2 schema. The observable consequence is that a refresh after adding a second layer collapses the multi-layer document back to one layer (issue 103 wires V3 persistence end-to-end).
- **`PixelCanvas` mirror still exists at runtime** as part of the strangler — tools no longer write to it (writes go only through `createDocumentDrawingOps`), but the type and helpers (`createDrawingOps`, `teeDrawingOps`) remain available because some test fixtures still pass a `PixelCanvas` for seeding. 103 will revisit fixture shape.
- All 883 Vitest cases pass and 8/8 Pixel Perfect e2e tests pass against the composite path. `svelte-check` reports 0 errors / 0 warnings.
