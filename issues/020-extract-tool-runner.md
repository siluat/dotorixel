---
title: Extract ToolRunner from EditorState to deepen tool dispatch and history management
status: open
created: 2026-04-06
---

## Problem

EditorState (432 lines) is a god object that owns 5 responsibilities: tool dispatch, history management, color state, viewport state, and keyboard coordination. The tightest coupling is between tool dispatch and history management — `handleDrawStart` checks `capturesHistory`, pushes a snapshot, builds `ToolContext`, calls the tool, and applies `DrawResult` all in one method.

This creates several friction points:

- **Adding a new tool requires editing EditorState.** The `#tools` record, all tool imports, and ToolContext construction live in EditorState. A new tool means touching a file that also manages viewport, colors, and keyboard.
- **History timing is entangled with tool dispatch.** `capturesHistory` check and `push_snapshot` happen inside `handleDrawStart`, mixing "when to record history" with "how to start drawing." Tools have no control over snapshot timing.
- **ToolContext is rebuilt on every call.** `#buildContext()` assembles 7 fields from EditorState's internal state. This glue code (drawColor resolution from button + fg/bg colors, isShiftHeld wiring) is repeated boilerplate.
- **DrawResult application is scattered.** `#applyDrawResult()` interprets 3 side-effect fields (`canvasChanged`, `colorPick`, `addRecentColor`) and mutates EditorState's reactive state. This UI-facing side-effect routing is mixed into the tool execution path.
- **Draw state variables are spread across EditorState.** `#isDrawing`, `#drawButton`, `#activeDrawColor`, `#lastDrawCurrent` are tool-execution temporaries that sit alongside viewport and color state.

## Proposed Interface

A `createToolRunner` factory returns a `ToolRunner` that owns tool dispatch, draw state, and history. EditorState supplies live values via a `ToolRunnerHost` query interface and interprets returned `ToolEffect` data.

### ToolRunnerHost (EditorState implements)

```typescript
interface ToolRunnerHost {
  readonly pixelCanvas: WasmPixelCanvas;
  readonly foregroundColor: Color;
  readonly backgroundColor: Color;
}
```

Read-only queries only. No callbacks — side effects flow back as return values. `isShiftHeld` is excluded to avoid a circular dependency with KeyboardInput (see Decision Document).

### ToolEffect (replaces DrawResult for caller communication)

```typescript
type ToolEffect =
  | { readonly type: 'canvasChanged' }
  | { readonly type: 'canvasReplaced'; readonly canvas: WasmPixelCanvas }
  | { readonly type: 'colorPick'; readonly target: 'foreground' | 'background'; readonly color: Color }
  | { readonly type: 'addRecentColor'; readonly hex: string };

type ToolEffects = readonly ToolEffect[];
```

Discriminated union replaces the boolean+optional fields of `DrawResult`. `canvasReplaced` carries a new `WasmPixelCanvas` for dimension-changing undo/redo.

### ToolRunner

```typescript
interface ToolRunner {
  readonly isDrawing: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  drawStart(button: number): ToolEffects;
  draw(current: CanvasCoords, previous: CanvasCoords | null): ToolEffects;
  drawEnd(): ToolEffects;
  modifierChanged(): ToolEffects;

  undo(): ToolEffects;
  redo(): ToolEffects;
  clear(): ToolEffects;
  pushSnapshot(): void;

  connectModifiers(modifiers: { isShiftHeld(): boolean }): void;
}

function createToolRunner(host: ToolRunnerHost, shared: SharedState): ToolRunner;
```

### Usage in EditorState

