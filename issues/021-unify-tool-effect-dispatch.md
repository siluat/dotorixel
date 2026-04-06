---
title: Unify tool effect dispatch — eliminate DrawResult, add exhaustive check
status: done
created: 2026-04-06
---

## Problem

Tool results flow through a 3-stage pipeline with redundant representations:

1. **DrawResult** (`draw-tool.ts`) — flat object with optional fields (`canvasChanged: boolean`, `colorPick?`, `addRecentColor?`)
2. **translateResult()** (`tool-runner.svelte.ts`) — mechanically repackages DrawResult into a `ToolEffect[]` discriminated union
3. **#applyEffects()** (`editor-state.svelte.ts`) — switch statement applies effects to reactive state

This causes three problems:

- **3-site update tax**: Adding a new effect type requires changes in DrawResult, translateResult, and #applyEffects. Forgetting one site causes no compile error.
- **No exhaustive check**: The switch in #applyEffects has no `default: assertNever()` — an unhandled effect type is silently ignored at runtime.
- **Redundant intermediate type**: DrawResult and ToolEffect carry the same information in different shapes. translateResult is pure boilerplate.

## Proposed Interface

Eliminate DrawResult. Tools return `ToolEffect[]` directly. Add compile-time exhaustive checking via `assertNever`.

### Type definitions

```typescript
// draw-tool.ts — replaces DrawResult and EMPTY_RESULT

/** Effects that drawing tools can produce. */
export type ToolEffect =
  | { readonly type: 'canvasChanged' }
  | { readonly type: 'colorPick'; readonly target: 'foreground' | 'background'; readonly color: Color }
  | { readonly type: 'addRecentColor'; readonly hex: string };

export type ToolEffects = readonly ToolEffect[];

/** Pre-allocated constants for the most common return paths. */
export const CANVAS_CHANGED: ToolEffects = [{ type: 'canvasChanged' }];
export const NO_EFFECTS: ToolEffects = [];
```

```typescript
// tool-runner.svelte.ts — replaces the old ToolEffect union

/** Effects that only ToolRunner can produce (undo/redo infrastructure). */
export type RunnerEffect =
  | { readonly type: 'canvasReplaced'; readonly canvas: WasmPixelCanvas };

/** Union of all effects EditorState must handle. */
export type EditorEffect = ToolEffect | RunnerEffect;
export type EditorEffects = readonly EditorEffect[];
```

### Tool interface change

```typescript
// draw-tool.ts — DrawResult removed, tools return ToolEffects directly

interface DrawTool {
  readonly capturesHistory: boolean;
  onDrawStart(context: ToolContext): ToolEffects;
  onDraw(context: ToolContext, current: CanvasCoords, previous: CanvasCoords | null): ToolEffects;
  onDrawEnd(context: ToolContext): void;
  onModifierChange?(context: ToolContext, current: CanvasCoords): ToolEffects;
}
```

### Usage — common case (90% of draw calls)

```typescript
// pencil-tool.ts
onDraw(ctx, current, previous): ToolEffects {
  // ... pixel logic ...
  return changed ? CANVAS_CHANGED : NO_EFFECTS;
}
```

### Usage — uncommon case (eyedropper)

```typescript
onDraw(ctx, current, previous): ToolEffects {
  // ... pick pixel ...
  return [
    { type: 'colorPick', target: isRightClick ? 'background' : 'foreground', color },
    { type: 'addRecentColor', hex: colorToHex(color) }
  ];
}
```

### Usage — EditorState with exhaustive check

```typescript
#applyEffects(effects: EditorEffects): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'canvasChanged':
        this.renderVersion++;
        break;
      case 'canvasReplaced':
        this.pixelCanvas = effect.canvas;
        // ... viewport clamp ...
        this.renderVersion++;
        break;
      case 'colorPick':
        // ... set foreground/background ...
        break;
      case 'addRecentColor':
        this.recentColors = addRecentColor(this.recentColors, effect.hex);
        break;
      default:
        assertNever(effect);
    }
  }
}
```

### Type boundary enforcement

- `DrawTool` methods return `ToolEffects` — tools cannot produce `canvasReplaced`
- `ToolRunner` public methods return `EditorEffects` — can include `RunnerEffect` from undo/redo
- Adding a new variant to `ToolEffect` or `RunnerEffect` without handling it in `#applyEffects` is a compile error via `assertNever`

