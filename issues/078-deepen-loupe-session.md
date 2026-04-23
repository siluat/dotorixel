---
title: Deepen SamplingSession — collapse sampling/grid/position into a port-injected session
status: open
created: 2026-04-23
---

## Problem

The "color sampling with loupe overlay" feature — a single user-visible behavior — is implemented as five tightly-coupled but architecturally scattered modules, with the lifecycle state machine spread across three additional integration points.

### Current cluster

| File | Responsibility |
|------|----------------|
| `src/lib/canvas/sampling-session.svelte.ts` | Reactive state (`isActive`, `grid`, `centerColor`, `inputSource`) + `start/update/commit/cancel` methods. Factory takes `getCanvas: () => PixelCanvas`. |
| `src/lib/canvas/loupe-position.ts` | Pure `computeLoupePosition({ pointer, viewport, loupe, mouseOffset, touchOffset, inputSource })` — quadrant flip + clamp. |
| `src/lib/canvas/sample-grid.ts` | Pure `sampleGrid(canvas, center, size)` returning a row-major flat array, `null` for out-of-canvas cells. |
| `src/lib/ui-editor/Loupe.svelte` | Presentation component. Holds geometry constants (`LOUPE_WIDTH/HEIGHT`, `MOUSE_OFFSET=20`, `TOUCH_OFFSET=80`) and calls `computeLoupePosition` itself. |
| `src/lib/canvas/PixelCanvasView.svelte` | Tracks `screenPointer` (clientX/Y) and `windowSize` (innerWidth/Height) **independently** of the session. Renders `<Loupe>` when `samplingSession?.isActive && screenPointer`. |

The session lifecycle is also split across:

- `src/lib/canvas/tools/eyedropper-tool.ts` — calls `host.sampling.start({...})` during the draw lifecycle, builds `commitTarget` from `spec.drawButton`.
- `src/lib/canvas/canvas-interaction.svelte.ts` — owns the 400ms long-press timer that fires `onSampleStart(coords, button, pointerType): boolean`. On disruption (`blur`/`pointercancel`/`pointerleave`/secondary touch) calls `onSampleEnd`, **which currently commits rather than cancels** — a latent bug: losing window focus during sampling commits the color.
- `src/lib/canvas/editor-session/tab-state.svelte.ts` — implements `sampleStart` (returns `false` when `activeTool === 'eyedropper'` to suppress double-start) / `sampleUpdate` / `sampleEnd`, applies commit effects.
- `src/lib/canvas/editor-session/editor-controller.svelte.ts` — proxies handlers to the active tab.
- `src/routes/editor/+page.svelte` — wires `editor.samplingSession` and `editor.handleSample*` into `<PixelCanvasView>` (twice — once per responsive layout branch).

### Friction this creates

- **"Open a sampling session" parameters are assembled in three places** (eyedropper tool, `tab-state.sampleStart`, the canvas-interaction long-press callback). Each place builds `{ targetPixel, commitTarget, inputSource }` from different sources of truth.
- **Loupe display trigger is split**: `samplingSession.isActive` lives in the session; `screenPointer` is owned by `PixelCanvasView`. The render condition is a coincidence of two separately-tracked pieces of state.
- **Coordinate translation responsibility is unclear**: the session knows canvas coords; the Loupe needs window coords; `PixelCanvasView` does the bridging by tracking pointer events itself. Three components each know a slice of the coord systems.
- **Pure functions are tested in isolation but the bugs live in their callers.** `loupe-position.test.ts` (271 lines) and `sample-grid.test.ts` (69 lines) verify pure math with full coverage, but no test catches "blur during sampling commits color" because that bug lives at the integration seam between `canvas-interaction` and the session.
- **Apple shell parity is blocked at the source**: `PixelCanvasView` directly reads `event.clientX` and `window.innerWidth`, leaking DOM into a layer that should be portable. (Apple shell remains out of scope for this refactor — see "Out of Scope".)
- **Future consumers (issue 060: floating reference-image color sampling)** can't plug in without restructuring. The session's `getCanvas` getter is shaped around the active tab's `PixelCanvas` — a reference-image source is a different shape entirely.

## Solution

Deepen the existing `SamplingSession` (no rename) so that it owns:

1. **The full sampling state machine** (start/update/commit/cancel) plus a new `updatePointer` setter for screen-coord push.
2. **Loupe position computation** as a reactive `position` getter — Loupe consumes `position` directly, no longer computes its own.
3. **Pixel access via a single narrow port** (`CanvasSamplingPort` — `{width, height, get_pixel}`), satisfied structurally by `PixelCanvas` today and by future reference-image adapters.

Geometry constants (`LOUPE_WIDTH`, `LOUPE_HEIGHT`, `MOUSE_OFFSET`, `TOUCH_OFFSET`), the `computeLoupePosition` math, and `sampleGrid` extraction all move into the same `sampling/` module — single source of truth for the Loupe's visual policy. `PixelCanvasView` stops tracking `screenPointer`/`windowSize` for loupe purposes; instead it pushes pointer position into the session on every pointer event.

The disruption-as-commit bug is fixed as a **separate preliminary PR** before the deepening, because (a) it's user-visible and worth landing now, and (b) decoupling it keeps the deepening PR purely structural.

## Proposed Interface

```ts
// src/lib/canvas/sampling/ports.ts
import type { Color } from '../color';

/**
 * The session reads pixels through this port. PixelCanvas structurally
 * satisfies this interface (no explicit adapter needed). Tests inject a
 * tiny in-memory implementation. A future reference-image adapter wraps
 * an HTMLImageElement-backed buffer.
 *
 * Contract: callers must guarantee `0 <= x < width && 0 <= y < height`
 * before calling `get_pixel`. The port is not responsible for OOB handling
 * — that's done in sample-grid.ts before the call.
 */
export interface CanvasSamplingPort {
  readonly width: number;
  readonly height: number;
  get_pixel(x: number, y: number): Color;
}
```

```ts
// src/lib/canvas/sampling/types.ts
export type LoupeInputSource = 'mouse' | 'touch';
```

```ts
// src/lib/canvas/sampling/session.svelte.ts
export interface SamplingSession {
  // Reactive state read by <Loupe>
  readonly isActive: boolean;
  readonly grid: readonly (Color | null)[];
  /** Window-coord position; null when inactive or pointer info not yet seeded. */
  readonly position: { readonly x: number; readonly y: number } | null;

  start(params: {
    targetPixel: CanvasCoords;
    commitTarget: 'foreground' | 'background';
    inputSource: LoupeInputSource;
  }): void;

  update(targetPixel: CanvasCoords): void;

  /** Setter — called from PixelCanvasView's pointerdown/pointermove handlers. Always safe to call regardless of isActive. */
  updatePointer(params: {
    screen: { x: number; y: number };
    viewport: { width: number; height: number };
  }): void;

  /** Returns ToolEffects (colorPick + addRecentColor) for the dispatcher. */
  commit(): ToolEffects;

  /** Disruption path. Returns no effects via reset. Wired to blur/cancel/leave. */
  cancel(): void;
}

export function createSamplingSession(opts: {
  getSamplingPort: () => CanvasSamplingPort;
}): SamplingSession;
```

### Usage at the call sites

**Eyedropper tool** — unchanged shape (already uses `host.sampling`):

```ts
// src/lib/canvas/tools/eyedropper-tool.ts (unchanged)
export const eyedropperTool = customTool({
  id: 'eyedropper',
  open(host, spec) {
    const commitTarget = spec.drawButton === 2 ? 'background' : 'foreground';
    return {
      start: () => NO_EFFECTS,
      draw: (current) => {
        if (!host.sampling.isActive) {
          host.sampling.start({ targetPixel: current, commitTarget, inputSource: spec.inputSource });
        } else {
          host.sampling.update(current);
        }
        return NO_EFFECTS;
      },
      modifierChanged: () => NO_EFFECTS,
      end: () => host.sampling.commit(),
    };
  },
});
```

**Long-press handler** — gating stays at TabState; `commit`/`cancel` become explicit (the bug fix from PR 1):

```ts
// src/lib/canvas/editor-session/tab-state.svelte.ts
sampleStart = (coords, button, pointerType) => {
  if (this.shared.activeTool === 'eyedropper') return false;
  this.samplingSession.start({
    targetPixel: coords,
    commitTarget: button === 2 ? 'background' : 'foreground',
    inputSource: pointerType === 'touch' ? 'touch' : 'mouse',
  });
  return true;
};
sampleUpdate = (coords) => this.samplingSession.update(coords);
sampleEnd    = () => this.#applyEffects(this.samplingSession.commit()); // pointerup path
sampleCancel = () => this.samplingSession.cancel();                      // disruption path
```

