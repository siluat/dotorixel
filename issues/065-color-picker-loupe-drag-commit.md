---
title: Color picker loupe — drag-and-commit eyedropper + basic loupe
status: done
created: 2026-04-16
parent: 063-color-picker-loupe.md
---

## What to build

The tracer-bullet slice that establishes the loupe end-to-end. After this slice, pressing the Eyedropper tool on the canvas opens a sampling session: the loupe appears showing a 9×9 grid centered on the pressed pixel, the FG (or BG, on right-click) updates live as the cursor moves, and releasing commits the final color and adds it to recent colors. The loupe is positioned at a fixed offset from the pointer (no edge-flip yet) and renders with chrome and hex chip per the design spec. Out-of-canvas and transparent edge cases are deferred to slice 066 — for this slice, treat all sampled pixels as opaque values returned by `get_pixel`.

This slice cuts through every architectural layer: a new tool kind in `draw-tool.ts`, a new lifecycle in `tool-runner.svelte.ts`, the `eyedropper-tool.ts` refactor, the `sample-grid` pure function, the `sampling-session` controller, the `Loupe.svelte` overlay, and editor-state wiring.

See parent PRD §"Implementation Decisions" → "Modules — New" / "Modules — Modified" for module breakdown.

## Acceptance criteria

- New `LiveSampleTool` kind added to the `DrawTool` union in `draw-tool.ts`.
- New `liveSampleLifecycle` factory added to `tool-runner.svelte.ts`, mirroring the structure of the existing four lifecycles.
- `eyedropper-tool.ts` refactored from `OneShotTool` to `LiveSampleTool`; transparent-pixel-skip behavior preserved (commit no-ops on transparent center).
- `sample-grid.ts` module created — pure function returning RGBA[] for a 9×9 grid centered on a target pixel; no out-of-canvas handling in this slice (the grid clamps or returns whatever `get_pixel` returns near edges; full null handling lands in slice 066).
- `sampling-session.svelte.ts` controller created with `start`, `update`, `commit`, `cancel` methods; owns `isActive`, target pixel, last valid color, commit target (FG vs BG).
- `Loupe.svelte` component created — renders the 9×9 grid, the center cell highlight, and the hex value chip per design spec; positioned at a fixed mouse offset (no edge-flip).
- Editor state owns the single `samplingSession` instance and exposes it to `tool-runner` and `Loupe.svelte`.
- Right-click eyedropper press commits to BG instead of FG; otherwise identical flow.
- Releasing emits the existing `addRecentColor` effect (recent colors list updates).
- Non-Eyedropper drawing tools do not open a loupe on press (gating verified — only `liveSample` tool kind triggers the session).
- Vitest unit tests: `sample-grid` (basic opaque grid), `sampling-session` (start → update → commit happy path for both FG and BG).
- Vitest unit test: `liveSampleLifecycle` mirroring existing lifecycle test patterns; verify correct effects emitted on commit.
- Component test (`@testing-library/svelte`): `Loupe.svelte` renders 9×9 grid and hex chip with correct color when given a sample.
- Existing `eyedropper-tool` tests migrated from `OneShotTool` shape to `LiveSampleTool` shape.
- Playwright E2E: activate Eyedropper tool, press on a colored pixel, drag to another colored pixel, release → FG matches the final pixel's color and the loupe was visible during the drag.

## Blocked by

- [064 — design spec](064-color-picker-loupe-design.md)

## Scenarios addressed

