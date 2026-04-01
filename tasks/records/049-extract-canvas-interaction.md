# 049 — Extract Canvas Interaction State Machine

## Plan

### Context

The interaction logic in `PixelCanvasView.svelte` (pointer tracking, state transitions, draw/pinch/pan detection) is coupled to DOM event handlers, making unit testing impossible. Extract it into a testable `.svelte.ts` module. Gesture detection is a UI-layer concern, so Svelte runes (`$state`) are used to integrate naturally with Svelte reactivity.

### Implementation Plan

#### 1. New module: `src/lib/canvas/canvas-interaction.svelte.ts`

Follows the `EditorState` pattern (`.svelte.ts` + `$state`). The reactive `interactionType` field is exposed as `$state` so components can track it directly via `$derived`.

**Interface:**

```typescript
export type InteractionType = 'idle' | 'drawing' | 'panning' | 'pinching';

export interface CanvasInteractionOptions {
  screenToCanvas: (localX: number, localY: number) => CanvasCoords;
  getViewport: () => WasmViewport;
  isSpaceHeld: () => boolean;
}

export interface CanvasInteractionCallbacks {
  onDrawStart: () => void;
  onDraw: (current: CanvasCoords, previous: CanvasCoords | null) => void;
  onDrawEnd: () => void;
  onViewportChange: (viewport: WasmViewport) => void;
}

export interface CanvasInteraction {
  pointerDown(id: number, x: number, y: number, pointerType: string, button: number): void;
  pointerMove(x: number, y: number): void;
  windowPointerMove(id: number, x: number, y: number, buttons: number): void;
  pointerUp(id: number): void;
  pointerLeave(x: number, y: number): void;
  blur(): void;
  readonly interactionType: InteractionType;
}

export function createCanvasInteraction(
  options: CanvasInteractionOptions,
  callbacks: CanvasInteractionCallbacks
): CanvasInteraction;
```

**Coordinate system:** All `x, y` parameters are canvas-local coordinates (clientX/Y minus canvas.getBoundingClientRect()). The component converts before calling.

**Internal state moved from PixelCanvasView:**
- `activePointers: Map<number, {x, y}>`
- `interaction: InteractionMode` (idle/drawing/panning/pinching tagged union)
- `MIN_PINCH_DISTANCE = 10`

**Functions moved:**
- `pointerDistance()`, `pointerMidpoint()`, `getTwoPointers()`, `tryEnterPinching()`, `drawAt()` — internal helpers
- All pointer event handlers → corresponding methods on the returned object

#### 2. Modify PixelCanvasView.svelte

Remove interaction logic. The component's role reduces to:
- DOM events → canvas-local coordinate conversion (getBoundingClientRect)
- State machine method calls
- `$derived` cursor style from `canvasInteraction.interactionType`
- `event.preventDefault()` for middle click
- Render effect + wheel handler (unchanged)

#### 3. Tests: `src/lib/canvas/canvas-interaction.svelte.test.ts`

Follows `editor-state.svelte.test.ts` pattern (`.svelte.test.ts` for runes support).

**Test suites (existing behavior verification):**

Drawing (mouse):
- Left click → onDrawStart + onDraw called
- Pointer move → onDraw with previous coords
- Duplicate coordinates → onDraw not called
- Pointer up → onDrawEnd
- Pointer leave → final onDraw + onDrawEnd
- Right click → no effect
- Non-idle state → ignore new left click

Panning:
- Middle click → interactionType === 'panning'
- Space + left click → interactionType === 'panning'
- Window pointer move → onViewportChange
- buttons === 0 → return to idle
- Pointer up → return to idle

Pinching (multi-touch):
- Two pointers → interactionType === 'pinching'
- Drawing + 2nd pointer → onDrawEnd + pinching
- Window pointer move during pinch → onViewportChange
- Pointer up → return to idle
- Distance < 10px → deferred pinch entry
- Deferred then move to sufficient distance → enter pinching
- Pointer leave during pinch → ignored

Edge cases:
- Blur → clear pointers + idle
- Drawing + blur → onDrawEnd + idle

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/canvas/canvas-interaction.svelte.ts` | New — state machine module ($state) |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | New — tests |
| `src/lib/canvas/PixelCanvasView.svelte` | Remove interaction logic, use module |

### Verification

1. `bun run check` — type check passes
2. `bun run test` — existing 206 tests + new tests all pass
3. Manual test: mouse drawing, middle-click pan, space+drag pan, trackpad pinch zoom, mouse wheel zoom — all work as before

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/canvas-interaction.svelte.ts` | New — interaction state machine extracted from PixelCanvasView; uses `$state` for reactive `interactionType` |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | New — 19 tests covering drawing, panning, and edge cases |
| `src/lib/canvas/PixelCanvasView.svelte` | Simplified — interaction logic removed, delegates to `createCanvasInteraction`; retains rendering and wheel handling |
| `tasks/todo.md` | Added refactoring task + pinch-zoom dependency note |
| `tasks/progress.md` | Updated for current task |

### Key Decisions

- Used `.svelte.ts` with `$state` (EditorState pattern) instead of plain `.ts` with callbacks. `interactionType` needs to be reactive for `$derived` cursor styling — using `$state` avoids an extra `onInteractionChange` callback.
- Extracted from main branch (no pinching). Pinching will be added when the pinch-zoom task is reworked on top of this refactoring.
- API uses canvas-local coordinates (clientX/Y minus getBoundingClientRect). The component handles the DOM conversion.
- Plan included pinching test suites, but since main has no pinching code, those tests are deferred to the pinch-zoom rework task.

### Notes

- PR #81 (`feat/touch-pinch-zoom-pan`) will be superseded by a new PR after this refactoring merges. The pinch-zoom feature + first-pixel bug fix will be implemented using the extracted module. The fix approach: defer first pixel for touch input via `pendingCoords` — store coords on touch pointerdown without calling onDrawStart/onDraw, commit on first pointermove or pointerup (tap), discard on 2nd pointer (pinch).