`canvas-interaction.svelte.ts` distinguishes the two end paths via separate callbacks:

```ts
// pointerup → onSampleEnd; blur/cancel/pinch/leave → onSampleCancel
interface CanvasInteractionCallbacks {
  // ...existing...
  onSampleStart: (...) => boolean;
  onSampleUpdate: (...) => void;
  onSampleEnd: () => void;
  onSampleCancel: () => void; // NEW (PR 1)
}
```

**Loupe overlay rendering** — `PixelCanvasView` no longer computes anything for the loupe; it pushes pointer state to the session and renders Loupe with the session-derived position:

```svelte
<!-- PixelCanvasView.svelte -->
<script>
  function onPointerMove(e: PointerEvent) {
    interaction.pointerMove(...); // unchanged
    samplingSession.updatePointer({
      screen: { x: e.clientX, y: e.clientY },
      viewport: { width: window.innerWidth, height: window.innerHeight }
    });
  }
  function onPointerDown(e: PointerEvent) {
    interaction.pointerDown(...); // unchanged
    samplingSession.updatePointer({ /* same */ });
  }
</script>

{#if samplingSession?.isActive && samplingSession.position}
  <Loupe grid={samplingSession.grid} position={samplingSession.position} />
{/if}
```

```svelte
<!-- Loupe.svelte — no more position math, no more screenPointer/viewport/inputSource props -->
<script lang="ts">
  let { grid, position }: { grid: readonly (Color | null)[]; position: { x: number; y: number } } = $props();
</script>

<div class="loupe" style:left="{position.x}px" style:top="{position.y}px">
  <!-- grid + chip rendering unchanged; LOUPE_WIDTH/HEIGHT/CELL_SIZE_PX/PADDING_PX/BORDER_PX/CHIP_HEIGHT_PX imported from sampling/loupe-config.ts -->
</div>
```

### Complexity hidden internally

- Coordinate translation between canvas-pixel coords (input) and window coords (output via `position`).
- Geometry constants (`LOUPE_WIDTH`, `LOUPE_HEIGHT`, `MOUSE_OFFSET=20`, `TOUCH_OFFSET=80`) and the `computeLoupePosition` math (quadrant flip + clamp).
- `sampleGrid` invocation and the OOB → null distinction.
- The single-active-session invariant.
- `ToolEffects` construction (`colorPick` + `addRecentColor`).
- The reactive contract: `position` is a `$derived` over screen/viewport/inputSource state — null when any input is missing.

### What is deliberately NOT hidden

- **`activeTool === 'eyedropper'` gating stays in TabState.** Pulling it into the session would require a `getActiveTool` port, growing surface for a single-use rule.
- **Effect application stays in TabState's dispatcher.** `commit()` returns effects; the session never mutates fg/bg. Preserves the rule from issue 077.
- **`grid` remains on the public surface.** Loupe.svelte still reads it directly to render cells. Hiding `grid` behind a `<LoupeView>` component exported from the sampling module is a deeper next step deferred to a follow-up review-backlog item.
- **`PointerPort` rejected.** A reactive port for pointer events would add a second adapter abstraction whose only behavior is "current screen position + window size." Push-via-setter (`updatePointer`) is simpler and avoids a second injection mechanism.
- **`centerColor` / `inputSource` removed from public surface.** They have no external consumers (`centerColor` is dead code; `inputSource` is only used by Loupe for self-positioning, which is now session-internal).
- **Apple shell parity is out of scope.** The session being framework-free unblocks future work but does not deliver it in this refactor.

## Commits

The work lands in **two PRs in strict order**: PR 1 (bug fix) → merge → PR 2 (deepening).

### PR 1: `fix: cancel sampling session on disruption (pinch/leave/blur)`

Branch: `fix/sampling-disruption-cancel`. Two internal commits.

#### Commit 1.① — failing e2e regression test

Add a single Playwright test in `e2e/editor/drawing.test.ts`:

> "touch long-press then pointer leave does not commit color"

Setup: foreground = known color (e.g., black). Canvas has a single red pixel at a known coordinate.

Steps:
1. Touch-press on the red pixel; wait 400ms for long-press to engage and the loupe to appear.
2. Without releasing, drag the touch outside the canvas DOM bounds (triggers `pointerleave`).
3. Release the touch.

Assertion: foreground is **still black**. (Current code: foreground becomes red — the bug.)

This commit fails CI. It is the regression guard.

