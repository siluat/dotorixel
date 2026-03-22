# 012 — Touch drag continuous painting — Mouse Events → Pointer Events migration

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/PixelCanvasView.svelte` | Migrated all mouse event handlers to Pointer Events API; added `touch-action: none`, multi-touch guard, `pointercancel` handler |
| `tasks/todo.md` | Added Code Health section with `svelte-check` errors/warnings found during verification |

### Key Decisions

- Pointer Events API over adding separate touch handlers — unified API inherits `MouseEvent`, single handler covers mouse/touch/stylus
- Multi-touch guard (`if (interaction.type !== 'idle') return`) at `pointerDown` entry — prevents second finger from disrupting active stroke
- `pointercancel` reuses `handlePointerUp` — keeps interaction state clean when system gestures cancel touch

### Notes

- Touch implicit capture means `pointerleave` won't fire during touch drag — drawing ends only on `pointerup`/`pointercancel`
- Touch-based panning (2-finger pan/zoom) is not yet supported — touch is drawing-only for now
