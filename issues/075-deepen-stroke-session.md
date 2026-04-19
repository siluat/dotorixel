---
title: Deepen per-stroke state — StrokeSession factory with typed openers
status: open
created: 2026-04-19
---

## Problem Statement

Per-stroke state — the data that lives for exactly one drawing stroke — is scattered across three modules:

1. **`tool-runner.svelte.ts`** holds per-stroke fields (`activeLifecycle`, `strokeOps`, `activeDrawColor`, `activeInputSource`, `drawButton`) and re-builds `ToolContext` on every `draw()` call.
2. **Five `StrokeLifecycle` closures inside the ToolRunner factory** each own per-kind state (`snapshot`, `anchor`, `lastCurrent`, `fired`, `started`).
3. **`createPixelPerfectOps`** closes over a per-stroke `tail: Int32Array` + `cache: Map<string, Color>`. The decorator is created conditionally at `drawStart` based on a hardcoded `'pencil' | 'eraser'` string check (`tool-runner.svelte.ts:344–346`).

This shape exhibits the *pure-extract-with-impure-callsite* failure mode: `pixel_perfect_filter` and the decorator itself are well-unit-tested, yet the **real class of recent regressions** lives at call-site integration:

- `#158` — pixel-perfect toggle + preference persistence
- `#159` — pixel-perfect reload race on session restore
- `#160` — first trackpad pan misclassified as zoom (adjacent cluster)

Additional friction:

- **Implicit mid-stroke PP policy.** Today the decorator is fixed at `drawStart`; if the user flips `shared.pixelPerfect` via keyboard mid-stroke, nothing re-evaluates. The policy is correct but undocumented, so a future contributor can "fix" it and break the tail invariant.
- **Test-level friction.** `pixel-perfect-ops.test.ts` drives the decorator by hand-crafting `Int32Array` stroke batches — leaking ToolRunner's batching detail into unit tests. Tests read like implementation replays rather than behavioral specs.
- **Hardcoded tool-name gate.** `shared.activeTool === 'pencil' || shared.activeTool === 'eraser'` couples PP eligibility to tool keys instead of tool capability.

**Dependency category**: **In-process** — pure computation + in-memory state, no I/O.

## Solution

Introduce a `StrokeSessions` factory constructed once per editor. The factory takes editor-scoped dependencies (ops, history, sampling, modifier reads) and returns an object with five typed opener methods — one per `DrawTool.kind`. Each opener takes a single `spec` object identifying the stroke's per-call identity and returns a uniform `StrokeSession` with four methods (`start`, `draw`, `modifierChanged`, `end`). ToolRunner becomes a thin dispatcher that resolves the active tool and delegates to the corresponding opener method.

This matches the codebase's existing factory pattern (`createToolRunner(deps)`, `createPixelPerfectOps(baseOps)`, `createDrawingOps(cb)`): editor-scoped deps are captured at construction; per-call data is passed at invocation. The lifetime distinction is visible as two construction steps, not as a split inside a single function signature.

## Proposed Interface

### Public API (in `src/lib/canvas/stroke-session.ts`)

```ts
// Uniform session interface — four methods
export interface StrokeSession {
  /** Fire start-time effects (e.g. addRecentColor, samplingSession.start). */
  start(): EditorEffects;
  /** Feed a pointer sample. `previous` is null on the first sample. */
  draw(current: CanvasCoords, previous: CanvasCoords | null): EditorEffects;
  /** Re-evaluate modifier-dependent state (shift). No-op when not applicable. */
  modifierChanged(): EditorEffects;
  /** End the stroke; returns any deferred effects (e.g. sampling commit). */
  end(): EditorEffects;
}

// Editor-scoped dependencies — injected once at factory construction
export interface StrokeDeps {
  readonly host: ToolRunnerHost;
  readonly baseOps: DrawingOps;
  readonly history: { pushSnapshot(): void };
  readonly sampling: SamplingSession;
  readonly isShiftHeld: () => boolean;
  readonly pixelPerfect: () => boolean;
}

// Factory return — five typed opener methods
export interface StrokeSessions {
  continuous(spec: {
    tool: ContinuousTool;
    drawColor: Color;
    drawButton: number;
  }): StrokeSession;
  oneShot(spec: {
    tool: OneShotTool;
    drawColor: Color;
    drawButton: number;
  }): StrokeSession;
  shapePreview(spec: {
    tool: ShapePreviewTool;
    drawColor: Color;
    drawButton: number;
  }): StrokeSession;
  dragTransform(spec: {
    tool: DragTransformTool;
    drawColor: Color;
    drawButton: number;
  }): StrokeSession;
  liveSample(spec: {
    drawButton: number;
    inputSource: LoupeInputSource;
  }): StrokeSession;
}

export function createStrokeSessions(deps: StrokeDeps): StrokeSessions;
```

