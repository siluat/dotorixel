---
title: Color picker loupe
status: done
created: 2026-04-16
---

## Problem Statement

DOTORIXEL users sampling a color from canvas pixels lack pixel-level precision feedback. Two sampling paths exist today — Eyedropper tool (mouse) and 400ms long-press (touch) — and both share the same pain:

- The mouse cursor's hotspot is hard to align with a single pixel at low and medium zoom; the cursor shape itself partially occludes the target.
- On touch devices, the user's finger fully covers the area being sampled, making pixel selection nearly blind. The 400ms long-press lands "wherever the finger happens to be" rather than where the user can see.
- Eyedropper today is a one-shot click → pick → done. There is no opportunity to nudge to the correct pixel after seeing the result; users must release, evaluate, and re-click.

These limitations especially hurt during pixel-art-specific workflows like reusing a single pixel's color from a complex anti-aliased shape, or distinguishing between adjacent same-hue but different-shade pixels.

## Solution

A **floating loupe overlay** appears whenever the user is in an active color-sampling session: while the Eyedropper tool is held down (mouse) or during a long-press (touch). The loupe magnifies a 9×9 pixel grid around the pointer, highlights the center target pixel, and displays the hex value of the color that would commit if the user released.

The interaction model shifts from "one-shot click" to **press → drag with live feedback → release commits**:

- Pressing starts a sampling session — loupe appears, FG/BG swatch updates to the live preview color.
- Moving the pointer (or finger) updates the loupe and the preview.
- Releasing commits the final centered pixel's color to FG (left) or BG (right).
- Releasing on a transparent or out-of-canvas pixel commits nothing (consistent with current Eyedropper behavior).

Both entry points (Eyedropper tool press and long-press) share a single sampling session controller, so user-visible behavior is identical regardless of how the session was triggered.

## Key Scenarios

1. The user activates the Eyedropper tool and presses the mouse button on a canvas pixel → the loupe appears offset to the upper-right of the cursor, showing a 9×9 grid with the pressed pixel at the center, and the FG swatch updates to that pixel's color.
2. The user holds the mouse button and moves the cursor → the loupe follows, the grid contents shift accordingly, and the FG swatch updates live to whatever pixel is currently centered.
3. The user releases the mouse button → the FG color commits to the final centered pixel's color, the loupe disappears, and the color is added to recent colors.
4. The user right-clicks (instead of left) → the same flow updates the BG swatch instead of the FG.
5. The user long-presses on a touch device for 400ms with any tool active → the loupe appears offset above the finger, the FG swatch updates live, and a sampling session begins.
6. The user drags their finger after long-press fires → the loupe and FG swatch update; releasing commits the final color.
7. The pointer approaches a viewport edge such that the loupe would be clipped → the loupe flips to a different quadrant relative to the pointer (up→down, right→left as needed) so it remains fully visible.
8. The center pixel is at the canvas corner (e.g., (0, 0)) → grid cells corresponding to coordinates outside the canvas render with a hatched pattern, distinguishing them from transparent pixels.
9. The user drags over a transparent pixel (alpha = 0) → the corresponding grid cells (and the center cell when over transparent) render as a checkerboard pattern; the FG swatch does not change while the center is transparent.
10. The user releases on a transparent pixel → no commit happens; the FG retains its color from before the session.
11. The user drags into a transparent area then back to an opaque pixel before releasing → the FG swatch updates again, and committing on the opaque pixel works normally.
12. The user is at very high canvas zoom (e.g., 1600%) where each canvas pixel already covers many screen pixels → the loupe still appears (no zoom-based suppression in v1).
13. The user activates a non-Eyedropper drawing tool and clicks → no loupe appears; only Eyedropper-tool press and long-press trigger the loupe.

## Implementation Decisions

### Scope

- Web shell only for v1. Apple shell does not yet have an Eyedropper tool implemented; porting Eyedropper to Apple is out of scope and tracked separately.
- The loupe operates on the editing canvas only. Reference image sampling (Milestone 3, issues 060/061) will integrate later via the same `sampleGrid` abstraction; no v1 changes required for it.

