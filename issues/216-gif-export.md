---
title: "Animated GIF export — pixel-art-faithful encoder, end-to-end"
status: ready-for-agent
created: 2026-07-05
parent: 213-gif-spritesheet-export.md
---

## Parent

[213 — GIF / spritesheet export — multi-frame export formats (M4)](213-gif-spritesheet-export.md)

## What to build

Animated GIF export end-to-end, riding the same generalized registry path as the spritesheet slice. The bulk of this slice is the core encoder; its complexity is cohesive and stays in one place.

- **Core**: a Document-level GIF encoder in the core export module, adding the `gif` crate as the core's second image dependency. It iterates the Frame axis in order through the existing per-frame composite seam (`composite_at`) and encodes per the parent PRD's decisions:
  - **Timing** — each frame's delay is its `duration_ms` quantized to centiseconds, round-to-nearest with a 1 cs floor; the maximum duration (60 000 ms → 6 000 cs) fits the delay field.
  - **Looping** — always infinite via the standard looping extension; not configurable.
  - **Transparency** — binary: composite alpha ≥ 128 → opaque, below → the reserved transparent palette index.
  - **Palette** — per-frame palettes with an exactness guarantee: when a frame's unique opaque colors fit the palette (one index reserved for transparency when needed), colors are preserved exactly; only overflow frames fall back to quantization.
  - **Frame encoding** — full-canvas frames (no delta optimization), disposal set so each frame fully replaces the previous one; transparent regions never show ghosting from earlier frames.
  - A pure query: never touches the Active Frame, History, dirty state, or Playback. Compositing matches Playback: visible Pixel Layers blended with opacity, hidden layers and the Reference Layer excluded.
- **WASM**: the encoder exposed on the existing document binding, returning a byte buffer, with encode failures surfaced as errors per the established binding error pattern.
- **Web**: a GIF entry in the format registry as a document-source format — `.gif` extension, `image/gif` MIME, shared default filename stem. Appears in the desktop popover and mobile bottom sheet automatically, available regardless of frame count. Export analytics records the new format id. New user-facing strings land in en/ja/ko together.

## Acceptance criteria

- Core decode round-trip tests (the `gif` crate decodes as well as encodes) assert: frame count and axis order; per-frame delays including round-to-nearest quantization, the 1 cs floor, and the maximum duration; the infinite-loop extension is present; exact color fidelity for frames within the palette limit; the alpha-128 transparency threshold; hidden-layer and Reference-Layer exclusion and layer-opacity parity; no cross-frame ghosting when transparency is present; a single-frame Document produces a valid one-frame GIF; a frame exceeding the palette limit still encodes via the quantization fallback rather than erroring.
- Exporting is observably side-effect-free: Active Frame, History, and dirty state are unchanged after encoding.
- WASM tests: the returned buffer carries the GIF89a signature; the error path surfaces as an error.
- Web tests mirror the existing flow tests: registry entry (id, extension, MIME, document-source shape) and the export flow handing the Document to the format and firing analytics.
- Demoable: an exported GIF plays in a browser with the same frame order and timing as the in-editor Playback preview.
- All three locales (en/ja/ko) updated together for any new strings.

## Blocked by

- [214 — Prefactor: export formats declare their source](214-export-format-source-prefactor.md) (independent of 215 — the two format slices can proceed in parallel)
