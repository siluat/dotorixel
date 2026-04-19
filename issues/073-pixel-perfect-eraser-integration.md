---
title: Pixel Perfect — Eraser integration
status: done
created: 2026-04-18
parent: 069-pixel-perfect-drawing.md
---

## What to build

Extend the Eraser tool to run through the PP filter. With Pixel Perfect ON, an eraser drag cleanly handles the L-corner middle along the erased path — no "half-erased pixel" artifact is left behind. Symmetric treatment to Pencil.

See the parent PRD's "Web Shell: Tool Runner integration" section and Scenario 3.

## Acceptance criteria

- eraser-tool switches from a per-segment `for` loop to `applyStroke`
- tool-runner applies the PP wrapper on eraser `drawStart` as well (same branch as pencil; still hardcoded ON)
- the pre-paint cache records the eraser's "color before erasing" and, on revert, restores that color (i.e., a pixel reverted by the eraser returns to its "un-erased original" state)
- E2E 1 case (Playwright): with a pre-painted region, an Eraser L-shape drag → the L-corner middle pixel stays in its pre-erase state (the L-bump artifact does not remain)
- `cargo test`, Vitest, and Playwright all pass

## Blocked by

- [072 — Pixel Perfect Pencil integration](072-pixel-perfect-pencil-integration.md)

## Scenarios addressed

- Scenario 3 (Eraser PP — clean L path)

## Results

| File | Description |
|------|-------------|
| `e2e/editor/pixel-perfect.test.ts` | Added a regression-defense case for eraser L-shape drag — three discrete pencil clicks pre-paint the L path → Eraser L-drag → endpoints get erased, L-corner middle is restored to its pre-paint color |

### Key Decisions

- **Pre-paint with discrete clicks, not a drag**: pencil itself also runs through the PP wrapper, so pre-painting with a pencil L-drag would revert the corner pixel and leave nothing to erase at that spot. Three single clicks produce three separate 1-pixel strokes that don't trip the L-corner rule, so all three pixels enter the erase phase opaque.
- **Test asserts "middle preserved", not "middle erased"**: the PP wrapper's Revert restores the cached pre-stroke color via `setPixel`, which is tool-kind agnostic. For eraser, that means a reverted pixel returns to its pre-erase (painted) color — the erase is effectively cancelled at the L-corner middle so the bump artifact doesn't persist in the erased region. The test verifies exactly this.

### Notes

- **No production code changes**: thanks to #156 wiring pencil and eraser through the shared `createFreehandTool` factory and the tool-runner's `activeTool === 'pencil' || 'eraser'` branch for the PP wrapper, all implementation acceptance criteria of 073 were already satisfied. This slice adds only the E2E regression defense for the eraser's symmetric behavior.
- **Apple shell remains unintegrated**: the Rust filter is already exposed via UniFFI, but Apple-side eraser integration stays deferred to a separate task after StatusBar (019) — consistent with the parent PRD's plan.