### Interaction Model

- Eyedropper transitions from `OneShotTool` to a new tool kind (`liveSample`).
- Eyedropper press (left = FG, right = BG) and 400ms long-press both open a unified sampling session.
- Live preview: FG (or BG) updates continuously during drag; final commit happens on release.
- Releases over transparent or out-of-canvas pixels commit nothing — this matches the current `eyedropper-tool.ts` policy and avoids a behavior break.
- ESC-to-cancel and touch-cancel gestures are out of scope for v1.
- During long-press, the active tool is not changed; the sampling session runs in parallel and the active tool resumes after release.

### Modules — New

- **`sample-grid`** — pure function returning `(RGBA | null)[]` for an N×N grid centered on a target pixel. `null` denotes out-of-canvas; transparent pixels return RGBA with `a = 0`. No framework dependencies. Designed for future reuse with reference images and a potential Rust port.
- **`loupe-position`** — pure function computing the loupe's screen position from pointer location, viewport size, loupe dimensions, and per-input-source offsets (mouse vs touch). Returns position plus chosen quadrant. Handles automatic quadrant flip on edge proximity.
- **`sampling-session`** — stateful controller (Svelte rune-backed) shared by both entry points. Owns `isActive`, current pointer screen position, target canvas pixel, last valid color, and commit target (FG vs BG). Public surface: `start`, `update`, `commit`, `cancel`. Single source of truth for whether the loupe is visible.
- **`Loupe.svelte`** — overlay component reading from `sampling-session`. Renders the 9×9 grid (DOM via CSS Grid is sufficient at 81 cells; switch to Canvas only if profiling demands it), the center-cell highlight, hatched cells for `null`, checkerboard cells for transparent, and a hex value chip below the grid. Uses `loupe-position` to position itself absolutely within the editor viewport.

### Modules — Modified

- **`draw-tool.ts`** — add a new `LiveSampleTool` kind to the `DrawTool` union.
- **`eyedropper-tool.ts`** — refactor from `OneShotTool` to the new `LiveSampleTool` kind. The `addRecentColor` effect fires once on commit, not on every drag step.
- **`tool-runner.svelte.ts`** — add a `liveSampleLifecycle` factory in the same shape as the existing four lifecycles, delegating to the sampling session.
- **`canvas-interaction.svelte.ts`** — adapt long-press to invoke `samplingSession.start` and follow up with `update` on subsequent pointer moves and `commit` on release, replacing the current direct `handleLongPress` call.
- Editor state (or equivalent owner of session-scoped controllers) — instantiates and owns the single `samplingSession` instance, makes it accessible to both `tool-runner` and `canvas-interaction`.

### Visual Design — Deferred to Design Sub-Issue

The following are **principles** here; exact visual values are owned by the design sub-issue (planned `.pen` spec to be created when this PRD is decomposed):

- Grid size: initial candidate 9×9, to be validated visually; smaller (7×7) is acceptable if it materially improves placement at typical zoom levels.
- Loupe shape: rounded rectangle.
- Position offsets: mouse offset is small (cursor is small); touch offset is significantly larger (finger occludes more area). Exact pixel values determined in design.
- Center cell highlight: thick contrasting border, not a crosshair (a crosshair occludes the very pixel being sampled).
- Out-of-canvas cell pattern: hatched (visually distinct from transparent).
- Transparent pixel pattern: checkerboard (consistent with how transparency is conventionally signaled in pixel-art editors).
- Hex value chip: positioned below the grid; typography drawn from existing design tokens.
- Quadrant flip animation: presence/absence determined in design; default to instant repositioning unless flicker is observed.
- All colors and dimensions derived from existing design tokens where possible; new tokens introduced only with cross-component justification (per CLAUDE.md "Make values self-documenting").

### Core Placement

- All new code is TypeScript in the web shell. No Rust additions in v1.
- The two pure-function modules (`sample-grid`, `loupe-position`) are deliberately framework-independent so they can later be ported to the Rust core if cross-shell loupe parity becomes a goal. Per CLAUDE.md Core Placement criteria, current single-shell scope and binding overhead make TypeScript the correct placement for now.