#### Commit 1.② — split callbacks, wire `cancel()`, e2e passes

Three coordinated changes in one commit:

1. **`canvas-interaction.svelte.ts`**: split the disruption sites from the real-release site.
   - Add `onSampleCancel: () => void` to `CanvasInteractionCallbacks`.
   - Keep `onSampleEnd` for the pointerup release path only (one site).
   - Route the three disruption paths (pinch transition, pointerleave, blur) to `onSampleCancel`.
2. **`editor-controller.svelte.ts`**: add `handleSampleCancel(): void` proxy that calls the active tab's `sampleCancel`.
   **`tab-state.svelte.ts`**: add `sampleCancel()` method that calls `this.samplingSession.cancel()`. (No `markDirty` emission.)
3. **`+page.svelte`**: wire `onSampleCancel={editor.handleSampleCancel}` into both `<PixelCanvasView>` instances (compact + x-wide layout branches).

Add three unit tests in `canvas-interaction.svelte.test.ts` under a new `describe('sampling disruption')`:

- pinch transition during sampling calls `onSampleCancel`, not `onSampleEnd`
- pointerleave during sampling calls `onSampleCancel`, not `onSampleEnd`
- blur during sampling calls `onSampleCancel`, not `onSampleEnd`

E2E from commit ① now passes. Existing sampling e2e tests continue to pass.

---

### PR 2: `refactor: deepen SamplingSession with port + reactive position`

Branch: `refactor/deepen-sampling-session`. Four internal commits. Begins **after PR 1 is merged to main**.

#### Commit 2.① — introduce `sampling/` module (no consumer wiring)

Create directory and files:

- `src/lib/canvas/sampling/ports.ts` — `CanvasSamplingPort` interface with the contract that callers handle OOB.
- `src/lib/canvas/sampling/types.ts` — `LoupeInputSource` type (moved from `loupe-position.ts`).
- `src/lib/canvas/sampling/loupe-config.ts` — `LOUPE_WIDTH`, `LOUPE_HEIGHT`, `MOUSE_OFFSET`, `TOUCH_OFFSET`, `GRID_SIZE`, plus building blocks (`CELL_SIZE_PX`, `PADDING_PX`, `BORDER_PX`, `CHIP_HEIGHT_PX`).
- `src/lib/canvas/sampling/session.svelte.ts` — new `createSamplingSession({ getSamplingPort })` factory. Public surface per Proposed Interface (`isActive`, `grid`, `position`, `start`, `update`, `updatePointer`, `commit`, `cancel`). Internals: `$state` for screen/viewport/inputSource; `position` as `$derived.by` calling `computeLoupePosition`. During this commit the new session also temporarily exposes a deprecated-on-arrival `inputSource` getter — needed by `Loupe.svelte` until commit 2.③ flips it to `position`. Removed in commit 2.④.
- `src/lib/canvas/sampling/session.svelte.test.ts` — new boundary suite (see Testing Decisions).
- `src/lib/canvas/sampling/adapters/in-memory.ts` — `createInMemorySamplingPort(grid: (Color | null)[][]): CanvasSamplingPort` test helper.

Move (not copy) and lightly adapt:

- `loupe-position.ts` → `sampling/loupe-position.ts`. `LoupeInputSource` is removed from this file (now lives in `types.ts`); `loupe-position.ts` imports from `types.ts`.
- `loupe-position.test.ts` → `sampling/loupe-position.test.ts`.
- `sample-grid.ts` → `sampling/sample-grid.ts`. Argument type changed from `PixelCanvas` to `CanvasSamplingPort` (PixelCanvas structurally satisfies it, so no callsite changes needed yet).
- `sample-grid.test.ts` → `sampling/sample-grid.test.ts`.

Update import paths in the four existing consumers of `LoupeInputSource` (`stroke-engine.ts`, `tool-authoring.ts`, `sampling-session.svelte.ts`, `Loupe.svelte`) to `sampling/types`. Update the one consumer of `sampleGrid` (`sampling-session.svelte.ts`) to import from `sampling/sample-grid`.

Build + all tests pass. Old `sampling-session.svelte.ts` still exists, still works, still owned by TabState. New module is silent.

#### Commit 2.② — TabState swap (consumers unchanged)

Single change: `tab-state.svelte.ts` swaps the import and factory call:

- Before: `import { createSamplingSession } from '../sampling-session.svelte'` and `createSamplingSession(() => self.pixelCanvas)`.
- After: `import { createSamplingSession } from '../sampling/session.svelte'` and `createSamplingSession({ getSamplingPort: () => self.pixelCanvas })`.

`Loupe.svelte` and `PixelCanvasView.svelte` are not touched. They continue reading `samplingSession.grid`, `samplingSession.inputSource` (the temporary compat getter), and tracking `screenPointer`/`windowSize` themselves. The new session's `position` is null (no `updatePointer` calls yet) — Loupe doesn't read it.

Build + all tests pass. Old `sampling-session.svelte.ts` is now orphaned but still present.

#### Commit 2.③ — Loupe + PixelCanvasView swap to `position`

Three coordinated changes:

1. **`PixelCanvasView.svelte`**: in `pointerdown` and `pointermove` handlers, after calling `interaction.pointer*`, also call `samplingSession.updatePointer({ screen, viewport })` (unguarded — always called, regardless of `isActive`). Drop the `screenPointer` and `windowSize` `$state` declarations if no other consumer uses them (search confirms before delete). The `<Loupe>` invocation changes to pass `position={samplingSession.position}` instead of `screenPointer/viewport/inputSource`. The render guard becomes `{#if samplingSession?.isActive && samplingSession.position}`.
2. **`Loupe.svelte`**: drop `LOUPE_WIDTH`/`LOUPE_HEIGHT`/`CELL_SIZE_PX`/`PADDING_PX`/`BORDER_PX`/`CHIP_HEIGHT_PX`/`MOUSE_OFFSET`/`TOUCH_OFFSET`/`GRID_SIZE` local definitions; import them from `sampling/loupe-config`. Drop the `computeLoupePosition` import and call. Replace `screenPointer`/`viewport`/`inputSource` props with a single `position: { x, y }` prop. Inline-style left/top reads from `position`.
3. **`Loupe.svelte.test.ts`**: update component-mount tests to pass the new prop shape (`position` instead of `screenPointer`/`viewport`/`inputSource`).

Build + all tests pass. The new pointer-push pipeline is now end-to-end live.

#### Commit 2.④ — cleanup

- Delete `src/lib/canvas/sampling-session.svelte.ts` (orphaned since commit 2.②).
- Delete `src/lib/canvas/sampling-session.svelte.test.ts` (after a manual review confirms every behavioral scenario is covered by `sampling/session.svelte.test.ts`).
- Remove the temporary `inputSource` getter from `SamplingSession` (added in commit 2.①). No external readers remain after commit 2.③.
- Remove `centerColor` from anywhere it might still be referenced (it was already absent from the new module; cleanup is defensive).

Build + all tests pass. Public API surface of `SamplingSession` is the final shape: `isActive`, `grid`, `position`, `start`, `update`, `updatePointer`, `commit`, `cancel`.

## Decision Document

### Naming and module identity

- Keep the existing class name `SamplingSession` and host property `host.sampling`. Rationale: "sampling" describes the *behavior* (the eyedropper tool's intent and future reference-image sampling); "loupe" is one *visualization* of that behavior. Future reference-image sampling (issue 060) is also conceptually sampling. Renaming would churn ~6 files for no semantic gain.
- New module directory: `sampling/`. Encapsulates the session, its port, geometry constants, the position math, and grid extraction.

### Public API surface (final, after commit 2.④)

`SamplingSession` exposes exactly:

- Reactive: `isActive`, `grid`, `position` (window coords; null when inactive or before first pointer)
- Imperative: `start({targetPixel, commitTarget, inputSource})`, `update(targetPixel)`, `updatePointer({screen, viewport})`, `commit(): ToolEffects`, `cancel(): void`

Removed from prior surface: `centerColor` (no external consumers), `inputSource` (subsumed into `position` derivation).

### Port shape

`CanvasSamplingPort = { width, height, get_pixel(x, y): Color }`. Low-level by intent so that:

- `PixelCanvas` structurally satisfies it — no production-side adapter file.
- The in-memory test adapter is ~8 lines and faithful to `sample-grid` semantics.
- The 9×9 + OOB null logic remains in one place (`sample-grid.ts`), not duplicated across adapters.

OOB contract: `get_pixel` is only called inside bounds; OOB handling is the caller's (sample-grid's) responsibility. Documented in `ports.ts` jsdoc.

### Pointer / viewport injection

