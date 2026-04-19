---
title: Pixel Perfect drawing — remove double-pixels at stroke joints
status: done
created: 2026-04-18
---

## Problem Statement

When drawing diagonal or curved freehand strokes, Bresenham interpolation between adjacent samples leaves stray pixels at the joint points of the staircase corners. When three consecutive pixels form an L-corner, the middle pixel is that stray. This "double-pixel" breaks the clean staircase aesthetic typical of pixel art, forcing users to manually erase them one by one after drawing a stroke to tidy up the line.

In a dedicated pixel art editor, this is a baseline expectation. Most modern pixel art tools — Aseprite, Pixquare, Pixelorama, and others — solve this problem with a feature called "Pixel Perfect" or an equivalent name. DOTORIXEL currently lacks this feature, so users must manually clean up every freehand stroke.

## Solution

When drawing freehand strokes with the Pencil and Eraser tools, automatically remove the middle pixel that forms an L-corner along the stroke path.

The default is ON. Users can toggle it on/off via a toggle in the StatusBar, and the setting persists across sessions. When Pixel Perfect is OFF, the current Bresenham output is preserved as-is.

Filtering happens live during stroke progression. That is, the L-corner middle pixel is first painted and then, as soon as the next pixel confirms the L-corner condition, it is immediately reverted to the color it had just before the stroke started. This is the same UX pattern Aseprite uses.

## Key Scenarios

