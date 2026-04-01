# 052 — Fix initial canvas auto-zoom (only shrink-to-fit, not enlarge)

## Plan

### Context

`fit_to_viewport()` allows zoom > 1.0 when the viewport is larger than the canvas display size, causing the canvas to appear enlarged on initial load. For example, a 16×16 canvas (pixel_size=32, display 512×512) in an 800×600 viewport gets fit_zoom=1.17, enlarging it beyond its default size. Initial fit should only shrink, never enlarge.

### Layer decision

`fit_to_viewport()` is a general-purpose geometric operation — "don't enlarge" is a UX policy specific to initial fit. A future manual "fit to viewport" button may legitimately need enlarging. Since pan calculation depends on zoom, the constraint cannot be cleanly applied in the view layer without duplicating centering logic. Solution: add a `max_zoom` parameter to `fit_to_viewport()` so the call site controls the policy explicitly.

### Changes

1. **Rust core** (`crates/core/src/viewport.rs`): Add `max_zoom: f64` parameter to `fit_to_viewport()`, chain `.min(max_zoom)` on fit_zoom calculation.
2. **WASM bindings** (`wasm/src/lib.rs`): Pass `max_zoom: f64` parameter through to core.
3. **EditorState** (`src/lib/canvas/editor-state.svelte.ts`): Add `maxZoom` parameter to `handleFit()` with default `Infinity`.
4. **Editor page** (`src/routes/editor/+page.svelte`): Call `editor.handleFit(1.0)` for initial fit.
5. **Tests** (`crates/core/src/viewport.rs`): Update existing tests with `f64::INFINITY`, add tests for max_zoom=1.0 cap behavior.

### Verification

```text
cd crates/core && cargo test viewport
bun run check
```

## Results

| File | Description |
|------|-------------|
| `crates/core/src/viewport.rs` | Added `max_zoom` parameter to `fit_to_viewport()`, 2 new tests |
| `wasm/src/lib.rs` | Passed `max_zoom` through WASM binding |
| `src/lib/canvas/editor-state.svelte.ts` | Added `maxZoom` parameter to `handleFit()` (default `Infinity`) |
| `src/routes/editor/+page.svelte` | Initial fit calls `handleFit(1.0)` |
| `src/lib/wasm/wasm-viewport.test.ts` | Updated WASM test for new parameter |

### Key Decisions

- Added `max_zoom` parameter instead of hardcoding `.min(1.0)` — keeps `fit_to_viewport` as a general-purpose geometric operation while the call site specifies the policy.
- Policy ("don't enlarge on initial fit") stays in the view layer (`+page.svelte`) — moving it to EditorState was evaluated but would require a setter side effect whose complexity exceeds the testability benefit. The thin integration point (one constant in a one-line call) is an acceptable trade-off.
