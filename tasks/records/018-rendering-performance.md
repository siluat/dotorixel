# 018 — Rendering performance — Canvas2D vs Metal FPS at various canvas sizes

## Results

| File | Description |
|------|-------------|
| `src/routes/bench/+page.svelte` | Web benchmark page (Canvas2D) |
| `src/routes/bench/+page.ts` | Dev-only guard (404 in production) |
| `apple/Dotorixel/Benchmark/RenderBenchmarkView.swift` | Apple benchmark view (`#if DEBUG`) |
| `apple/Dotorixel/Rendering/PixelGridRenderer.swift` | Added `benchmarkDraw(in:)` method (`#if DEBUG`) |
| `apple/Dotorixel/ContentView.swift` | Debug benchmark entry point (toolbar + sheet) |
| `docs/comparison/rendering-performance.en.md` | Results document (English) |
| `docs/comparison/rendering-performance.ko.md` | Results document (Korean) |

### Key Decisions

- Pure JS mock for web benchmark instead of WASM — isolates rendering cost from WASM overhead
- Metal `benchmarkDraw(in:)` uses production code path + `waitUntilCompleted()` for GPU sync — fair comparison
- Pixel art canvas size research added as appendix — contextualizes when optimization will matter

### Notes

- Canvas2D worst case: 3.3ms (128×128 @ 16×). Metal worst case: 0.33ms. Both well within 60fps budget
- Canvas2D is O(n²) on pixel count; Metal is O(1). Crossover at ~32×32
- 256×256 extension: Canvas2D ~13ms (near frame budget). 640+ requires WebGL2 or viewport culling
- `performance.now()` has 0.1ms resolution limit — sub-0.1ms Canvas2D frames show as 0.000ms
