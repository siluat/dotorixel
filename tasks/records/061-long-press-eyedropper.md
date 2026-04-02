# 061 — Eyedropper via long-press (touch devices)

## Plan

### Context

Todo item: "Eyedropper via Option+click (desktop) / long-press (touch devices)"

Already implemented: eyedropper tool (toolbar, keyboard shortcut `I`), Alt/Option+click temporary activation (desktop), core eyedropper logic (left-click → foreground, right-click → background, skip transparent, recent colors, no undo).

Remaining work: long-press (~400ms) on touch devices to temporarily activate eyedropper.

### Design

- **Timer location**: CanvasInteraction — already distinguishes touch vs mouse and manages pending touch mechanism
- **Eyedropper logic location**: EditorState — new `handleLongPress` method
- **No draw lifecycle**: Long-press fires from timer callback, directly picks color without going through handleDrawStart/handleDraw/handleDrawEnd. No tool switching — one-shot color pickup
- **`onLongPress` returns `boolean`**: `true` = gesture consumed (transition to idle), `false` = pending touch preserved (normal tap/draw flow continues). Prevents long-press from interfering with normal eyedropper tap when eyedropper is already selected

### Implementation Steps

1. **CanvasInteraction** — Add `LONG_PRESS_DELAY = 400`, `onLongPress` callback (returns boolean), timer management helpers. Start timer on touch pointerDown, clear on move/up/pinch/leave/blur
2. **CanvasInteraction tests** — Fake timers, 10 test cases covering fire/cancel/boolean-return scenarios
3. **EditorState** — Add `handleLongPress(coords, button): boolean` method
4. **EditorState tests** — 7 test cases covering color pick, transparent pixel, tool preservation, return values
5. **PixelCanvasView** — Add `onLongPress` prop, wire to interaction callbacks
6. **Editor pages (4 instances)** — Wire `onLongPress={editor.handleLongPress}`

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/canvas-interaction.svelte.ts` | Added `LONG_PRESS_DELAY`, `onLongPress` callback, timer management (start/clear) wired into all event handlers |
| `src/lib/canvas/canvas-interaction.svelte.test.ts` | 10 new tests: timer fire, boolean return, cancellation by move/up/pinch/leave/blur, mouse/pen exclusion |
| `src/lib/canvas/editor-state.svelte.ts` | Added `handleLongPress(coords, button): boolean` — one-shot color pickup without draw lifecycle |
| `src/lib/canvas/editor-state.svelte.test.ts` | 7 new tests: foreground/background pick, transparent pixel, recent colors, tool preservation, return values, no undo |
| `src/lib/canvas/PixelCanvasView.svelte` | Added `onLongPress` prop, wired to `createCanvasInteraction` callbacks |
| `src/routes/editor/+page.svelte` | Wired `onLongPress={editor.handleLongPress}` (2 instances: desktop + mobile layout) |
| `src/routes/pixel/+page.svelte` | Wired `onLongPress={editor.handleLongPress}` |
| `src/routes/pebble/+page.svelte` | Wired `onLongPress={editor.handleLongPress}` |

### Key Decisions

- `onLongPress` returns `boolean` to prevent gesture loss when handler declines (e.g., eyedropper already active). `true` = consume gesture, `false` = preserve pending touch for normal tap/draw flow.
- `handleLongPress` bypasses the draw lifecycle (no `handleDrawStart`/`handleDraw`/`handleDrawEnd`). Timer fires asynchronously — re-entering drawing state would risk undo snapshot side effects. Direct color pickup is simpler and correct.
- Timer only starts for `pointerType === 'touch'`. Mouse and pen/stylus are excluded — they have Alt/Option+click instead.
