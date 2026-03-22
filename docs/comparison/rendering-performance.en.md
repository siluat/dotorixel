# Rendering Performance Comparison: Canvas2D vs Metal

## How to Reproduce

Both benchmark tools are dev/debug-only and excluded from production builds.

### Web (Canvas2D)

```bash
bun run dev
# Open http://localhost:5173/bench
# Click "Run Benchmark" → "Copy as Markdown"
```

- **Source**: `src/routes/bench/+page.svelte`
- **Guard**: `src/routes/bench/+page.ts` returns 404 in production (`$app/environment.dev` check)
- **Measures**: `renderPixelCanvas()` from `src/lib/canvas/renderer.ts`

### Apple (Metal)

1. Open Xcode, build in **Debug** scheme
2. Tap **"Benchmark"** in the toolbar → sheet opens
3. Tap **"Run Benchmark"** → **"Copy as Markdown"**

- **Source**: `apple/Dotorixel/Benchmark/RenderBenchmarkView.swift` (`#if DEBUG`)
- **Renderer method**: `PixelGridRenderer.benchmarkDraw(in:)` (`#if DEBUG`)
- **Entry point**: `ContentView.swift` toolbar button (`#if DEBUG`)

## Methodology

Both benchmarks use the same approach: forced repeated rendering with timing measurement.

- **Warmup**: 10 frames (JIT compilation, GPU pipeline stabilization)
- **Measurement**: 100 frames per configuration
- **Statistics**: median, P95, theoretical max FPS (1000 / median_ms)
- **Viewport**: 512x512 pixels
- **Grid**: enabled (worst case — all three render stages active)
- **Canvas data**: all pixels filled with semi-transparent color (RGBA 128, 64, 192, 180)
  - Forces checkerboard + pixel blending + grid overlay on every frame

### Test Matrix

5 canvas sizes x 3 zoom levels = 15 configurations:

| Canvas Size | Zoom Levels |
|------------|-------------|
| 8x8, 16x16, 32x32, 64x64, 128x128 | 1x, 8x, 16x |

### Effective Pixel Size

`effectivePixelSize = round(pixelSize * zoom)` where `pixelSize = floor(512 / canvasSize)`.

| Canvas | pixelSize | @1x | @8x | @16x |
|--------|-----------|-----|-----|------|
| 8x8 | 64 | 64 | 512 | 1024 |
| 16x16 | 32 | 32 | 256 | 512 |
| 32x32 | 16 | 16 | 128 | 256 |
| 64x64 | 8 | 8 | 64 | 128 |
| 128x128 | 4 | 4 | 32 | 64 |

### Platform Differences

- **Canvas2D** (web): Synchronous API. `performance.now()` before/after each `renderPixelCanvas()` call. Each frame allocates a new `OffscreenCanvas` for pixel compositing.
- **Metal** (Apple native): Asynchronous GPU pipeline. CPU timing includes `commandBuffer.commit()` + `waitUntilCompleted()`. GPU timing from `commandBuffer.gpuStartTime`/`gpuEndTime`. Single fullscreen quad — all rendering logic in the fragment shader.

## Test Environment

| | Web (Canvas2D) | Apple (Metal) |
|---|---|---|
| **Device** | MacBook Air M2, 16 GB | MacBook Air M2, 16 GB |
| **OS** | macOS 26.3.1 | macOS 26.3.1 |
| **Runtime** | SvelteKit dev server (Vite) | Xcode DEBUG build |
| **GPU** | Apple M2 (Metal 4) | Apple M2 (Metal 4) |
| **Display Scale** | 2x (Retina) | 2x (Retina) |

## Results

### Web — Canvas2D

> Note: `performance.now()` resolution is limited to 0.1ms (Spectre mitigation). Frames faster than the timer resolution show as 0.000ms; their Max FPS is reported as ">10000".

| Canvas | Zoom | Effective px | Median (ms) | P95 (ms) | Max FPS |
|--------|------|-------------|-------------|----------|----------|
| 8×8 | 1× | 64 | 0.100 | 0.200 | 10000 |
| 8×8 | 8× | 512 | 0.000 | 0.100 | >10000 |
| 8×8 | 16× | 1024 | 0.000 | 0.100 | >10000 |
| 16×16 | 1× | 32 | 0.100 | 0.200 | 10000 |
| 16×16 | 8× | 256 | 0.100 | 0.200 | 10000 |
| 16×16 | 16× | 512 | 0.100 | 0.200 | 10000 |
| 32×32 | 1× | 16 | 0.400 | 0.500 | 2500 |
| 32×32 | 8× | 128 | 0.200 | 0.300 | 5000 |
| 32×32 | 16× | 256 | 0.200 | 0.300 | 5000 |
| 64×64 | 1× | 8 | 1.400 | 1.500 | 714 |
| 64×64 | 8× | 64 | 0.900 | 1.000 | 1111 |
| 64×64 | 16× | 128 | 0.900 | 1.000 | 1111 |
| 128×128 | 1× | 4 | 1.600 | 1.800 | 625 |
| 128×128 | 8× | 32 | 3.300 | 3.500 | 303 |
| 128×128 | 16× | 64 | 3.300 | 3.600 | 303 |

