---
title: Dissolve the CanvasBackend umbrella; editor-session imports the wasm adapters directly
status: ready-for-agent
created: 2026-06-14
---

## Context

From an architecture-depth review of the web↔core seam. `CanvasBackend` is an umbrella port injected into the editor-session state layers (`TabState`, `Workspace`) so they "inject a single backend instead of wiring each sub-port individually." On inspection it is a one-adapter hypothetical seam whose stated DI rationale is defeated:

- There is one production adapter (`wasmBackend`); tests inject the same one — no fake exists, so nothing varies across the seam.
- `TabState` already hard-imports six functions from `wasm-backend` directly (`clearActiveLayerPixels`, `createHistoryManager`, `fitReferencePlacementToCanvas`, `marqueeRegionFromDrag`, `resizeDocumentWithAnchor`, `singleLayerDocument`), and `Workspace` direct-imports more (`documentFromLayerSource`, `singleLayerDocument`). So the modules are already statically coupled to `wasm-backend`; the `backend` injection does not decouple them.
- Through the injected `backend`, `TabState` uses only `viewportOps` and `canvasFactory`; `createHistoryManager` is a backend member yet `TabState` direct-imports it, and `canvasConstraints` is consumed only by UI components that direct-import it. The umbrella is an inconsistent half-measure.

Sibling cleanup issue 183 removes the dead `createDrawingOps` member; this issue dissolves the remaining 4-member umbrella so wasm-adapter access is uniform (direct import everywhere).

## What to build

Remove the `CanvasBackend` umbrella and its injection chain; have the editor-session layers import the wasm adapters directly, matching how they already import other `wasm-backend` functions and how the UI imports the same singletons.

- Delete the `CanvasBackend` interface and the `wasmBackend` aggregate object. Keep the individual adapter exports (`viewportOps`, `canvasFactory`, `canvasConstraints`, `createHistoryManager`) as named exports for direct import.
- `TabState`: drop the `backend` constructor dependency and direct-import the two adapters it used (`viewportOps`, `canvasFactory`) alongside its existing `wasm-backend` imports.
- `Workspace`: drop the `backend` dependency and construct `TabState` without it.
- `create-editor-controller` and the session construction paths: stop threading `backend`.
- Update the editor-session / session tests that injected `backend:` to drop it.

## Acceptance criteria

- The `CanvasBackend` interface and the `wasmBackend` aggregate object no longer exist; `viewportOps` / `canvasFactory` / `canvasConstraints` / `createHistoryManager` remain individually importable.
- `TabState` and `Workspace` take no `backend` parameter; the injection is gone from `create-editor-controller` and the session construction paths.
- Editor-session behavior is unchanged — viewport operations, `exportableSnapshot`, history creation, and document construction all work as before; no new wasm coupling is introduced (both layers already imported `wasm-backend` directly).
- The tests that previously injected `backend: wasmBackend` are updated and the editor-session and session suites pass.
- Web-only: no `CONTEXT.md` or ADR change.

## Blocked by

- Issue 183 (Remove dead canvas-mode DrawingOps residue) — it removes the dead `createDrawingOps` member first, leaving a clean 4-member umbrella to dissolve and keeping the two issues' edits to `wasm-backend` and `CanvasBackend` non-overlapping.
