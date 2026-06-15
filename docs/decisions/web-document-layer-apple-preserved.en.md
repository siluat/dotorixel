# Web-only Document/Layer model with single-PixelCanvas preserved on the Apple shell

## Status

Accepted (2026-05-06)

Amended (2026-06-14, issue 181): the preserved single-canvas `HistoryManager` below was renamed `PixelCanvasHistory` over a shared generic history ring (issue 180) — a rename, not a data-model migration; Apple stays on the single-`PixelCanvas` model.

## Context

Introducing the layer system in Milestone 3 (`086-layer-system-basic-infrastructure`) is a data-model change with the potential to affect both shells. The Rust core's `PixelCanvas` is a single flat buffer today, and the change extends it into a `Document → Layer stack`.

The Apple shell, however, is mid-Phase-1 catchup (`013-apple-native-catchup`). It is currently transitioning from the Pebble UI (floating panels) to the docked layout, and layout, design tokens, button styles, and view structure are all being redesigned. Phase 1 is built on top of the single `PixelCanvas` + `HistoryManager` interface.

Changing the data model at the same time would:

1. Blur Apple Phase 1's priority (UI overhaul vs. data-model migration — which gets focus?).
2. Increase PR / merge risk (the web and Apple shells modify the same core modules concurrently).
3. Leave Apple without UI to surface the layer system (LayerPanel, TimelinePanel do not exist on the Apple side).

## Decision

The web shell migrates to the `Document` / `Layer` model in Milestone 3. The Apple shell preserves the single `PixelCanvas` + `HistoryManager` interface unchanged.

To make this work:

- The `Document` model is added to the Rust core as a new module (`crates/core/src/document.rs`).
- The existing `PixelCanvas` and `HistoryManager` (single-canvas shape) are preserved in the core — they are not demoted to internal details of Document, and they remain part of the public API.
- The Apple binding (`apple/`) does not change its `PixelCanvas` / `HistoryManager` wrappers.
- The WASM binding (`wasm/`) gains a `Document` facade.
- When Apple migrates to Document/Layer is decided in Phase 2 or a separate PRD.

## Considered Alternatives

### Alternative A: migrate the Apple shell at the same time

Update both shells in the same PRD.

**Rejected because**: the Apple Phase 1 priority conflict and PR-merge risk described in Context. Apple also has no UI to surface a layer system yet, so adding the data model alone would be dead code.

### Alternative B: replace the Rust core entirely with Document, removing the single PixelCanvas

The Apple binding would use `Document.layers[0]` as its single-canvas equivalent.

**Rejected because**: Apple code uses `PixelCanvas` / `HistoryManager` directly throughout. Routing every call site through Document would require a full Apple-side refactor in parallel with Apple Phase 1, conflicting with Phase 1's priority.

### Alternative C: defer this PRD until Apple Phase 1 finishes

Hold the web's layer system until all Apple Phase 1 sub-issues land.

**Rejected because**: Phase 1 has multiple sub-issues remaining, and during that time web users continue to operate without a layer system. M3 is "Editor for Serious Work" and that milestone is unattainable without layers. Follow-up features such as Reference Layer would also stall.

## Consequences

### Benefits

- Apple Phase 1 can proceed steadily on top of the single-canvas assumption.
- The web's M3 / M4 are not coupled to the Apple timeline.
- The Rust core's `PixelCanvas` / `HistoryManager` public APIs are preserved, so the Apple binding requires no changes.

### Trade-offs

- A temporary data-model divergence between the two shells — the longer the divergence lasts, the more it costs to keep the two models semantically aligned.
- Two data models coexist in the core (single `PixelCanvas` and `Document`).
- When Apple eventually moves to Document, the migration work concentrates into a single later effort (handled in Phase 2 or a dedicated PRD).

### Follow-up triggers

- When Apple Phase 1 finishes and Apple Phase 2 starts, file a new issue for Apple's Document migration.
- The `PixelCanvas` public API can only be removed from the core after Apple is also migrated.
