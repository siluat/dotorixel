---
title: "Spritesheet (PNG) export — horizontal strip, end-to-end"
status: ready-for-agent
created: 2026-07-05
parent: 213-gif-spritesheet-export.md
---

## Parent

[213 — GIF / spritesheet export — multi-frame export formats (M4)](213-gif-spritesheet-export.md)

## What to build

The first real document-source export format, riding the generalized registry from the prefactor slice: export every Frame's composite as one contiguous horizontal-strip PNG. The simpler of the two encoders, so it doubles as the tracer bullet that proves the whole Document-source export path.

- **Core**: a Document-level spritesheet encoder in the core export module. It iterates the Frame axis in order, reads each frame through the existing per-frame composite seam (`composite_at`), tiles the composites left-to-right — each tile exactly canvas width × height, contiguous, no padding — and encodes a straight-alpha RGBA PNG through the existing PNG dependency. Sheet dimensions: `(width × frame count) × height`. A pure query: never touches the Active Frame, History, dirty state, or Playback. Compositing matches Playback exactly: visible Pixel Layers blended with their opacity, hidden layers and the Reference Layer excluded.
- **WASM**: the encoder exposed on the existing document binding, returning a byte buffer, with encode failures surfaced as errors per the established binding error pattern.
- **Web**: a Spritesheet entry in the format registry as a document-source format — `.png` extension, `image/png` MIME, and a default filename stem carrying a sheet marker so it doesn't collide with the still-PNG default. The entry appears in the desktop popover and mobile bottom sheet automatically (registry-driven), available regardless of frame count. Export analytics records the new format id. New user-facing strings land in en/ja/ko together.

## Acceptance criteria

- Core decode round-trip tests assert: sheet dimensions `(width × frame count) × height`; per-tile pixels match each frame's composite in axis order; hidden-layer and Reference-Layer exclusion; layer-opacity parity with existing composite behavior; a single-frame Document produces a one-tile sheet identical to that frame's composite.
- Exporting is observably side-effect-free: Active Frame, History, and dirty state are unchanged after encoding.
- WASM tests: the returned buffer carries the PNG signature; the error path surfaces as an error.
- Web tests mirror the existing PNG/SVG flow tests: registry entry (id, extension, MIME, document-source shape), sheet-marker default stem, and the export flow handing the Document to the format and firing analytics.
- Demoable: selecting Spritesheet in the popover or bottom sheet downloads a strip PNG whose tiles match the Timeline order.
- All three locales (en/ja/ko) updated together for any new strings.

## Blocked by

- [214 — Prefactor: export formats declare their source](214-export-format-source-prefactor.md)