### Apple — Metal

| Canvas | Zoom | Effective px | CPU Median (ms) | CPU P95 (ms) | GPU Median (ms) | GPU P95 (ms) | Max FPS |
|--------|------|-------------|-----------------|--------------|-----------------|--------------|----------|
| 8×8 | 1× | 64 | 0.249 | 0.288 | 0.063 | 0.063 | 4023 |
| 8×8 | 8× | 512 | 0.245 | 0.284 | 0.063 | 0.068 | 4082 |
| 8×8 | 16× | 1024 | 0.257 | 0.284 | 0.064 | 0.068 | 3883 |
| 16×16 | 1× | 32 | 0.262 | 0.278 | 0.065 | 0.071 | 3823 |
| 16×16 | 8× | 256 | 0.264 | 0.294 | 0.066 | 0.072 | 3788 |
| 16×16 | 16× | 512 | 0.257 | 0.297 | 0.064 | 0.071 | 3890 |
| 32×32 | 1× | 16 | 0.326 | 0.369 | 0.071 | 0.077 | 3067 |
| 32×32 | 8× | 128 | 0.307 | 0.354 | 0.070 | 0.071 | 3257 |
| 32×32 | 16× | 256 | 0.226 | 0.252 | 0.063 | 0.064 | 4424 |
| 64×64 | 1× | 8 | 0.231 | 0.261 | 0.063 | 0.063 | 4328 |
| 64×64 | 8× | 64 | 0.226 | 0.239 | 0.063 | 0.064 | 4424 |
| 64×64 | 16× | 128 | 0.227 | 0.252 | 0.063 | 0.064 | 4404 |
| 128×128 | 1× | 4 | 0.207 | 0.260 | 0.048 | 0.063 | 4821 |
| 128×128 | 8× | 32 | 0.226 | 0.251 | 0.063 | 0.064 | 4424 |
| 128×128 | 16× | 64 | 0.226 | 0.244 | 0.063 | 0.064 | 4424 |

## Analysis

### Scaling Behavior

**Canvas2D** scales with canvas size (pixel count), not zoom level:

| Canvas | 1× (ms) | 8× (ms) | 16× (ms) |
|--------|---------|---------|----------|
| 8×8 | 0.100 | 0.000 | 0.000 |
| 32×32 | 0.400 | 0.200 | 0.200 |
| 128×128 | 1.600 | 3.300 | 3.300 |

The renderer iterates over all `width × height` pixels in JavaScript loops, calling `fillRect()` for each. At 128×128, this means 16,384 iterations per render stage (checkerboard, pixels, grid). High zoom makes things worse because the 2×2 sub-checkerboard mode (enabled at ≥8px effective pixel size) quadruples the `fillRect()` calls: 128×128 × 4 = 65,536 draw calls just for the checkerboard.

**Metal** shows near-constant GPU time regardless of canvas size or zoom:

| Canvas | 1× (ms) | 8× (ms) | 16× (ms) |
|--------|---------|---------|----------|
| 8×8 | 0.063 | 0.063 | 0.064 |
| 32×32 | 0.071 | 0.070 | 0.063 |
| 128×128 | 0.048 | 0.063 | 0.063 |

The fragment shader always processes the same number of viewport pixels (512×512 drawable). Canvas size only affects texture dimensions, and zoom is just a uniform value — neither changes the GPU workload.

### Cross-Renderer Comparison

| Canvas | Zoom | Canvas2D (ms) | Metal CPU (ms) | Metal GPU (ms) | Ratio (Canvas2D / Metal CPU) |
|--------|------|--------------|----------------|----------------|------------------------------|
| 8×8 | 1× | 0.100 | 0.249 | 0.063 | 0.4× (Canvas2D faster) |
| 32×32 | 1× | 0.400 | 0.326 | 0.071 | 1.2× |
| 64×64 | 1× | 1.400 | 0.231 | 0.063 | 6.1× |
| 128×128 | 1× | 1.600 | 0.207 | 0.048 | 7.7× |
| 128×128 | 8× | 3.300 | 0.226 | 0.063 | 14.6× |
| 128×128 | 16× | 3.300 | 0.226 | 0.063 | 14.6× |

