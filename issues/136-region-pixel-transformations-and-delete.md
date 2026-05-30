---
title: "Region pixel transformations (lift/clear/composite) + Delete keyboard"
status: ready-for-agent
created: 2026-05-30
parent: 131-selection-tool-rectangle-select-move-nudge-copy-paste.md
---

## Parent

[131 — Selection tool — Marquee with move/copy/paste and per-tool clipping](131-selection-tool-rectangle-select-move-nudge-copy-paste.md)

## What to build

Add the Rust core pixel-region operations that downstream slices (drag-to-move, copy/cut/paste, clipping mask) consume, and wire up the simplest consumer — Delete / Backspace clearing the Marquee region.

Scope:

- **Rust core**: three pure operations (in `selection.rs` or `canvas.rs`, chosen by natural-receiver fit):
  - `lift_region(canvas, region) -> Vec<u8>` — row-major RGBA extraction; partially out-of-bounds regions return only the in-bounds slice padded with transparent.
  - `clear_region(canvas, region)` — set region pixels to transparent in-place.
  - `composite_region(canvas, buffer, dest_region)` — source-over alpha composite at destination, matching existing Pixel Layer blend.
- **Document mutators** (`crates/core/src/document.rs`): `lift_marquee_pixels() -> Vec<u8>`, `clear_marquee_pixels()`, `composite_buffer_at(buffer, region)`. All three silently no-op when the active layer is a Reference Layer (matches PRD-105's drawing-tool no-op contract).
- **WASM facade**: expose the three Document methods.
- **Document Change Journal**: new `clear-marquee-pixels` intent — captures one undo snapshot, clears the active Pixel Layer's pixels inside the Marquee, leaves the Marquee itself unchanged.
- **Keyboard input** (`keyboard-input.svelte.ts`): Delete / Backspace dispatches `clear-marquee-pixels` when a Marquee is active in Idle state.

Implementation notes:

- Floating Selection path is NOT yet wired here — that arrives in 142.
- `clear_region` is the foundation; later slices reuse it for cut (146).
- All three Rust functions are pure (no side effects beyond the explicit `&mut PixelCanvas`).

Tests:

- Rust unit tests for each operation, including the edge cases listed in the PRD testing section (1×1, off-canvas, partial overlap, full translate-out).
- TS journal tests for `clear-marquee-pixels`: snapshot captured, pixels cleared, Marquee position unchanged, Reference-active no-ops without firing render-invalidation.
- Keyboard test: Delete with Marquee active triggers the intent; Delete with no Marquee is silent no-op.

## Acceptance criteria

- `lift_region`, `clear_region`, `composite_region` available and round-trip-identity tested (lift then composite at same region = no change).
- Document mutators no-op when the active layer is a Reference Layer.
- `clear-marquee-pixels` journal intent captures one undo snapshot; Undo restores the cleared region without affecting other pixels.
- Delete / Backspace with Marquee active clears the region; Delete with no Marquee is a silent no-op.
- Marquee position itself is unchanged by the Delete operation.

## Blocked by

- [132 — Selection foundation](132-selection-foundation.md)