```typescript
handleDrawStart = (button: number): void => {
  if (this.#keyboard.isShortcutHintsVisible) return;
  this.#applyEffects(this.#toolRunner.drawStart(button));
};

handleDraw = (current: CanvasCoords, previous: CanvasCoords | null): void => {
  if (this.#keyboard.isShortcutHintsVisible) return;
  this.#applyEffects(this.#toolRunner.draw(current, previous));
};

handleDrawEnd = (): void => {
  this.#applyEffects(this.#toolRunner.drawEnd());
  const restored = this.#keyboard.consumePendingToolRestore();
  if (restored !== null) this.activeTool = restored;
};

#applyEffects(effects: ToolEffects): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'canvasChanged': this.renderVersion++; break;
      case 'canvasReplaced':
        this.pixelCanvas = effect.canvas;
        const clamped = this.viewportState.viewport.clamp_pan(
          effect.canvas.width, effect.canvas.height,
          this.viewportSize.width, this.viewportSize.height
        );
        this.viewportState = { ...this.viewportState, viewport: clamped };
        this.renderVersion++;
        break;
      case 'colorPick':
        if (effect.target === 'foreground') this.foregroundColor = effect.color;
        else this.backgroundColor = effect.color;
        break;
      case 'addRecentColor':
        this.recentColors = addRecentColor(this.recentColors, effect.addRecentColor);
        break;
    }
  }
}
```

## Decision Document

### Dependency strategy

**In-process.** All dependencies are in-memory computation with no I/O.

ToolRunner reads external state through the `ToolRunnerHost` interface (queries only) and writes side effects as `ToolEffects` return values. This asymmetry — read via interface, write via data — keeps ToolRunner framework-independent in its communication pattern.

| Dependency | Strategy |
|---|---|
| `WasmPixelCanvas` | Borrowed via `host.pixelCanvas` getter |
| `WasmHistoryManager` | Owned by ToolRunner (created internally) |
| Colors (fg/bg) | Read via `host.foregroundColor` / `host.backgroundColor` |
| Shift key state | Provided via `connectModifiers` after construction |
| Active tool | Read via `shared.activeTool` (SharedState) |
| Tool instances | Owned by ToolRunner (created in factory) |
| Draw state | Owned by ToolRunner |
| Side effects | Returned as `ToolEffects` |

### canvasReplaced effect

When undo/redo changes canvas dimensions, ToolRunner creates a new `WasmPixelCanvas` via `WasmPixelCanvas.from_pixels()` and returns it in a `canvasReplaced` effect. EditorState handles the reference swap (`this.pixelCanvas = effect.canvas`) and viewport clamping. For same-dimension undo/redo, ToolRunner calls `restore_pixels()` directly on the host canvas and returns `canvasChanged`.

This asymmetry (direct mutation for same-dimension, new object for cross-dimension) is inherent to the WASM API — `WasmPixelCanvas` cannot be resized in-place.

### Circular dependency resolution — connectModifiers

ToolRunner needs `isShiftHeld()` (from KeyboardInput), and KeyboardInput needs `isDrawing()` (from ToolRunner). To avoid `null!` lazy closures, `isShiftHeld` is excluded from `ToolRunnerHost` and provided via a separate `connectModifiers()` call after both objects are created:

```text
1. Create ToolRunner (no isShiftHeld yet)
2. Create KeyboardInput (references toolRunner.isDrawing)
3. toolRunner.connectModifiers({ isShiftHeld: () => keyboard.isShiftHeld })
```

Three explicit steps. No null assertions. Clear initialization order.

### File format

ToolRunner is a `.svelte.ts` file. `canUndo`/`canRedo` use `$derived` for reactive UI binding. This is consistent with `EditorState.svelte.ts` and `SharedState.svelte.ts`. Svelte runtime decoupling is deferred to a future architecture task.

### Type location

`ToolEffect`, `ToolEffects`, and `ToolRunnerHost` are defined in `tool-runner.svelte.ts` alongside the implementation. They are not broadly shared — only EditorState imports them.

### Interfaces not changed

`DrawTool`, `ToolContext`, and `DrawResult` are unchanged. ToolRunner translates `DrawResult` into `ToolEffects` internally. Individual tool implementations are not modified.

## Commits

### Commit 1: Add ToolRunner types and scaffold

Create `tool-runner.svelte.ts` with type definitions only:

- `ToolEffect` discriminated union (4 variants: `canvasChanged`, `canvasReplaced`, `colorPick`, `addRecentColor`)
- `ToolEffects` type alias
- `ToolRunnerHost` interface (3 read-only properties: `pixelCanvas`, `foregroundColor`, `backgroundColor`)
- `ToolRunner` interface (3 read-only properties + 8 methods + `connectModifiers`)
- `createToolRunner` function signature with a stub body (e.g., `throw new Error('not implemented')`)