### Usage from ToolRunner

```ts
// Built once at editor construction.
const sessions: StrokeSessions = createStrokeSessions({
  host,
  baseOps: ops,
  history: { pushSnapshot: pushHistorySnapshot },
  sampling: samplingSession,
  isShiftHeld: getShiftHeld,
  pixelPerfect: () => shared.pixelPerfect,
});

let activeSession: StrokeSession | null = null;

drawStart(button, pointerType): EditorEffects {
  const tool = tools[shared.activeTool];
  const drawColor = button === 2 ? host.backgroundColor : host.foregroundColor;
  const inputSource = pointerType === 'touch' ? 'touch' : 'mouse';

  switch (tool.kind) {
    case 'continuous':
      activeSession = sessions.continuous({ tool, drawColor, drawButton: button });
      break;
    case 'oneShot':
      activeSession = sessions.oneShot({ tool, drawColor, drawButton: button });
      break;
    case 'shapePreview':
      activeSession = sessions.shapePreview({ tool, drawColor, drawButton: button });
      break;
    case 'dragTransform':
      activeSession = sessions.dragTransform({ tool, drawColor, drawButton: button });
      break;
    case 'liveSample':
      activeSession = sessions.liveSample({ drawButton: button, inputSource });
      break;
  }
  isDrawing = true;
  return activeSession.start();
}

draw(current, previous): EditorEffects {
  return activeSession?.draw(current, previous) ?? NO_EFFECTS;
}

modifierChanged(): EditorEffects {
  return activeSession?.modifierChanged() ?? NO_EFFECTS;
}

drawEnd(): EditorEffects {
  const effects = activeSession?.end() ?? NO_EFFECTS;
  activeSession = null;
  isDrawing = false;
  return effects;
}
```

ToolRunner shrinks to: "resolve tool → open session → delegate." No lifecycle factories, no `strokeOps` field, no `buildContext` helper, no hardcoded `'pencil' | 'eraser'` check.

### Internal PP composition — direct ternary

Inside `sessions.continuous`, the pixel-perfect decorator is applied via a direct ternary:

```ts
const strokeOps = deps.pixelPerfect() && spec.tool.supportsPixelPerfect
  ? createPixelPerfectOps(deps.baseOps)
  : deps.baseOps;
```

No filter array, no registry, no indirection. PP is read **once at open**; mid-stroke toggles do not re-compose the chain.

### Tool schema change

Add `supportsPixelPerfect: boolean` to `ContinuousTool`:

```ts
export interface ContinuousTool {
  readonly kind: 'continuous';
  readonly addsActiveColor: boolean;
  readonly supportsPixelPerfect: boolean;
  apply(ctx: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): boolean;
}
```

`pencil` and `eraser` set `true`. Future continuous tools opt in explicitly. This replaces the string check at `tool-runner.svelte.ts:344–346`.

### What it hides

- Which lifecycle logic runs for a given tool kind.
- How the PP decorator is built; when cache/tail are allocated and released.
- How `ToolContext` is constructed per `draw()` call.
- Which effects fire on stroke start (`addRecentColor`) vs stroke end (sampling commit).
- Snapshot-restore bookkeeping for shape/drag tools.
- `started`/`fired` guards in oneShot and liveSample.
- `inputSource` derivation (`'pen' → 'mouse'`) — captured inside `sessions.liveSample`.