## Decision Document

### Type placement

- **ToolEffect, ToolEffects, CANVAS_CHANGED, NO_EFFECTS** live in `draw-tool.ts`, replacing DrawResult and EMPTY_RESULT. Tools already import from this file — no new import paths needed.
- **RunnerEffect, EditorEffect, EditorEffects** live in `tool-runner.svelte.ts`, replacing the old ToolEffect/ToolEffects. This file already imports WasmPixelCanvas (needed for canvasReplaced). EditorState already imports from this file.
- No new files are created. The dependency direction is unchanged: tools → draw-tool, tool-runner → draw-tool, editor-state → tool-runner.

### ToolRunner return type

All ToolRunner public methods return `EditorEffects` uniformly. No per-method type distinction between draw-producing methods (which only yield ToolEffects) and undo/redo (which can yield RunnerEffect). Rationale: splitting return types across 5+ methods adds cognitive load without practical safety gain — canvasReplaced production is an internal ToolRunner concern, not something the return type signature needs to prevent.

### assertNever placement

Defined as a local function inside `editor-state.svelte.ts` — the only file that uses it. If a second use site appears later, extract then. Follows the project rule: "Don't create helpers, utilities, or abstractions for one-time operations."

### Constants are not frozen

`CANVAS_CHANGED` and `NO_EFFECTS` are typed as `readonly ToolEffect[]`. TypeScript strict mode prevents mutation at compile time. No `Object.freeze` — the project is pure TypeScript with no external JS consumers.

### Semantic change: canvasChanged

`DrawResult.canvasChanged: boolean` becomes presence/absence of `{ type: 'canvasChanged' }` in the returned array. "Nothing happened" is expressed by returning `NO_EFFECTS` (empty array) — no object allocation, no sentinel value. Tests verify absence via `effects.some(e => e.type === 'canvasChanged')` returning false.

### Dependency strategy

In-process — pure computation, in-memory state, no I/O. All effects are synchronous. The dependency graph flows one direction with no cycles:

```text
draw-tool.ts             (ToolEffect, ToolEffects, CANVAS_CHANGED, NO_EFFECTS, DrawTool, ToolContext)
  ^
tools/*                  (import from draw-tool.ts only)
  ^
tool-runner.svelte.ts    (RunnerEffect, EditorEffect, EditorEffects; imports ToolEffect from draw-tool.ts)
  ^
editor-state.svelte.ts   (imports EditorEffects from tool-runner; owns assertNever locally)
```

## Commits

### Commit 1: Add ToolEffect types and constants to draw-tool.ts

Purely additive — DrawResult and EMPTY_RESULT remain untouched alongside the new types.

Add to `draw-tool.ts`:

- `ToolEffect` discriminated union with 3 variants: `canvasChanged`, `colorPick`, `addRecentColor`
- `ToolEffects` type alias (`readonly ToolEffect[]`)
- `CANVAS_CHANGED` constant (`[{ type: 'canvasChanged' }]`)
- `NO_EFFECTS` constant (`[]`)

Nothing imports these yet. All tests pass without modification.

### Commit 2: Add exhaustive check to #applyEffects

A standalone safety improvement that is valuable even if the later migration is reverted.

In `editor-state.svelte.ts`:

- Add a local `assertNever(x: never): never` function at file top
- Add `default: assertNever(effect)` to the existing switch in `#applyEffects`

The current switch already handles all 4 variants of the existing ToolEffect type, so `effect` narrows to `never` in the default branch. TypeScript compiles without error. No behavior change — the assertNever is unreachable in correct code but will catch future omissions at compile time.

### Commit 3: Unify tool effect dispatch

The core migration. One atomic commit because the DrawTool interface change forces all implementors to update simultaneously.

**draw-tool.ts**:

- Change `DrawTool` method return types from `DrawResult` to `ToolEffects` (onDrawStart, onDraw, onModifierChange)
- Remove `DrawResult` interface and `EMPTY_RESULT` constant

**pencil-tool.ts**:

- Import `CANVAS_CHANGED`, `NO_EFFECTS`, `ToolEffects` from draw-tool instead of `DrawResult`, `EMPTY_RESULT`
- `onDrawStart`: return `NO_EFFECTS` when no recent color, or `[{ type: 'addRecentColor', hex }]` when adding
- `onDraw`: return `changed ? CANVAS_CHANGED : NO_EFFECTS` instead of `{ canvasChanged: changed }`