### Performance

- 9×9 grid = 81 `get_pixel` calls per pointer move. Acceptable: `get_pixel` is not on the hot drawing path and sampling sessions are short-lived (typically < 2 seconds). No throttling planned for v1; profile if drag latency complaints emerge.
- DOM-based grid rendering (81 elements) is well within Svelte/CSS performance bounds; switch to Canvas2D only if profiling shows otherwise.

### Edge Case Behavior Summary

| Situation | Loupe display | FG/BG preview | Release behavior |
|---|---|---|---|
| Pointer over opaque pixel | Cell shows pixel color | Updates to pixel color | Commits |
| Pointer over transparent pixel | Cell shows checkerboard | Unchanged from last valid | No commit |
| Center cell out of canvas | Cell shows hatched pattern | Unchanged from last valid | No commit |
| Mixed grid (some cells out of canvas) | Each cell rendered per its state; center policy decides preview/commit | — | — |
| Loupe would overflow viewport | Flips to opposite quadrant | — | — |
| Canvas zoomed ≥ 800% | Loupe still appears (v1) | — | — |

## Testing Decisions

### Principles

- Test external behavior, not implementation details. For pure functions, this is input → output. For the session controller, this is observable effects on a fake host after a sequence of method calls. For the component, this is rendered DOM matching session state.
- Prefer table-driven tests for combinatorial coverage (e.g., `loupe-position` across 4 quadrants × 2 input sources × edge proximity cases).
- No internal-state assertions; assertions read only public method returns or emitted effects.

### Modules to Test

- **`sample-grid`** — Vitest unit tests. Cover: full opaque grid, center at canvas corner (multiple `null` cells), center over transparent (correct alpha-zero RGBA), mixed transparent + opaque + out-of-canvas grids.
- **`loupe-position`** — Vitest unit tests. Table-driven across viewport positions × input source × loupe dimensions; assert position and quadrant.
- **`sampling-session`** — Vitest unit tests with a fake canvas + fake host. Cover: `start → update → commit` happy path (FG and BG), commit over transparent (no FG change), commit out of canvas (no FG change), drag from opaque → transparent → opaque before commit, `cancel` interface contract (even if unused in v1).
- **`Loupe.svelte`** — `@testing-library/svelte` component tests. Minimum two: (1) renders 9×9 grid with correct cell types when given a mixed sample (opaque, transparent, null), (2) renders hex chip with the center-cell color and hides the chip when center is null/transparent.
- **`liveSampleLifecycle` in `tool-runner.svelte.ts`** — Vitest unit test mirroring existing lifecycle test style; confirm correct effects emitted on commit.
- **`eyedropper-tool.ts`** — migrate existing tests (if any) from `OneShotTool` shape to `LiveSampleTool` shape; preserve the transparent-pixel-skip assertion.
- **`canvas-interaction.svelte.ts`** — update existing long-press tests to assert delegation to `samplingSession` rather than direct `handleLongPress` call.

### E2E (Playwright)

Three scenarios in `e2e/`:

1. Eyedropper tool + mouse drag → loupe visible during drag, FG swatch updates live, releases on opaque pixel commits the color.
2. Long-press on touch (simulated) → loupe visible during gesture, FG swatch updates live, release commits.
3. Release over transparent pixel → no FG change after release.

### Prior Art

- Vitest unit-test style follows existing modules under `src/lib/canvas/` (color, viewport, etc.).
- Svelte component tests follow existing patterns in `src/lib/canvas/` (e.g., `PixelCanvasView`).
- Playwright tests follow existing scenarios in `e2e/`.

## Rejected Alternatives