Push via a session setter (`updatePointer({screen, viewport})`) called by `PixelCanvasView` from pointerdown + pointermove handlers. Always invoked — no `isActive` guard — so that a 400ms long-press with a stationary finger has cached pointer state ready when `start()` fires.

Rejected alternatives:

- A reactive `PointerPort` adapter — adds a second injection abstraction whose only behavior is "current screen + window size."
- Threading screen/viewport through `start()`/`update()` — would change the canvas-interaction → editor-controller → tab-state → session callback chain, conflicting with PR 1's signature changes.

### Reactive position semantics

`position` is `$derived.by` over internal `screen`/`viewport`/`inputSource` `$state`. Returns null when:

- `isActive` is false, OR
- any of `screen`/`viewport`/`inputSource` is null.

Loupe renders only when `isActive && position` are both truthy. The window between `start()` and the first `updatePointer()` is effectively zero because `pointerdown` already calls `updatePointer` before any long-press timer can fire.

### Lifecycle and bug fix sequencing

The disruption-as-commit bug ships in PR 1, before deepening. PR 1's commit-callback split (`onSampleEnd` vs `onSampleCancel`) is independently meaningful and deserves its own review and merge.

PR 2 is purely structural — no behavior changes, only module reorganization and surface tightening. This separation makes both PRs easier to review and revert if needed.

### Per-tab ownership preserved

Each `TabState` constructs its own `SamplingSession` via `createSamplingSession({ getSamplingPort: () => this.pixelCanvas })`. The getter pattern preserves late binding for canvas resize (which returns a new `PixelCanvas` instance).

### Geometry constants ownership

All Loupe layout constants move to `sampling/loupe-config.ts` (single source of truth). `Loupe.svelte` imports them for its own rendering; the session imports them for `computeLoupePosition`. This guarantees the constant used for clamp/flip math always equals the constant used for actual rendered size.

### Future reference-image sampling unblocked

Issue 060 (floating reference-image color sampling) constructs its own `SamplingSession` with a different `CanvasSamplingPort` adapter (one wrapping an `HTMLImageElement`-backed buffer). Zero changes required to the session core. The reference-image window owns its own session lifecycle.

## Testing Decisions

### Principles

Per `.claude/rules/testing.md`:

- **Tests are specifications** — boundary tests at the deepened module's surface read as a behavioral description of "color sampling with loupe".
- **Test behaviors, not implementation** — assertions are on `commit()` return values, `position` getter output, and `isActive` transitions. No assertions on internal `$state` variables.
- **Prioritize regression defense** — coordinate math (`computeLoupePosition`) and grid math (`sampleGrid`) keep their dense pure-function suites because they're exactly the kind of "hard to catch visually" boundary code the rule flags.

### PR 1 testing

- **1 e2e test** in `e2e/editor/drawing.test.ts`: "touch long-press then pointer leave does not commit color" (commit 1.①, fails on current main; passes after 1.②).
- **3 unit tests** in `canvas-interaction.svelte.test.ts` under a new `describe('sampling disruption')` block (commit 1.②): one each for pinch / pointerleave / blur, each asserting `onSampleCancel` was called and `onSampleEnd` was not.
- **No new TabState test added.** The existing `tab-state.svelte.test.ts:152` ("sampleStart/update without commit does NOT emit markDirty") already verifies the no-commit observation through a different path. Adding a redundant cancel-path test offers no new regression coverage.

### PR 2 testing

#### New `sampling/session.svelte.test.ts` (boundary suite)

Drives the new session through `createInMemorySamplingPort([[red, blue, ...], ...])`. Asserts on the public surface (`isActive`, `grid`, `position`, `commit()` return, `cancel()` reset).

Scenarios ported from `sampling-session.svelte.test.ts` (centerColor-specific assertions reframed as effect-level behavior):

- Mouse happy path: start → grid populated → commit returns `[colorPick(fg, color), addRecentColor]`.
- Touch happy path: same as mouse but with `inputSource: 'touch'`.
- Background commit target: `commitTarget: 'background'` → effect targets background.
- Out-of-canvas grid: target near canvas corner → grid contains `null` cells in expected positions.
- Transparent center pixel: `commit()` returns `NO_EFFECTS`.
- Drift over transparent during update: previously asserted `centerColor` preservation; now asserts that releasing on transparent returns `NO_EFFECTS` regardless of prior opaque preview (the actual user-observable behavior).
- Drift back to opaque: release on opaque after passing through transparent → effect with the final opaque color.
- Cancel: start → cancel → `isActive=false`, subsequent `commit()` returns `NO_EFFECTS`.
- Inactive guard: `commit()` without prior `start()` returns `NO_EFFECTS`.