## Commits

Eight micro-commits, ordered from simplest kind to most complex. Each leaves the app working with its full test suite passing, satisfying Martin Fowler's "always see the program working" principle. Continuous comes last because it carries pixel-perfect complexity.

### Commit 1 — refactor: add `supportsPixelPerfect` flag on `ContinuousTool`

Prerequisite. Adds the field to `ContinuousTool`, sets `true` on `pencil` and `eraser`. Updates the hardcoded `'pencil' | 'eraser'` check in `tool-runner.svelte.ts:344–346` to read the flag. No session module yet. Existing tests keep passing.

### Commit 2 — refactor: introduce StrokeSession module skeleton

Adds `src/lib/canvas/stroke-session.ts` with the `StrokeSession`, `StrokeDeps`, `StrokeSessions` types and a `createStrokeSessions(deps)` factory whose five opener methods all throw `not implemented`. Unreachable from anywhere. Extracts `FakeOps` from `pixel-perfect-ops.test.ts` into a shared test helper so subsequent session tests can reuse it. Adds a `stroke-session.test.ts` shell importing the shared helpers. No behavior change.

### Commit 3 — refactor: implement `liveSample` opener + migrate ToolRunner

Simplest first — no canvas writes. Implements `sessions.liveSample(spec)` with `start()`/`draw()`/`modifierChanged()`/`end()` delegating to the injected `SamplingSession`. Captures `inputSource` closure-side. ToolRunner's `drawStart` switch now dispatches the `liveSample` case through `sessions.liveSample`; the old closure is deleted. Other kinds still run on existing inline factories. Adds `stroke-session.liveSample.test.ts`.

### Commit 4 — refactor: implement `dragTransform` opener + migrate

Adds snapshot capture/restore on every sample. Migrates ToolRunner's `dragTransform` case. Deletes the `dragTransform` closure from ToolRunner. Adds `stroke-session.dragTransform.test.ts`.

### Commit 5 — refactor: implement `shapePreview` opener + migrate

Adds anchor + snapshot + `modifierChanged()` that re-invokes `onPreview` with current shift. Migrates ToolRunner's `shapePreview` case. Deletes the `shapePreview` closure. Adds `stroke-session.shapePreview.test.ts`.

### Commit 6 — refactor: implement `oneShot` opener + migrate

Adds `fired` guard so second `draw()` in the same stroke is a no-op. Respects `capturesHistory`. Migrates ToolRunner's `oneShot` case. Deletes the `oneShot` closure. Adds `stroke-session.oneShot.test.ts`.

### Commit 7 — refactor: implement `continuous` opener + migrate

Most complex. Includes PP filter composition (direct ternary), `addRecentColor` start-effect via `addsActiveColor`, `started` guard for first-sample behavior, and interaction with the per-stroke cache/tail inside the PP decorator. Migrates ToolRunner's `continuous` case. Deletes the `continuous` closure, the `strokeOps` field, the `buildContext` helper, and the now-dead PP gate. Adds `stroke-session.continuous.test.ts` (PP-off cases only — PP cases land in Commit 8).

### Commit 8 — test: migrate pixel-perfect tests to session boundary

Moves the L-corner revert, first-touch cache, and cross-batch seam assertions from `pixel-perfect-ops.test.ts` into `stroke-session.continuous.test.ts`, rewriting them to drive through `spec` + `draw(current, previous)` pairs instead of hand-crafted `Int32Array` batches. Any residue — pure `dedupAgainstTail` invariants not observable at the session boundary — stays as a focused unit file. Deletes the migrated cases from the old file.

## Decision Document

### Module shape

- **Single file**: `src/lib/canvas/stroke-session.ts` contains all five opener implementations, shared helpers, and `createStrokeSessions`. Splitting by kind would fragment a concept ("a stroke begins and ends") that belongs together at the same level of abstraction.
- **Separate decorator file**: `pixel-perfect-ops.ts` stays as-is. It's a generic `DrawingOps` decorator with independent testability and one callsite inside `stroke-session.ts`. Folding it in would mix decorator mechanics with session orchestration.

