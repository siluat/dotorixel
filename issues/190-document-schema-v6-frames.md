---
title: "Document schema V6 — frames + per-cel persistence"
status: ready-for-agent
created: 2026-06-18
parent: 186-frame-management.md
---

# Document schema V6 — frames + per-cel persistence

## Parent

[186 — Frame management (add/delete/duplicate/reorder) — M4 entry](186-frame-management.md)

## What to build

Persist the frame axis so animations survive a refresh, bumping the document
record to **V6** with a lossless V5 → V6 migration. Depends only on the core model
(188); can proceed in parallel with the WASM/journal slice (189).

- Bump the document record to **V6**. New fields: `frames` (ordered frame ids) and
  `activeFrameId`. `nextLayerNumber` stays; there is **no** `nextFrameNumber`
  (frames are position-numbered).
- A Pixel Layer record's single `pixels` becomes `cels` — one
  `{ frameId, pixels }` entry per frame. The Reference layer record is unchanged
  (frame-independent).
- **V5 → V6 migration**: synthesize one frame; each Pixel Layer's single `pixels`
  becomes that frame's single cel; `activeFrameId` = the synthesized frame. No
  pixel loss; history resets, consistent with prior schema migrations.
- The workspace `viewports` / `references` / `displayStates` records are
  unaffected (frame state is per-document, not per-viewport).

## Acceptance criteria

- A V6 document serializes and deserializes round-trip, preserving `frames`,
  `activeFrameId`, and every Pixel Layer's per-cel pixels exactly.
- A persisted V5 document migrates to V6 yielding exactly one frame whose cels
  carry the original per-layer pixels with no pixel loss; `activeFrameId` points
  at the synthesized frame.
- An existing saved single-image document opens as a one-frame animation,
  invisibly to the user.
- The active frame is restored on reload from `activeFrameId`.
- Workspace viewport / reference / display-state records are unchanged by the
  bump.
- Round-trip and migration tests cover the above (prior art: existing
  schema-migration tests).

## Blocked by

- [188 — Frame cel-grid + frame operations (Rust core)](188-frame-cel-grid-core.md)

Can run in parallel with [189 — Frame WASM binding + Change Journal intents](189-frame-wasm-journal-intents.md) (both depend only on 188).