**shape-tool.ts**:

- Import `CANVAS_CHANGED`, `NO_EFFECTS`, `ToolEffects` from draw-tool instead of `DrawResult`, `EMPTY_RESULT`
- `drawShape` internal function: return `NO_EFFECTS` for guard, `CANVAS_CHANGED` after drawing
- `onDrawStart`: return `[{ type: 'addRecentColor', hex }]`
- `onDraw` first-click branch: return `changed ? CANVAS_CHANGED : NO_EFFECTS`
- `onModifierChange`: delegates to drawShape (already returns ToolEffects)

**floodfill-tool.ts**:

- Import `NO_EFFECTS`, `CANVAS_CHANGED`, `ToolEffects` from draw-tool instead of `DrawResult`, `EMPTY_RESULT`
- `onDrawStart`: return `[{ type: 'addRecentColor', hex }]`
- `onDraw`: return `NO_EFFECTS` for subsequent drags, `changed ? CANVAS_CHANGED : NO_EFFECTS` for first click

**eyedropper-tool.ts**:

- Import `NO_EFFECTS`, `ToolEffects` from draw-tool instead of `DrawResult`, `EMPTY_RESULT`
- `onDrawStart`: return `NO_EFFECTS`
- `onDraw`: return `NO_EFFECTS` for guards, return `[{ type: 'colorPick', ... }, { type: 'addRecentColor', ... }]` for color pick

**move-tool.ts**:

- Import `NO_EFFECTS`, `CANVAS_CHANGED`, `ToolEffects` from draw-tool instead of `DrawResult`, `EMPTY_RESULT`
- `onDrawStart`: return `NO_EFFECTS`
- `onDraw`: return `NO_EFFECTS` for guards, `CANVAS_CHANGED` after shifting

**tool-runner.svelte.ts**:

- Remove the old `ToolEffect` union type (4 variants) and `ToolEffects` alias
- Remove `translateResult()` function entirely
- Import `ToolEffect`, `ToolEffects` from draw-tool.ts (and remove `DrawResult` from imports)
- Add `RunnerEffect` type (single variant: canvasReplaced)
- Add `EditorEffect = ToolEffect | RunnerEffect` union
- Add `EditorEffects = readonly EditorEffect[]` alias
- Change `ToolRunner` interface: all methods return `EditorEffects` instead of old `ToolEffects`
- `drawStart`, `draw`, `modifierChanged`: pass through tool results directly (no translateResult call)
- `applySnapshot`: return `EditorEffects` (canvasReplaced or canvasChanged)
- `clear`: return `CANVAS_CHANGED` (import from draw-tool)
- Rename internal `EMPTY_EFFECTS` to use `NO_EFFECTS` from draw-tool, or keep as local `EditorEffects` constant

**editor-state.svelte.ts**:

- Import `EditorEffects` from tool-runner instead of `ToolEffects`
- Change `#applyEffects` parameter type from `ToolEffects` to `EditorEffects`
- The assertNever from commit 2 continues to work (EditorEffect has the same 4 variants)

**Test files** (updated in same commit since they would fail otherwise):

- pencil-tool.test.ts: `result.canvasChanged` → `effects.some(e => e.type === 'canvasChanged')`. `result.addRecentColor` → `effects.find(e => e.type === 'addRecentColor')`. `toBeUndefined()` checks → `effects.some(...)` returning false.
- eyedropper-tool.test.ts: `result.colorPick` → `effects.find(e => e.type === 'colorPick')`. `result.canvasChanged` → `effects.some(e => e.type === 'canvasChanged')`. `result.addRecentColor` → `effects.find(e => e.type === 'addRecentColor')`.
- floodfill-tool.test.ts: `result.canvasChanged` → `effects.some(e => e.type === 'canvasChanged')`.
- shape-tool.test.ts: `result.canvasChanged` → `effects.some(e => e.type === 'canvasChanged')`. `result.addRecentColor` → `effects.find(...)`.
- move-tool.test.ts: `result.canvasChanged` → `effects.some(e => e.type === 'canvasChanged')`. `result.addRecentColor` → `effects.some(...)`.
- tool-runner.svelte.test.ts: Already uses `hasEffect(effects, type)` pattern. Update `ToolEffects` type references to `EditorEffects` in local helper types if needed. Minimal changes expected.
- editor-state.svelte.test.ts: No changes — tests use EditorState's public API (handleDrawStart, handleDraw), never reference DrawResult or effect types directly.

