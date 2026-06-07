---
title: "Deepen viewport pixel-scale into a single authority"
status: done
created: 2026-06-07
---

## What to build

Give the web shell one authority for **effective pixel size** — the display size of a
single canvas pixel in screen pixels, `round(pixelSize × zoom)` — so that every renderer,
overlay, and interaction derives the value from one place.

Today the formula is inlined as `Math.round(viewport.pixelSize * viewport.zoom)` across the
web shell: the renderer (checkerboard, pixels, Reference underlay, grid), both selection
overlays (`SelectionActionBar`, `SelectionOverlay`), the Reference underlay rect projection,
and the canvas view — which then passes the result into the **Reference Layer Placement
Interaction** as an opaque number it cannot name or validate. The bench harness inlines it
too. The canonical computation already exists in the Rust core (`Viewport::effective_pixel_size`)
and is exposed through `ViewportOps.effectivePixelSize`, but every render/overlay site bypasses
it with its own copy.

After this change, a pure `effectivePixelSize(vd)` lives in the viewport module and is the
single web-shell source; the five inline copies and the bench route through it.

Scope:

- Web-shell only; no Rust core or Apple changes.
- The Rust `effective_pixel_size` stays as the cross-platform authority (core camera math +
  Apple binding). The web keeps a pure-TS twin rather than routing the render loop through
  WASM — the formula is trivial/stable arithmetic, and `ViewportOps.effectivePixelSize` builds
  a fresh `WasmViewport` per call, which the render loop (4 calls/frame) must avoid. A parity
  test guards the twin against drift.
- Fold the two WASM-routed consumers into the authority too: `viewportOps.effectivePixelSize`
  (no production callers — tests/bench only) and `screenToCanvasPoint` stop crossing into WASM
  for this value.

## Acceptance criteria

- One pure `effectivePixelSize(vd)` is the single source; all five inline copies plus the
  bench derive from it.
- `viewportOps.effectivePixelSize` delegates to the pure function; `screenToCanvasPoint` uses
  it — no behavior change (identical formula; `pixelSize`/`zoom` always positive, so JS
  `Math.round` matches Rust `f64::round`).
- A test asserts parity between the pure function and the Rust-backed
  `viewportOps.effectivePixelSize`.
- `svelte-check` clean; unit + e2e suites pass; production build OK.

## Blocked by

None — sourced from the architecture review; standalone refactor. (Architecture review
candidate #4, reference-geometry consolidation, would later replace the placement
interaction's opaque-number input; not a prerequisite.)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/viewport.ts` | New pure `effectivePixelSize(vd)` — the single web-shell authority; doc'd as a deliberate pure-TS twin of the Rust core |
| `src/lib/canvas/renderer.ts` | Deleted local copy; the four render passes import the authority |
| `src/lib/canvas/wasm-backend.ts` | `viewportOps.effectivePixelSize` delegates via property shorthand; `screenToCanvasPoint` uses the pure fn — two per-call `WasmViewport` allocations removed |
| `src/lib/canvas/reference-layer-underlay.ts`, `SelectionActionBar.svelte`, `SelectionOverlay.svelte` | inline `Math.round(...)` → authority |
| `src/lib/canvas/PixelCanvasView.svelte` | Removed the `scaledCanvasPixel()` wrapper; feeds the Reference Layer Placement Interaction from the authority |
| `src/routes/bench/+page.svelte` | bench effective-pixel column uses the authority |
| `src/lib/canvas/viewport.test.ts` | 4 tests: basic, fractional zoom, integer rounding, and Rust-parity guard |

### Key Decisions

- **Core Placement** — keep the Rust `effective_pixel_size` (cross-platform: core camera math
  + Apple) and keep a pure-TS twin on the web rather than routing the render loop through WASM.
  Trivial, stable arithmetic → low duplication risk; a parity test guards drift.
- **Home in `viewport.ts`** (co-located with `ViewportData`), not a new micro-module —
  right-sized over finely-split.
- **Property-shorthand delegation** in `viewportOps` (`effectivePixelSize,`) instead of a
  wrapper that reads like recursion — readable over clever.

### Notes

- Behavior-preserving: `pixelSize`/`zoom` are always positive, so JS `Math.round` (half up)
  equals Rust `f64::round` (half away from zero). `screenToCanvasPoint` keeps `roundLikeRust`
  for pan (unchanged).
- Sourced from the architecture review (`/improve-codebase-architecture`, candidate #1). No
  pre-existing issue; this file was created retroactively at completion. Sibling candidates
  (#2 batch layer metadata, #3 seal the Loupe geometry contract) remain open follow-ups.
- Verified: `svelte-check` clean · unit 1357 passed · e2e 86 passed · production build OK.