- Scenario 1
- Scenario 2
- Scenario 3
- Scenario 4
- Scenario 12 (default behavior — loupe appears regardless of canvas zoom; no suppression code needed)
- Scenario 13 (default behavior — only `liveSample` tool kind opens the session)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/draw-tool.ts` | Added `LiveSampleTool` kind to the `DrawTool` discriminated union. |
| `src/lib/canvas/sample-grid.ts` + `.test.ts` | New pure function returning an N×N row-major flat array of RGBA values around a target pixel; clamps to canvas bounds at edges. |
| `src/lib/canvas/sampling-session.svelte.ts` + `.test.ts` | New session controller with `start`/`update`/`commit`/`cancel`; owns `isActive`/`grid`/`centerColor`/`targetPixel`/`commitTarget`. Shared `reset()` helper called by both `commit()` and `cancel()` so `isActive` always returns to false after a session ends. |
| `src/lib/canvas/tool-runner.svelte.ts` + `.test.ts` | Added `liveSampleLifecycle` factory mirroring existing four lifecycles; deferred `start` until first `draw` so the session gets its initial target pixel. |
| `src/lib/canvas/tools/eyedropper-tool.ts` | Converted from `OneShotTool` to `LiveSampleTool`; prior `applyTo` transparent-skip logic migrated into `sampling-session.commit()`. |
| `src/lib/canvas/editor-state.svelte.ts` | Exposes `samplingSession` on the editor facade for `tool-runner` and `PixelCanvasView`. |
| `src/lib/canvas/PixelCanvasView.svelte` | Renders the Loupe overlay when `samplingSession.isActive`; tracks viewport-relative `screenPointer` on every pointer event. |
| `src/lib/ui-editor/Loupe.svelte` + `.svelte.test.ts` | New overlay component. Plain props (`grid`/`centerColor`/`screenPointer`); 9×9 grid with gap-as-gridline technique; center cell highlighted by a white-inside + black-outside double ring; hex chip shows uppercase hex (or em-dash for transparent / out-of-canvas). `--cell-size` and `--pointer-offset` component-scoped tokens. |
| `src/routes/editor/+page.svelte` | Passes `samplingSession={editor.samplingSession}` into both docked-layout and tabs-layout `<PixelCanvasView>` instances. |
| `e2e/editor/drawing.test.ts` | Added Playwright test: eyedropper drag from pixel A to pixel B commits the color at the drag endpoint (B), not the starting pixel (A); loupe visible mid-drag, torn down on release. |
| `.claude/launch.json` | Added `dev-preview` config on port 5174 so the Claude Preview MCP can run a second Vite instance without conflicting with the developer's own `bun run dev`. |

### Key Decisions

- **`LiveSampleTool` as a new tool kind** rather than overloading `OneShotTool` — keeps the discriminated union exhaustive and lets `tool-runner`'s `switch(tool.kind)` keep serving as a compile-time completeness check.
- **`Loupe.svelte` takes plain props (not the session object)** — makes component tests trivial (no session mock), keeps the overlay reusable if a different source ever feeds it a 9×9 grid.
- **`sampling-session` stays in the web shell, not Rust core** — single-shell use today and `get_pixel` is already called N² times, so FFI overhead would exceed the dedup benefit. Revisit when the Apple shell needs its own loupe.
- **`commit()` resets via a shared `reset()` helper** (added in-slice after the first user-reported bug). Loupe visibility depends only on `samplingSession.isActive`; both success and no-op commit paths must clear it to prevent a stale grid resurfacing on the next idle pointer move.
- **`Loupe` derives `centerIndex` from `grid.length`** rather than importing a shared constant — removes the 9×9 assumption from the component so a future configurable grid size doesn't need a coordinated change.

### Notes

- **Loupe can clip at viewport edges** in this slice (fixed upper-right quadrant offset). Quadrant-flip positioning is [issue 067](067-color-picker-loupe-positioning.md)'s responsibility.
- **Transparent and out-of-canvas cells render with the surface tone** — dedicated checkerboard/hatch styling is deferred to [issue 066](066-color-picker-loupe-edge-rendering.md).
- **Long-press touch entry** is deferred to [issue 068](068-color-picker-loupe-long-press.md); the `sampling-session` controller was already designed to be shared between the two entry points.
- **Parent PRD ([063](063-color-picker-loupe.md)) remains open** — sibling slices 066/067/068 still to complete.