## Testing Decisions

### What makes a good test

Tests verify observable outcomes through the public interface, not internal state. A tool test calls `onDraw()` and checks the returned effects array and/or the canvas pixel state. It should not depend on whether the tool internally uses `CANVAS_CHANGED` constant or constructs a fresh array — both represent the same behavior.

### Assertion pattern for effects

Use inline array methods rather than shared helpers:

- **Presence**: `expect(effects.some(e => e.type === 'canvasChanged')).toBe(true)`
- **Absence**: `expect(effects.some(e => e.type === 'colorPick')).toBe(false)`
- **Payload**: `expect(effects.find(e => e.type === 'colorPick')).toEqual({ type: 'colorPick', target: 'foreground', color: RED })`
- **Empty**: `expect(effects).toEqual([])`

The tool-runner tests already have a `hasEffect` local helper; it continues to work unchanged.

### Modules tested

- Each tool's test file validates the tool returns correct `ToolEffect[]` for its scenarios
- tool-runner tests validate effect pass-through and undo/redo effect production
- editor-state tests are unaffected (they test through the public EditorState API)

### Prior art

The tool-runner test file (`tool-runner.svelte.test.ts`) already tests effect arrays with `hasEffect()` and `.find()` patterns. The tool-level test migration follows the same patterns.

## Out of Scope

- **EditorState decomposition**: The `#applyEffects` switch structure is preserved. God Object refactoring is a separate effort.
- **New effect types**: Only the existing 4 effects (canvasChanged, canvasReplaced, colorPick, addRecentColor) are restructured. No new effects added.
- **renderVersion elimination**: The `canvasChanged → this.renderVersion++` pattern is kept as-is. Replacing it with `$derived` is a separate concern.
- **New test coverage**: Only existing tests are migrated to the new interface. No new tests (e.g., direct #applyEffects unit tests) are created.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/draw-tool.ts` | Replaced DrawResult/EMPTY_RESULT with ToolEffect union, ToolEffects alias, CANVAS_CHANGED/NO_EFFECTS constants. Updated DrawTool method signatures. |
| `src/lib/canvas/tool-runner.svelte.ts` | Removed translateResult(). Added RunnerEffect, EditorEffect, EditorEffects. ToolRunner returns EditorEffects. |
| `src/lib/canvas/editor-state.svelte.ts` | Added assertNever exhaustive check. #applyEffects accepts EditorEffects. |
| `src/lib/canvas/tools/pencil-tool.ts` | Returns ToolEffects using CANVAS_CHANGED/NO_EFFECTS constants. |
| `src/lib/canvas/tools/eyedropper-tool.ts` | Returns ToolEffect arrays directly (colorPick + addRecentColor). |
| `src/lib/canvas/tools/floodfill-tool.ts` | Returns ToolEffects using CANVAS_CHANGED/NO_EFFECTS constants. |
| `src/lib/canvas/tools/shape-tool.ts` | Returns ToolEffects using CANVAS_CHANGED/NO_EFFECTS constants. |
| `src/lib/canvas/tools/move-tool.ts` | Returns ToolEffects using CANVAS_CHANGED/NO_EFFECTS constants. |
| `src/lib/canvas/tools/*.test.ts` | Migrated assertions from DrawResult fields to ToolEffect array checks. |
| `src/lib/canvas/tool-runner.svelte.test.ts` | Updated EditorEffects type reference. |

### Key Decisions
- Types placed in existing files (draw-tool.ts, tool-runner.svelte.ts) instead of creating new tool-effect.ts — avoids file bloat, preserves existing import paths.
- All ToolRunner methods return EditorEffects uniformly — simpler interface over per-method type precision.
- assertNever defined locally in editor-state.svelte.ts — single use site, no shared utility needed.

### Notes
- This refactor enables future #1 candidate (EditorState God Object decomposition) by making the effect dispatch boundary explicit and typed.
- No runtime behavior change — all existing 455 tests pass unmodified (assertions migrated).