For small canvases (8×8), Canvas2D is actually faster. Metal has a fixed overhead floor (~0.2ms) for command buffer creation and submission that dominates at trivial workloads. The crossover point is around 32×32, where both renderers take similar time.

At larger canvases, the gap widens dramatically: Metal is 15× faster at 128×128 high zoom. This is the architectural difference in action — Canvas2D's O(n²) CPU loops vs Metal's O(1) GPU fragment shader.

### Absolute Performance

Both renderers are well within the 16.7ms budget for 60fps at all tested configurations:

- **Canvas2D worst case**: 3.3ms (128×128 @ 16×) = 20% of frame budget
- **Metal worst case**: 0.33ms (32×32 @ 1×) = 2% of frame budget

Real-time interaction is not a concern for either renderer at the current MAX_DIMENSION of 128×128.

## Appendix: Pixel Art Canvas Sizes in Practice

To contextualize these benchmarks, here are common canvas sizes used in real pixel art games and workflows.

### Character Sprites

| Detail Level | Size | Examples |
|---|---|---|
| Low (retro) | 16×16, 16×32 | Stardew Valley, Celeste, Undertale |
| Medium | 32×32, 32×48 | Shovel Knight, RPG Maker XP, HD-2D games (Octopath Traveler, DQ III) |
| High (hi-bit) | 48×48, 64×64 | Hyper Light Drifter, Dead Cells |
| Large / Boss | 80–150px, up to 200–300px | Blasphemous (player ~80–100px), Children of Morta (up to ~290px) |

HD-2D games (Octopath Traveler, Triangle Strategy, Dragon Quest III HD-2D) use intentionally small sprites (~32×48 to 48×64). The "high-definition" comes from 3D environments and post-processing, not from large sprites.

### Tiles

| Size | Context |
|---|---|
| 16×16 | Most common standard: Stardew Valley, Shovel Knight, RPG Maker 2000–VX Ace |
| 32×32 | RPG Maker XP/VX/VX Ace default tile |
| 48×48 | RPG Maker MV/MZ default tile |

Tileset sheets (assembled from individual tiles) commonly reach 256×256, 512×512, or 1024×1024.

### Backgrounds and Full Scenes

| Type | Dimensions | Examples |
|---|---|---|
| Retro game screen | 320×180, 320×240 | Celeste (320×180, 6× scale to 1080p) |
| Hi-bit game screen | 480×270, 640×360 | Dead Cells (~480×270), Blasphemous / Owlboy / Sea of Stars (640×360) |
| Standalone illustration | 128×128, 256×256, 512×512 | Portfolio, social media |
| Sprite sheets | 1024×1024, 2048×2048 | Game engine asset pipeline |

The 640×360 resolution is the de facto "hi-bit" standard, scaling cleanly to 1080p (3×) and 4K (6×).

### Coverage by Canvas Size Limit

| Limit | Covers |
|---|---|
| **128×128** (current) | Retro/indie sprites, individual tiles, HD-2D sprites, icons, small illustrations |
| **256×256** | Large boss sprites (Blasphemous-class), small tileset sheets, medium illustrations |
| **640×360** | Full hi-bit game screens, parallax backgrounds |
| **1024+** | Sprite sheet assembly, large tilesets — professional asset pipeline territory |

### Conclusions

1. **No optimization needed for either renderer at current scale.** Both deliver hundreds-to-thousands of FPS even in worst-case scenarios. The 60fps target is easily met.
2. **The current 128×128 limit covers the majority of individual asset use cases** — retro/indie sprites, individual tiles, HD-2D sprites, and small illustrations. It falls short for large boss sprites (Blasphemous-class) and full-scene backgrounds.
3. **Extending to 256×256** would cover large sprites and small illustrations. Canvas2D is projected at ~13ms (near the 16.7ms frame budget), so viewport culling or other optimizations would become advisable. Metal would remain under 1ms.
4. **Extending to 640×360+** (hi-bit full-screen backgrounds) would require Canvas2D optimization (viewport clipping) or migration to WebGL2. Metal's constant-time architecture handles this without changes.
5. **Canvas2D's per-frame `OffscreenCanvas` allocation is not a bottleneck** at current sizes but would compound at larger dimensions.
6. **Metal's fixed overhead (~0.2ms)** is the dominant cost, not the actual rendering. For pixel art's on-demand rendering model (redraw only on change), this is irrelevant.
