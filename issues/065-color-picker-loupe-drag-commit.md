---
title: Color picker loupe — drag-and-commit eyedropper + basic loupe
status: open
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
