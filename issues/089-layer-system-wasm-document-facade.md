---
title: "Layer system: WASM Document facade"
status: ready-for-agent
created: 2026-05-06
parent: 086-layer-system-basic-infrastructure.md
---

## Parent

[086 — Layer system: basic infrastructure](086-layer-system-basic-infrastructure.md)

## What to build

Expose the Rust `Document` (and supporting `Layer` operations) through the WASM facade so the TS shell can construct, mutate, composite, and snapshot a Document. The TS shell does not yet call this facade — main is unaffected.

Scope:

- Add a `Document` binding under `wasm/`. The interface mirrors a single canvas in shape: `composite()` returns an RGBA buffer compatible with `ImageData`.
- Bindings for: `new(width, height)`, `add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`, `composite`, `resize`, and the active-layer pixel mutations needed by the existing tools (`set_pixel`, `flood_fill`, …).
- Bindings for `HistoryManager` Document snapshot operations added in 088.
- Layer IDs are accepted as UUID v4 strings (TS-side `crypto.randomUUID()`) — the binding does not generate IDs.
- Keep the existing `PixelCanvas` binding as-is. The two facades coexist for now.

## Acceptance criteria

- `Document` binding exposes `new`, `add_layer`, `remove_layer`, `reorder_layer`, `set_active_layer`, `composite`, `resize`, and the active-layer pixel mutations.
- `composite()` returns an RGBA buffer in row-major order compatible with `ImageData`.
- HistoryManager's Document snapshot path is reachable from TS through the binding.
- Layer IDs are accepted as UUID v4 strings supplied by the caller.
- Existing `PixelCanvas` binding is unchanged; existing TS code keeps building.
- `wasm-pack` build succeeds.

## Blocked by

- [087 — Rust core: Document/Layer + composite + add/delete/reorder](087-layer-system-rust-document-layer-core.md)
- [088 — Rust HistoryManager: Document snapshot support](088-layer-system-rust-history-document-snapshot.md)

## Scenarios addressed

- WASM bridge groundwork; no scenario directly observable yet.