Nothing imports this file yet. All tests pass. This establishes the API contract before writing implementation.

### Commit 2: Implement createToolRunner

Full implementation of the `createToolRunner` factory in `tool-runner.svelte.ts`:

- **Tool registry**: Import all 8 tool modules (pencil, eraser, line, rectangle, ellipse, floodfill, eyedropper, move) and create the `Record<ToolType, DrawTool>` tool map internally.
- **Draw state**: `isDrawing` (`$state`), `drawButton`, `activeDrawColor` (`WasmColor | null`), `lastDrawCurrent` (`CanvasCoords | null`).
- **WasmColor derivation**: Create `WasmColor` from `host.foregroundColor`/`host.backgroundColor` using `$derived`.
- **ToolContext building**: Internal function that assembles `ToolContext` from host queries, draw state, and the connected `isShiftHeld` modifier.
- **DrawResult → ToolEffects translation**: Internal function that converts a `DrawResult` into a `ToolEffects` array.
- **History management**: `WasmHistoryManager` created and owned internally. History version tracked with `$state` for `canUndo`/`canRedo` `$derived` reactivity.
- **Draw lifecycle methods**:
  - `drawStart(button)`: Resolve draw color from button (left=fg, right=bg). Check `capturesHistory` → push snapshot. Call `tool.onDrawStart(ctx)`. Translate and return effects.
  - `draw(current, previous)`: Track `lastDrawCurrent`. Call `tool.onDraw(ctx, current, previous)`. Translate and return effects.
  - `drawEnd()`: Call `tool.onDrawEnd(ctx)`. Reset draw state. Return empty effects.
  - `modifierChanged()`: Guard (not drawing || no lastDrawCurrent || no onModifierChange). Call `tool.onModifierChange(ctx, lastDrawCurrent)`. Translate and return effects.
- **History methods**:
  - `undo()`: Guard (is drawing → return empty). Pop from history. If same dimensions, call `restore_pixels()` on host canvas, return `canvasChanged`. If dimensions changed, create new `WasmPixelCanvas.from_pixels()`, return `canvasReplaced` with the new canvas.
  - `redo()`: Same logic as undo but using `history.redo()`.
  - `clear()`: Push snapshot. Call `host.pixelCanvas.clear()`. Return `canvasChanged`.
  - `pushSnapshot()`: Push snapshot. No effects returned (reactive `canUndo`/`canRedo` update via `$state` version bump).
- **connectModifiers**: Store the provided `isShiftHeld` function for use in ToolContext building.

This file is self-contained. EditorState does not reference it yet. Verify compilation.

### Commit 3: Migrate EditorState to delegate to ToolRunner

Replace EditorState's draw and history logic with ToolRunner delegation:

**Add to EditorState:**

- `#toolRunner` field (created in constructor via `createToolRunner`)
- Constructor wiring: create ToolRunner with host object (getters for `pixelCanvas`, `foregroundColor`, `backgroundColor`), then create KeyboardInput (referencing `toolRunner.isDrawing`), then call `toolRunner.connectModifiers` with keyboard's `isShiftHeld`.
- `#applyEffects(effects: ToolEffects)` method — switch on effect type:
  - `canvasChanged` → `renderVersion++`
  - `canvasReplaced` → swap `pixelCanvas`, clamp viewport, `renderVersion++`
  - `colorPick` → update foreground or background color
  - `addRecentColor` → update recent colors list

**Migrate methods:**

- `handleDrawStart` → guard + `this.#applyEffects(this.#toolRunner.drawStart(button))`
- `handleDraw` → guard + `this.#applyEffects(this.#toolRunner.draw(current, previous))`
- `handleDrawEnd` → `this.#applyEffects(this.#toolRunner.drawEnd())` + keyboard tool restore
- `notifyModifierChange` callback → `this.#applyEffects(this.#toolRunner.modifierChanged())`
- `handleUndo` → `this.#applyEffects(this.#toolRunner.undo())`
- `handleRedo` → `this.#applyEffects(this.#toolRunner.redo())`
- `handleClear` → `this.#applyEffects(this.#toolRunner.clear())`
- `handleResize` → `this.#toolRunner.pushSnapshot()` + existing resize/clamp logic
- `canUndo`/`canRedo` → `$derived.by(() => this.#toolRunner.canUndo)` / `canRedo`
- `isDrawing` reads in keyboard host → `this.#toolRunner.isDrawing`

