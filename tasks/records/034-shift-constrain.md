# 034 — Modifier key: Shift=constrain

## Plan

### Context

Shape tools (line, rectangle, ellipse) constrain angle/ratio when Shift is held during drawing. A standard feature in most drawing apps.

- Line: snap to 8 directions (0°/45°/90°)
- Rectangle: constrain to square
- Ellipse: constrain to circle

Follows existing modifier key patterns (Alt=eyedropper, Space=pan).

### Scope

Shape tools only (line, rectangle, ellipse). Pencil/Eraser Shift-straight-line is a separate feature.

### Steps

#### Step 1: Pure constraint functions — `src/lib/canvas/constrain.ts`

Two pure functions:

**`constrainLine(start, end)`** — snap end to nearest 45° multiple from start
- `|dy| * 2 <= |dx|` → horizontal (y locked to start.y)
- `|dx| * 2 <= |dy|` → vertical (x locked to start.x)
- else → 45° diagonal (`|dx| = |dy| = max(|dx|, |dy|)`)

**`constrainSquare(start, end)`** — force bounding box to square
- `side = max(|dx|, |dy|)`
- Preserve direction: `dx >= 0 ? 1 : -1`, `dy >= 0 ? 1 : -1`

#### Step 2: Constraint function tests — `src/lib/canvas/constrain.test.ts`

- constrainLine: 8 directions (N, NE, E, SE, S, SW, W, NW)
- constrainLine: start === end edge case
- constrainSquare: 4 quadrant directions
- constrainSquare: start === end edge case

#### Step 3: ShapeHandler modification — `src/lib/canvas/shape-handler.ts`

- Add `constrainFn: (start: CanvasCoords, end: CanvasCoords) => CanvasCoords` constructor parameter
- Add `constrain?: boolean` parameter to `draw()`
- When `constrain === true`, apply `current = this.constrainFn(this.#shapeStart, current)` before shape generation

#### Step 4: EditorState modification — `src/lib/canvas/editor-state.svelte.ts`

**State additions:**
- `#isShiftHeld = $state(false)` — Shift key state
- `get isShiftHeld(): boolean` — public getter (same pattern as `isSpaceHeld`)
- `#lastShapeDrawCurrent: CanvasCoords | null = null` — for real-time preview re-trigger

**ShapeHandler constructor updates:**
```text
line: new ShapeHandler(WasmToolType.Line, wasm_interpolate_pixels, constrainLine)
rectangle: new ShapeHandler(WasmToolType.Rectangle, wasm_rectangle_outline, constrainSquare)
ellipse: new ShapeHandler(WasmToolType.Ellipse, wasm_ellipse_outline, constrainSquare)
```

**handleKeyDown Shift handling:**
- `ShiftLeft`/`ShiftRight` → `#isShiftHeld = true`
- Ignore repeat
- During shape tool drawing → re-call `handleDraw` for immediate preview update

**handleKeyUp Shift handling:**
- `ShiftLeft`/`ShiftRight` → `#isShiftHeld = false`
- During shape tool drawing → re-call `handleDraw`

**handleBlur:** reset `#isShiftHeld = false`

**handleDrawStart/handleDrawEnd:** reset `#lastShapeDrawCurrent = null`

**handleDraw:** save `#lastShapeDrawCurrent = current`, pass `this.#isShiftHeld` to shape handler

#### Step 5: EditorState tests — `src/lib/canvas/editor-state.svelte.test.ts`

- Line: horizontal/vertical/45° snap with Shift
- Rectangle: square constraint with Shift
- Ellipse: circle constraint with Shift
- Shift repeat event ignored
- Shift state reset on blur
- Mid-draw Shift toggle → immediate preview update
- Pencil/Eraser unaffected

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/constrain.ts` | New — `constrainLine` (8-way snap) and `constrainSquare` pure functions |
| `src/lib/canvas/constrain.test.ts` | New — 15 tests covering all directions and edge cases |
| `src/lib/canvas/shape-handler.ts` | Added `constrainFn` constructor parameter and `constrain` flag on `draw()` |
| `src/lib/canvas/editor-state.svelte.ts` | Shift key state tracking, preview re-trigger on mid-draw toggle, blur reset |
| `src/lib/canvas/editor-state.svelte.test.ts` | 12 new tests for Shift constrain behavior |
