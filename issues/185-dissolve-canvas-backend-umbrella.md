---
title: Dissolve the CanvasBackend umbrella; editor-session imports the wasm adapters directly
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/canvas-backend.ts` | Deleted — the `CanvasBackend` interface is gone. |
| `src/lib/canvas/wasm-backend.ts` | Removed the `wasmBackend` aggregate object and its `CanvasBackend` import; the four adapters remain individually exported. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Dropped the `backend` dep; direct-imports `viewportOps`/`canvasFactory` alongside the existing `wasm-backend` imports. |
| `src/lib/canvas/editor-session/workspace.svelte.ts` | Dropped the `backend` dep and stopped threading it into `TabState`; doc comments updated. |
| `src/lib/canvas/editor-session/create-editor-controller.ts`, `src/lib/session/session.ts`, `src/routes/editor/+page.svelte` | Stopped threading `backend` through the session construction paths. |
| 5 test files (tab-state, workspace, editor-controller, session, session-persistence) | Dropped `backend: wasmBackend` injection; tab-state test switched its two `wasmBackend.viewportOps` reads to the directly-imported `viewportOps`. |

### Key Decisions

- The four adapter names match the current code (`createDocumentHistory`, not the issue's older `createHistoryManager` wording, which was renamed by #277). No behavior or rename beyond removing the umbrella.

### Notes

- The actual code had a 4-member umbrella (`canvasFactory`, `canvasConstraints`, `viewportOps`, `createDocumentHistory`) — #183 had already dropped the dead `createDrawingOps`, as the blocker intended.
- The meaningful injection seams are preserved: `TabViewport` still takes a `ViewportOps`, and `DocumentChangeJournal` still takes an injected `createDocumentHistory` (with a fake in its test). Only the hollow umbrella was removed.
- Web-only — no `CONTEXT.md`, ADR, or `platform-status.md` change. Verified green: unit 1459, e2e 100 (chromium), `bun run check` 0/0.
