---
title: Remove dead canvas-mode DrawingOps residue and make Document DrawingOps the sole factory
status: done
created: 2026-06-14
---

## Context

From an architecture-depth review of the web↔core drawing seam. The web shell migrated to the Document model (per ADR `web-document-layer-apple-preserved`), and the strangler migration left a dead pre-Document drawing path behind. The review initially looked like "two parallel `DrawingOps` adapters to unify," but the code shows one path is live and the other is dead — so the work is deletion, not a new abstraction.

Verified by call-site search:

- `createDocumentDrawingOps` is the **only live** `DrawingOps` factory — the stroke engine builds its base ops from it.
- The canvas-mode `createDrawingOps` (over `WasmPixelCanvas`) has **zero invocations**; it survives only as a `CanvasBackend` interface slot, a `wasmBackend` object member, and a stale doc comment.
- `teeDrawingOps` (the old write-to-both migration bridge) has **zero references**.
- `resolveWasmCanvas` is used only by the dead canvas-mode factory.

This is a web-only TypeScript cleanup. The core `PixelCanvas` (preserved for the Apple shell by the ADR) and `WasmPixelCanvas` itself are untouched — `WasmPixelCanvas` is still used by the canvas factory and export path.

## What to build

Delete the dead canvas-mode drawing path and promote the Document-backed factory to the single `DrawingOps` factory, so the seam exposes exactly one live drawing path.

- Remove the canvas-mode `createDrawingOps`, `teeDrawingOps`, and the now-orphaned `resolveWasmCanvas`.
- Remove the `createDrawingOps` member from the `CanvasBackend` umbrella interface and the `wasmBackend` object (no consumer calls it). Leave the broader question of whether the umbrella itself earns its keep to a separate review item.
- Rename `createDocumentDrawingOps` to `createDrawingOps` (it is now the only `DrawingOps` factory) and update the stroke engine import and the `DrawingOps` interface doc comment, which currently references the removed canvas-getter form.
- Remove the WASM imports that only the deleted canvas-mode factory used (`apply_tool`, `wasm_flood_fill`, `wasm_flood_fill_bounded`); keep `wasm_interpolate_pixels` / `wasm_rectangle_outline` / `wasm_ellipse_outline`, which the surviving factory still uses.

## Acceptance criteria

- The canvas-mode `createDrawingOps`, `teeDrawingOps`, and `resolveWasmCanvas` no longer exist; the `CanvasBackend` interface and `wasmBackend` object no longer carry a `createDrawingOps` member.
- The surviving Document-backed factory is named `createDrawingOps` and is the single `DrawingOps` factory; the stroke engine and the `DrawingOps` doc comment refer to it correctly.
- No unused WASM imports remain in the adapter; `WasmPixelCanvas` is retained for the canvas factory and export path.
- The `DrawingOps` interface, `createMarqueeClippedOps`, the pixel-perfect decorator, and the test fake (`createFakeDrawingOps`) are unchanged.
- Type-check passes and drawing behaves identically end-to-end (pencil/eraser/line/rectangle/ellipse, flood fill, marquee clipping, pixel-perfect); the existing stroke-engine and tool test suites pass with no test depending on the removed symbols.
- Web-only: no Rust core, binding, persistence-format, `CONTEXT.md`, or ADR changes.

## Blocked by

None - can start immediately.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/wasm-backend.ts` | Deleted canvas-mode `createDrawingOps`, `teeDrawingOps`, `resolveWasmCanvas`; dropped the now-unused `apply_tool`/`wasm_flood_fill`/`wasm_flood_fill_bounded` WASM imports and the orphaned `PixelCanvas` type import; renamed `createDocumentDrawingOps` → `createDrawingOps` (now the sole factory) and removed the `createDrawingOps` member from the `wasmBackend` object |
| `src/lib/canvas/editor-session/canvas-backend.ts` | Removed the `createDrawingOps` member from the `CanvasBackend` interface and its now-unused `PixelCanvas`/`DrawingOps` imports |
| `src/lib/canvas/stroke-engine.ts` | Updated the import and call site to the renamed `createDrawingOps` |
| `src/lib/canvas/drawing-ops.ts` | Reworded the `DrawingOps` interface doc comment to the document-getter form (no canvas-getter reference) |

### Key Decisions

- The work was deletion, not unification: the canvas-mode path had zero invocations, so promoting the live Document-backed factory to the single `createDrawingOps` left exactly one drawing path at the seam.
- Left the broader "does the `CanvasBackend` umbrella earn its keep" question to issue 185 (now unblocked), per the issue's stated scope.

### Notes

- Web-only; no Rust core, binding, persistence-format, `CONTEXT.md`, or ADR changes. `WasmPixelCanvas` retained for the canvas factory and export path.
- Verified at every level: type-check (0 errors), vitest 481 passed, full Playwright e2e 100 passed (drawing/pixel-perfect/selection/history/export all green).