1. With PP ON, the user draws a gentle diagonal curve with the Pencil → the finished canvas has no middle pixel at L-corner vertices.
2. With PP OFF, the user draws the same curve → all Bresenham output pixels are preserved (including L-corner middles).
3. With PP ON, the user erases along a diagonal path with the Eraser → the erased path also leaves no L-corner middle (no half-erased pixels).
4. With PP ON, the user draws a horizontal/vertical straight line → all pixels are preserved (L-corner condition not met).
5. The user taps once to place a single pixel → a single pixel is placed, no filter action.
6. The user draws a stroke with PP ON and then undoes → the canvas returns to its pre-stroke state (a single undo entry, identical to no-PP behavior).
7. The user clicks the StatusBar PP toggle to change its state → the new state applies starting from the next stroke.
8. The user changes the PP toggle mid-stroke → the in-progress stroke continues with the value it started with; the change takes effect from the next stroke.
9. The user reopens the app → the PP toggle state is restored from the previous session.
10. The user draws a self-intersecting path where the same coordinate is visited twice → the pre-paint color recorded on the first visit is preserved; if a subsequent L-corner judgment occurs, that coordinate is reverted to the pre-paint color (industry-standard limitation — the stroke's own prior ink at that coordinate may be lost in this case).
11. The user uses a shape tool (Line / Rectangle / Ellipse, etc.) → even with PP ON, the filter is not applied; the Bresenham output is rendered as-is.
12. The user draws with any input device (Apple Pencil / touch / mouse) → PP behavior is identical.

## Implementation Decisions

### Architectural principles

- **Timing**: Live (Aseprite-style). Each incoming pixel is committed to canvas immediately; when a 3-point window confirms an L-corner, the middle pixel is reverted to its pre-paint color.
- **Logic placement**: The L-corner judgment algorithm lives in the Rust core as a pure function. Stroke state and the pre-paint cache live in each shell (TS / Swift). Per CLAUDE.md's Core Placement — "logic with low complexity but where cross-platform consistency matters belongs in the core".
- **Deep module identification**: The Rust filter function and the TS PP wrapper are each deep modules. Their interfaces are simple (coordinate in/out, DrawingOps contract), while state, cache, and judgment are concentrated inside. Robust against replacement / refactor.

### Rust Core module

- **New pure function** `pixel_perfect_filter(points, prev_tail) -> (actions, new_tail)`
  - Input: Bresenham output coordinates for one `pointermove` + optional 2-point tail carried from the previous segment
  - Output: list of `Action`s (`Paint(x,y)` or `Revert(x,y)`) + new 2-point tail for the next call
- **Internal helper** `is_l_corner(prev, cur, next) -> bool` — 3-window L-corner judgment rule
  - Condition: prev and cur share either x or y; next and cur share either x or y; and prev and next differ in both x and y
- No dependencies. Pure integer arithmetic. Automatically exposed via WASM + UniFFI.

### Web Shell: DrawingOps extension

- **Contract extension**: Add a batch method `applyStroke(pixels, kind, color)` to the existing `DrawingOps` interface. The default implementation is a simple loop + `applyTool`.
- **Low-level pixel writes**: Since Revert actions need to restore pixels to arbitrary colors, a tool-kind-agnostic low-level write method (`setPixel(x, y, color)`, etc.) is required on `DrawingOps`. If absent, it is introduced within this PRD's scope.
- **pencil / eraser tool change**: Replace the segment `for` loop with a single `ops.applyStroke(pixels, kind, color)` call. A small refactor that's valid independent of PP.

### Web Shell: Pixel Perfect Wrapper

- **New factory** `createPixelPerfectOps(baseOps): DrawingOps`
  - Internal state: the current confirmed 2-point tail, and a pre-paint cache `Map<PackedCoord, Color>` (first-touch wins)
  - `applyStroke(pixels, kind, color)`: call Rust `pixel_perfect_filter` → receive the action list and execute them in order
    - `Paint(x,y)`: if not in cache, save the current canvas color to the cache, then `baseOps.applyTool`
    - `Revert(x,y)`: read the original color from the cache and restore via `baseOps.setPixel`
  - Update the tail state and pass it to the next call
  - Non-stroke calls (direct `applyTool`) are forwarded as-is

### Web Shell: Tool Runner integration

- At `drawStart()`: if the PP option is ON and the active tool is pencil or eraser, `strokeOps = createPixelPerfectOps(ops)`; otherwise `strokeOps = ops`.
- During this stroke, the `ops` passed to the tool's `apply()` is fixed as `strokeOps`.
- At `drawEnd()`, drop `strokeOps` (GC).
- **PP value snapshot**: Toggle changes mid-stroke are ignored. The value at `drawStart` time is fixed for the entire stroke.

### Settings / Persistence

- **Editor preference**: Add a `pixelPerfect: boolean` field to the existing preference storage mechanism. Default `true`.
- Persistence: follow existing patterns (localStorage / IndexedDB / Svelte store persistence adapter — whichever matches project convention).

### UI

- **StatusBar PP toggle button**: Icon button, click to toggle ON/OFF. Current state reflected in `aria-label` and tooltip. 3 i18n strings (`en`, `ko`, `ja`).
- **Keyboard shortcut**: Out of scope for this PRD. Addressed together when the shortcut system is revamped later.

### Platform scope

- **Web gets everything**: Rust filter function + WASM bindings + DrawingOps extension + PP wrapper + tool-runner integration + StatusBar toggle + preference persistence + tests.
- **Apple is a follow-up**: The Rust filter function is automatically exposed via UniFFI and is ready. Actual integration into the Apple shell proceeds as a separate task after Phase 1 docked layout's StatusBar (issue 019) completes.

## Testing Decisions

### Testing principles

- **Test external behavior only**: 3-point window judgment results, post-stroke canvas state, user input → on-screen changes. Internal cache data-structure details or function call counts are not tested.
- **Regression defense first**: In the post-MVP phase, expanding regression-defense tests is the project's direction (CLAUDE.md "Project Stage"). This feature follows that stance.

### Rust Core unit tests (MUST)

- Table-based tests for `pixel_perfect_filter`
- Cover cases:
  - Empty input / single point / two points
  - 3-point horizontal, vertical, diagonal lines (no filtering)
  - 3-point L-corners in 8 symmetric directions (middle reverted)
  - Consecutive staircase (multiple L-corners in a row) — each middle reverted in turn
  - Segment boundary cases — correct revert when an L-corner appears at the junction with the previous call via `prev_tail`
  - Self-intersecting revisits — the same coordinate appearing twice still obeys the same rule
- `is_l_corner` 3-point truth table (when the helper is implemented as a separate function)

### Web unit tests (SHOULD)

- Baseline cache behavior of `createPixelPerfectOps` / the PP wrapper
- Cover cases:
  - Pre-paint cache stores first-touch-wins on `applyStroke` call
  - On L-corner judgment, the cached color is restored to the correct coordinate
  - Revisiting the same coordinate does not overwrite the cache
- Framework: Vitest + happy-dom. Prior art: `src/lib/wasm/wasm-tool.test.ts`.

### E2E tests (MUST)

- Playwright. File: `e2e/editor/pixel-perfect.test.ts`.
- Cover scenarios:
  - Pencil L-shape drag — no middle pixel when PP ON, middle pixel present when PP OFF (ON/OFF comparison)
  - Eraser same — optional
  - StatusBar toggle click → state changes and the next stroke reflects the new state
- Prior art: `e2e/editor/drawing.test.ts`.

### Excluded

- Storybook story (StatusBar single toggle)
- Performance benchmarks
- WASM binding unit tests (covered by Rust + E2E)

## Rejected Alternatives

### Commit-time (pointerup) batch processing

Display plain Bresenham during the stroke and re-rasterize the whole thing when the user lifts their finger. Simpler to implement, but the "dirty" stroke appearance during drag breaks the core feedback of pixel art drawing. Rejected.

### Buffer-delay approach (1px lag, no un-paint)

Instead of painting pixels immediately, buffer one and commit after the L-corner judgment. The implementation is even simpler, but it introduces a 1px lag where the cursor runs ahead of the ink when drawing slowly. The iPad + Apple Pencil environment feels this acutely, conflicting with DOTORIXEL's casual hobby tool direction. Rejected.

### Placing a stateful stroke object in the Rust core

Expose `PixelPerfectStroke` as a stateful object over WASM / UniFFI. Guarantees 100% behavioral parity, but the current Rust core is a stateless pure-function codebase, and stateful FFI objects would be the first case of lifecycle / handle management / WASM wrapping — YAGNI. Rejected.

### Independent implementation per shell (no Rust core involvement)

Since the L-corner rule is simple, TS / Swift each implement their own. Behavioral parity between the two shells would be delegated to humans, raising the risk of micro-divergence bugs that users would immediately detect. Works against the Core Placement principle. Rejected.

### Full tool API refactor (data/write split)

Redesign `ContinuousTool` as `pixelsForSegment() + writeKind`. Structurally cleaner, but over-investment for just pencil + eraser. If more tools requiring a similar pipeline emerge later, promote then. For now, adding the `DrawingOps.applyStroke` batch method is sufficient. Rejected.

### Per-tool PP toggle

Pencil and Eraser each hold independent PP state. More flexible, but the actual user mental model is holistic — "I'm drawing in PP mode". The gain is unclear relative to the UI/config complexity. If the need actually arises, migrating from a single bool to per-tool bool is simple. Rejected (for MVP).

### Reading baseline from history snapshots

The history snapshot already holds the pre-stroke state, so reuse it. However, this introduces new coupling between the tool system ↔ history system (exposing a read API). The pre-paint cache approach is self-contained and its memory footprint scales with stroke size (a few KB). Rejected.

### Shortcut only (no UI toggle)

The most minimal option. Zero discoverability makes it unsuitable for beginners (learning-aid direction). Rejected.

### OFF by default

"Minimize surprise" principle. However, the baseline expectation of a dedicated pixel art editor is for PP to be ON. Beginners should get clean strokes out of the box with no setup. Rejected.

## Out of Scope

- **Interaction with brush size > 1px**: When the brush size feature is introduced, its relationship with PP will be defined in that PRD (auto-disable / modified rules, etc.).
- **Keyboard shortcut**: Addressed together when the project shortcut system is revamped.
- **Apple shell integration and toggle UI**: A separate task after Apple StatusBar (issue 019) completes. The Rust filter function is exposed via UniFFI in this PRD and is ready.
- **Shape tool (Line / Rect / Ellipse) PP application**: Algorithmically meaningless — deterministic Bresenham / shape rasterization is already optimal.
- **Advanced handling of self-intersecting strokes**: Accept the limitation imposed by the first-touch-wins cache (industry standard).
- **Storybook stories / performance benchmarks**: Low value for this scope.
- **Advanced toggle placements (per-tool option panel, Context Bar, etc.)**: StatusBar single toggle is the MVP. Promote later when tool options proliferate.

## Further Notes

### L-corner judgment rule (reference)

For three consecutive pixels `(p_prev, p_cur, p_next)`, the middle `p_cur` is judged as an L-corner if all of the following hold:

- `p_prev` and `p_cur` share x or y (orthogonal neighbors)
- `p_next` and `p_cur` share x or y (orthogonal neighbors)
- `p_prev` and `p_next` differ in both x and y (diagonal relation)

Same rule as Aseprite's `IntertwineAsPixelPerfect`.

### References

- [Ricky Han — Pixel Art Algorithm: Pixel Perfect](https://rickyhan.com/jekyll/update/2018/11/22/pixel-art-algorithm-pixel-perfect.html)
- [Deepnight — Pixel perfect drawing](https://deepnight.net/blog/tools/pixel-perfect-drawing/)
- [Aseprite `intertwiners.h` — `IntertwineAsPixelPerfect`](https://github.com/aseprite/aseprite/blob/main/src/app/tools/intertwiners.h)
- [Aseprite `freehand_algorithm.h` — FreehandAlgorithm enum](https://github.com/aseprite/aseprite/blob/main/src/app/tools/freehand_algorithm.h)
- [Pixelorama — Drawing tools user manual](https://pixelorama.org/user_manual/drawing/)
- [Pixquare — Features](https://www.pixquare.art/)
- [Krita MR!2158 — Pixel Art Line Algorithm](https://invent.kde.org/graphics/krita/-/merge_requests/2158)