### API shape — factory-bound openers

- `createStrokeSessions(deps)` is called **once at editor construction** (inside ToolRunner).
- The returned `StrokeSessions` object exposes five opener methods, one per `DrawTool.kind`.
- Each opener takes a single `spec` object identifying the stroke's per-call identity (tool, color, button, inputSource).
- Matches codebase precedent (`createToolRunner`, `createPixelPerfectOps`, `createDrawingOps`): editor-scoped deps captured at construction, per-call data passed at invocation.
- Per-editor deps vs per-stroke spec is visible as **two distinct construction steps**, not as a split inside a single function signature.

### Opener semantics — pure open, explicit start

- Opener methods are **pure**: they construct a `StrokeSession` and return it, with no effects fired.
- `StrokeSession.start()` is the effect-firing entry point (`addRecentColor` for continuous, `samplingSession.start()` for liveSample, etc.).
- Separates construction (always succeeds, no side effects) from activation (may fire effects) — useful for testing and for future scenarios where an opened session may be discarded without starting.

### Filter composition — direct ternary, not array

- Inside `sessions.continuous`: `deps.pixelPerfect() && spec.tool.supportsPixelPerfect ? createPixelPerfectOps(deps.baseOps) : deps.baseOps`.
- No filter array, no registry. The second filter does not exist today; when it does, an if/else expansion is a trivial, local change.
- Avoids premature abstraction while keeping the seam obvious.

### PP mid-stroke policy

- `deps.pixelPerfect()` is read **exactly once** per stroke, at open time. Mid-stroke toggles do not re-compose the chain.
- Preserved deliberately: flipping PP mid-stroke would invalidate the tail and corrupt the first-touch cache.
- Policy is documented on `sessions.continuous` and enforced structurally (single read site).

### Type location

- `StrokeSession`, `StrokeDeps`, `StrokeSessions` all live in `stroke-session.ts`.
- `ToolRunnerHost` and `DrawingOps` stay in their existing modules; `StrokeDeps` references them.
- No circular imports: `stroke-session.ts` imports from `draw-tool.ts`, `drawing-ops.ts`, `pixel-perfect-ops.ts`, `sampling-session.ts`. None of those import from `stroke-session.ts`.
- ToolRunner imports `StrokeSession`, `StrokeSessions`, `createStrokeSessions` from `stroke-session.ts`.

### Migration discipline — per-kind with closure adapter

- Commits 3–7 each migrate **one** tool kind, leaving the other four on their existing closures.
- The `drawStart` switch is the single migration seam: at any commit, N cases dispatch through `sessions.<kind>`, the rest use the old closure.
- Satisfies "always see the program working" — full test suite passes after every commit.
- Order (simplest → hardest): liveSample, dragTransform, shapePreview, oneShot, continuous. Continuous is last because PP lives there.

### Dependency category — In-process

All dependencies are in-memory and synchronous. No I/O, no async, no ports/adapters needed. Tests wire fake `DrawingOps`, `SamplingSession`, and `HistoryManager` directly into `StrokeDeps`.

## Testing Decisions

### What makes a good test here

- **Test at the session boundary**: drive tests through the same inputs ToolRunner drives — `spec` object + sequence of `draw(current, previous)` pairs. Assert on canvas state and `EditorEffects`.
- **Don't replay implementation details**: do not hand-craft `Int32Array` stroke batches in unit tests. If a test reads like a ToolRunner internals replay, it's too coupled.
- **Regression-defense focus**: prioritize L-corner revert, PP cache first-touch-wins, snapshot restore for shape preview, `fired` guard for oneShot. These are the invariants where bugs hide.

### Modules tested

- `stroke-session.ts` — five opener-specific test files (one per kind), each covering start-effect emission, mid-stroke behavior, end-effect emission, and kind-specific edge cases.
- `tool-runner.svelte.ts` — existing 30+ tests keep passing; test wiring may update to inject fake `StrokeSessions`, but assertions do not change.

### Per-opener test focus