New scenarios for `position` and `updatePointer` (commit 2.① adds these):

- `updatePointer` before `start`: pointer state cached, `position` still null until `start` (because `inputSource` is null).
- `start` then `updatePointer({screen: center, viewport: 1024×768})` with `inputSource: 'mouse'`: `position` reflects 20px symmetric offset (BR quadrant by default).
- Pointer near right edge: quadrant flips to BL.
- Pointer near bottom edge: quadrant flips to TR.
- Pointer in clamping-degenerate viewport: position clamped inward.
- Touch input source: `position.y` reflects 80px vertical offset, x is centered relative to pointer.
- After `commit()`: `isActive=false`, `position=null`.
- After `cancel()`: same.

#### Existing tests preserved

- `sampling/loupe-position.test.ts` (moved from `loupe-position.test.ts`) — pure function regression suite for quadrant flip / clamp boundary math. Kept verbatim.
- `sampling/sample-grid.test.ts` (moved from `sample-grid.test.ts`) — pure function regression suite for OOB / transparent handling. Kept verbatim.
- `Loupe.svelte.test.ts` — updated in commit 2.③ for the new prop shape (`position` instead of `screenPointer`/`viewport`/`inputSource`); existing visual-render assertions (cell coloring, transparent/OOB patterning, hex chip) preserved.

#### Existing test deleted

- `sampling-session.svelte.test.ts` — deleted in commit 2.④ after manual review confirms scenario coverage in `sampling/session.svelte.test.ts`.

### Test environment

In-memory adapter (`createInMemorySamplingPort`) lives in `sampling/adapters/in-memory.ts`. No DOM, no WASM, no Svelte mounting required for the boundary suite — runs in pure node via Vitest.

### Prior art

The boundary-test pattern via in-memory adapter mirrors the architecture established in issue 077 (TabState/Workspace/EditorController split), where each layer has its own boundary tests through controlled construction.

## Out of Scope

1. **Loupe component directory move.** `src/lib/ui-editor/Loupe.svelte` stays where it is. Moving it inside `sampling/` for tighter encapsulation is a separate concern.
2. **`<LoupeView>` component export.** Hiding `grid` behind a sampling-module-owned visualization component would deepen the module further but multiplies the refactor scope. Deferred to a follow-up review-backlog item.
3. **`+page.svelte` compact/x-wide wiring duplication.** The two `<PixelCanvasView>` instantiations both need the new `onSampleCancel` prop wired in PR 1. Extracting an `<EditorCanvas>` wrapper to deduplicate is a separate cleanup.
4. **`PointerPort` as a real port.** Rejected per Decision Document — push-via-setter is sufficient.
5. **ResizeObserver-driven dynamic Loupe sizing.** Constants suffice; the Loupe is a fixed-size overlay.
6. **Apple shell sampling parity.** The Apple shell (SwiftUI + Metal) implements sampling/loupe natively; UniFFI does not cross this surface. This refactor is web-only. The framework-free session module unblocks future Apple parity work but does not deliver it.
7. **`canvas-interaction.svelte.ts` deepening.** Only the callback split (`onSampleCancel`) lands in PR 1. Larger refactors of the gesture machine are separate.
8. **Reference image sampling implementation (issue 060).** This refactor makes the `CanvasSamplingPort` extension point exist; the actual reference-image adapter and overlay window are issue 060's work.

## Further Notes

The PR 1 e2e test scenario (touch long-press → pointer leave) was chosen over blur or pinch because:

- Blur is awkward to trigger in Playwright (window focus loss in the headless context is finicky).
- Pinch requires multi-touch setup that adds non-trivial test scaffolding.
- Pointer leave during a long-press drag is the most realistic user disruption — covers the bug class with the least Playwright friction.

The three unit tests in `canvas-interaction.svelte.test.ts` collectively cover all three disruption paths so that any future regression on a specific path is identifiable from the failing test name.

The temporary `inputSource` getter on the new `SamplingSession` (added in commit 2.① and removed in 2.④) is a deliberate compatibility shim. It exists for exactly two commits (2.② and 2.③ before flip) so that each individual commit leaves the codebase in a working state — Fowler's "always-working program" principle.
