---
title: "Per-frame composite seam — composite_at (core + WASM)"
status: ready-for-agent
created: 2026-06-23
parent: 199-animation-playback-transport.md
---

## Parent

[199 — In-editor animation playback (transport strip + preview, M4)](199-animation-playback-transport.md)

## What to build

The shared composite primitive PRD 199 stands on: a **per-arbitrary-frame composite**
that the playback controller (202), and later onion skinning and GIF/spritesheet
export, all read. Lands dead-code-tolerant — no consumer yet — exactly as the core
cel-grid (188) and duration core (195) slices did.

- **Core** (`crates/core/src/document.rs`): new `composite_at(frame_id) -> Vec<u8>` —
  the same straight source-over blend `composite()` does today, but for the
  **requested** frame's cels. Layer visibility/opacity apply identically; Reference
  Layers stay excluded from pixel buffers. The existing `composite()` becomes
  `self.composite_at(self.active_frame_id)`, so "how a frame composites" has one
  definition and the active-frame composite is its special case. The core **trusts** a
  valid in-document `frame_id` (the same grid invariant `composite()` already relies
  on); validation is a boundary concern handled at the WASM layer.
- **WASM** (`wasm/src/lib.rs`): new `composite_at(frame_id: String) -> Result<Vec<u8>,
  JsError>` — parses the UUID, confirms the frame exists, delegates to the core;
  errors only on an invalid UUID / unknown frame. Read-only sibling of the existing
  `composite()` getter — **no mutation method, no journal intent** (playback reads,
  never writes).
- **Facade** (`src/lib/canvas/canvas-model.ts`): the TS `Document` interface gains
  `composite_at(frameId)`; the `fake-drawing-ops.ts` fake implements it for interface
  conformance; the `wasm-sync.test.ts` structural check keeps facade and binding in
  lockstep.

## Acceptance criteria

- `composite_at(frame_id)` returns the requested frame's composite, distinct from the
  active frame's when their cels differ.
- `composite()` equals `composite_at(active_frame_id)` (no behavior change for existing
  callers; all prior composite tests pass).
- Calling `composite_at` for a non-active frame leaves `active_frame_id` and the active
  composite unchanged.
- Layer visibility, opacity, and Reference-Layer exclusion behave exactly as in
  `composite()`.
- WASM `composite_at` round-trips a known frame's buffer; an unknown frame / invalid
  UUID returns an error; the call does not mutate the active frame.
- The TS facade and the fake expose `composite_at`; `wasm-sync` structural
  compatibility holds.
- Inline core unit tests + WASM binding tests assert the above via external behavior
  (buffer contents, active-frame invariance) — never private representation.
- Lands dead-code-tolerant: the apple binding builds unchanged; no shell consumer yet.

## Blocked by

None — can start immediately (runs in parallel with 200). Unblocks 202.