- **continuous** — pencil L-corner revert under PP on; pencil paints every sample under PP off; `addRecentColor` fires on `start()` when `addsActiveColor` is set; `supportsPixelPerfect: false` bypasses PP even when `deps.pixelPerfect()` returns true; cache first-touch-wins across batches.
- **oneShot** — second `draw()` within the same stroke is ignored via `fired` guard; `capturesHistory: false` skips snapshot push.
- **shapePreview** — anchor stamped on first sample; subsequent samples restore snapshot before `onPreview`; `modifierChanged()` reruns `onPreview` with shift-constrained end; `end()` clears snapshot.
- **dragTransform** — first sample sets anchor with no visual effect; subsequent samples transform from anchor.
- **liveSample** — `start`/`update`/`commit` delegate correctly to fake `SamplingSession`; `end()` returns sampling commit effects; `inputSource` captured from spec.

### Prior art

- `pixel-perfect-ops.test.ts` — the `FakeOps` in-memory `DrawingOps` stub is the template. Commit 2 extracts it to a shared test helper.
- Boundary-driven "input pattern → assert effect" style as in existing canvas tests.

### Fake implementations

- `FakeOps` — in-memory `DrawingOps` with pixel `Map<string, Color>`; already exists in `pixel-perfect-ops.test.ts`, moves to shared helper in Commit 2.
- `FakeSamplingSession` — thin stub recording `start`/`update`/`commit` calls and returning canned effects.
- `FakeHistory` — thin stub recording `pushSnapshot()` calls.

No new frameworks or runners.

### Test retirement

- `pixel-perfect-ops.test.ts` mostly migrates to `stroke-session.continuous.test.ts` in Commit 8. Any residue (pure `dedupAgainstTail` invariants not observable from the session boundary) stays as a focused unit file.
- Migration is gated: session-boundary tests must assert the same L-corner, cache first-touch, and tail seam behaviors before the old file is removed.

## Out of Scope

- **Rust core (`crates/core/`) and all FFI bindings.** `wasm_pixel_perfect_filter` stays intact.
- **`DrawingOps` shape.** All 8 methods remain.
- **`SamplingSession` internals.** Long-press, loupe positioning unchanged.
- **Input layer.** `canvas-interaction.svelte.ts`, `wheel-input.ts`, `keyboard-input.svelte.ts` untouched.
- **ToolRunner public API.** `undo`/`redo`/`clear`/`pushSnapshot` signatures stay identical.
- **EditorState handler methods and `renderVersion` semantics.**
- **Tool implementations in `src/lib/canvas/tools/*`** — except the one-line `supportsPixelPerfect` addition on pencil/eraser.
- **Kernel/filter registry.** Adding new tool kinds still requires editing `DrawTool` (closed union) and the opener dispatch.
- **`StrokeRecord` / replay.** Stroke recording for regression fixtures is a future direction with no current user story.

## Further Notes

- **Why factory-bound openers over module-level functions**: the codebase's factory pattern already establishes the shape for "here's your editor-scoped deps, now give me a thing I can call repeatedly with per-call data." Module-level openers would require passing `deps` on every call, which is noise for a value that never changes within an editor's lifetime.
- **Why `{ tool, drawColor, drawButton }` is passed each call, not captured**: these are genuinely per-stroke — `tool` can differ from the currently-active tool (e.g., middle-click dispatches eyedropper even when pencil is active), `drawColor` resolves to FG or BG based on button, `drawButton` is a per-event value. Hiding them in deps would require reactive accessors that couple `StrokeSessions` to `EditorStore` structure.
- **Risk — `ContinuousTool` schema change**: all continuous tools live under `src/lib/canvas/tools/`; updated in Commit 1. No third-party surface.
- **Risk — PP mid-stroke policy drift**: documented on `sessions.continuous` and enforced structurally (single read site at open). Future contributor must change the session contract to "fix" it.
- **Risk — silent regression from PP test migration**: Commit 8 is gated on session-boundary tests asserting the same L-corner, cache first-touch, and tail seam behaviors before the old file is removed.