- **Hover-only loupe (no click required)** — Rejected: the loupe appearing on every cursor entry into the canvas is visually noisy and disrupts non-sampling workflows. The agreed trigger is explicit user intent (press / long-press).
- **Touch-only loupe, no mouse loupe** — Rejected: mouse cursor hotspot is also occluding at low zooms; the pain exists on both inputs.
- **Modifier-key activation (Alt = temporary eyedropper + loupe)** — Rejected for v1: introduces a separate keymapping decision and conflicts with potential future modifier roles. Reconsider if Aseprite-style keymap parity becomes a goal.
- **One-shot click + hover loupe** — Rejected: loses the core value of nudging-to-the-correct-pixel after seeing the loupe.
- **Crosshair on center cell** — Rejected: occludes the very pixel being sampled, undermining the loupe's purpose. Replaced with a thick contrasting border around the cell.
- **Edge-clamp out-of-canvas cells** (repeat the nearest pixel color) — Rejected: false impression that "the wall extends" misleads sampling. Hatched pattern is honest about absence.
- **Conflate transparent and out-of-canvas as one render** — Rejected: makes debugging and understanding ambiguous. They are semantically different states.
- **Auto-suppress loupe at high zoom (e.g., ≥ 800%)** — Rejected for v1: introduces a learning cliff ("why did the loupe disappear?"). Reconsider after user feedback.
- **Cross-platform v1 (web + Apple together)** — Rejected: requires porting Eyedropper to Apple Swift first, doubling v1 scope. Web-first lets us validate UX before committing to two implementations.
- **Loupe pixel data sourced from `getImageData` on the rendered canvas** — Rejected: source from the Rust core's `get_pixel` instead, ensuring true pixel data without rendering pipeline coupling.
- **Separate "preview" FG/BG state vs. live-updating actual state** — Rejected as unnecessary complexity: the actual FG/BG state updates during drag, since no other tool action is possible during a sampling session anyway.
- **ESC-to-cancel during a sampling session** — Deferred (not strictly rejected): adds keyboard event routing and tool state machine work; v2 candidate after observing real usage.
- **User-configurable grid size, magnification, or shape** — Deferred: yagni for v1. Initial fixed values; reconsider after feedback.
- **FG/BG comparison swatches inside the loupe** (showing "current FG" alongside "would-be FG") — Rejected for v1: useful but adds visual complexity. Reconsider after observing actual sampling patterns.

## Out of Scope

- Apple shell implementation. Tracked separately; will follow when Apple Eyedropper port lands.
- Reference image as a loupe trigger surface. Will integrate later through the same `sampleGrid` abstraction once issues 060/061 land.
- ESC-to-cancel and touch-cancel gestures.
- User-configurable grid size, magnification, or shape.
- FG/BG comparison swatches inside the loupe.
- Loupe display during normal drawing strokes (pencil, brush, etc.).
- Modifier-key activation of a temporary eyedropper from any tool.
- Auto-suppression of the loupe at high canvas zoom levels.
- A dedicated `.pen` design specification — this PRD describes architecture and behavior; the visual specification belongs to a sibling design sub-issue created when this PRD is decomposed.

## Further Notes

- The `sampling-session` controller is the **single source of truth** for whether the loupe is visible. Both the Eyedropper tool runner path and the long-press path delegate to it. This unification is the architectural lever that prevents the two interaction paths from diverging in subtle ways over time.
- The pure-function modules (`sample-grid`, `loupe-position`) are deliberately framework-independent. If cross-shell parity becomes a goal, both are candidates for Rust port without API redesign.
- When this PRD is decomposed via `/prd-to-issues`, recommended sub-issue ordering:
  1. Design spec (`.pen`) for visual values (grid cell size, chrome, offsets, patterns, typography, animations).
  2. `sample-grid` module + tests.
  3. `loupe-position` module + tests.
  4. `sampling-session` controller + tests.
  5. `eyedropper-tool` refactor + new `liveSample` tool kind in `draw-tool.ts` and `tool-runner.svelte.ts`.
  6. `Loupe.svelte` component + tests, wired to the session.
  7. `canvas-interaction.svelte.ts` long-press integration.
  8. E2E scenarios.
- Related work: issue 053 (Floating reference image windows) introduces a `sampler(Blob, x, y) → RGBA` abstraction in Milestone 3. The loupe's `sample-grid` and that `sampler` are designed to compose cleanly when the loupe extends to reference images later.
