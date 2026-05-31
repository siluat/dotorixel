---
title: "Region pixel transformations (lift/clear/composite) + Delete keyboard"
status: done
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

## Results

| File | Description |
|------|-------------|
| `crates/core/src/selection.rs` | Added Marquee region lift, clear, and source-over composite operations with edge-case coverage. |
| `crates/core/src/document.rs` | Added Document-level Marquee pixel mutators that no-op on Reference Layers. |
| `wasm/src/lib.rs` | Exposed the Document mutators through WASM and validated composite buffer length at the boundary. |
| `src/lib/canvas/editor-session/document-change-journal.svelte.ts` | Added an undoable clear-Marquee-pixels intent that preserves the Marquee. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | Routed Marquee pixel clearing through the active tab while drawing is idle. |
| `src/lib/canvas/keyboard-input.svelte.ts` | Wired Delete and Backspace to clear selected Pixel Layer pixels when a Marquee is active. |
| `src/lib/canvas/**/*.test.ts` | Covered journal, keyboard, tab state, and WASM boundary behavior for Marquee pixel clearing. |

### Key Decisions

- Region pixel operations live in the Rust core because the logic is pixel-domain, cross-platform, and reused by later move/copy/cut/paste slices.
- Delete clears pixels but leaves the Marquee intact, matching the PRD contract and keeping Undo focused on pixel data restoration.
- Invalid composite buffer sizes fail at the WASM boundary with an actionable error instead of relying on caller correctness from TypeScript.

### Notes

- Floating Selection behavior remains out of scope for this slice and starts in 142.
- Downstream cut/copy/paste work can reuse the core lift, clear, and composite operations added here.