**Remove from EditorState:**

- All tool imports (`pencilTool`, `eraserTool`, `createShapeTool`, etc.)
- WASM tool-related imports (`WasmToolType`, `wasm_interpolate_pixels`, `wasm_rectangle_outline`, `wasm_ellipse_outline`)
- Constrain imports (`constrainLine`, `constrainSquare`)
- `#tools` record
- `#buildContext()`
- `#applyDrawResult()`
- `#applySnapshot()`
- Draw state: `#isDrawing`, `#drawButton`, `#activeDrawColor`, `#lastDrawCurrent`
- History state: `#history`, `#historyVersion`
- WasmColor derivations: `#wasmForegroundColor`, `#wasmBackgroundColor`

**Safety net:** 42 existing `editor-state.svelte.test.ts` tests verify behavior is preserved. EditorState's public API is unchanged — no downstream callers (CanvasInteraction, KeyboardInput, UI components) are affected.

### Commit 4: Add ToolRunner boundary tests

Create `tool-runner.svelte.test.ts` with mock `ToolRunnerHost`:

- **Draw lifecycle effects**: Pencil stroke produces `canvasChanged` + `addRecentColor`. Eyedropper produces `colorPick`, no `canvasChanged`. Floodfill single-click produces `canvasChanged`, drag is no-op. Shape tool draw → modifierChanged → drawEnd produces correct effects. Move tool produces `canvasChanged`.
- **History behavior**: `drawStart` pushes snapshot for `capturesHistory` tools. Eyedropper `drawStart` skips snapshot. `undo()`/`redo()` returns `canvasChanged`. `clear()` returns `canvasChanged`.
- **canvasReplaced**: Push snapshot, resize canvas externally (host returns larger canvas), undo → `canvasReplaced` effect with original-sized canvas.
- **Guard behavior**: `draw()` returns empty when not drawing. `modifierChanged()` returns empty when not drawing. `undo()`/`redo()` returns empty when drawing.
- **connectModifiers**: `isShiftHeld` correctly propagated to shape tool constraint.

Test pattern follows existing tool tests: create `WasmPixelCanvas`, construct mock host, call ToolRunner methods, assert on returned effects and canvas state.

## Testing Decisions

### What makes a good ToolRunner test

Tests verify **observable behavior through the public interface** — returned `ToolEffects` and canvas pixel state. They do not assert on internal state (draw variables, history version counters). Tests should survive internal refactors of ToolRunner.

### Modules tested

- `createToolRunner` (new) — boundary tests with mock host
- `EditorState` (existing) — 42 tests unchanged, serve as integration tests verifying ToolRunner + applyEffects + keyboard wiring work end-to-end

### Prior art

- Existing tool tests (`tools/shape-tool.test.ts`, etc.) — create a `ToolContext` directly and call `DrawTool` methods. ToolRunner tests follow the same pattern but at a higher level: create a `ToolRunnerHost` and call `ToolRunner` methods.
- `editor-state.svelte.test.ts` — uses `// @vitest-environment happy-dom` for Svelte runes. ToolRunner tests use the same environment.

## Out of Scope

- **DrawTool interface changes** — individual tool files are not modified
- **ToolContext interface changes** — shape stays the same, ToolRunner builds it internally
- **KeyboardInputHost interface changes** — same 8 callbacks, only implementations change inside EditorState
- **Svelte runes removal** — deferred to architecture candidate #3 (Svelte runtime separation)
- **handleLongPress** — stays in EditorState, independent of tool dispatch lifecycle
- **New tool additions** — this refactor extracts existing tools, does not add new ones
- **WASM abstraction layer** — deferred to architecture candidate #2
