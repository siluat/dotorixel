---
title: "Document schema V6 — frames + per-cel persistence"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/session/session-storage-types.ts` | Added `FrameRecord`, `CelRecord`, `PixelLayerRecordV6` (cels), `DocumentSchemaV6` (`frames` + `activeFrameId`, no `nextFrameNumber`); `migrateV5ToV6` (synthesizes one frame); `celPixelsForFrame` helper; `compositeForExportSummary` V6 branch (active-frame cels). Kept `PixelLayerRecord` (single `pixels`) for V4/V5 + the snapshot |
| `src/lib/session/session-storage.ts` | `normalizeToV6` dispatch (V5 still routes through `migrateV4ToV5` to re-normalize Reference order); `DB_VERSION` 6 + `oldVersion < 6` cursor upgrade; `getAllSavedDocuments` skips unreadable records |
| `src/lib/session/session-persistence.ts` | `save` synthesizes a single frame (each layer buffer → one Cel); `restore`/`getSavedDocumentSnapshot` collapse the active-frame Cel back to the snapshot's single `pixels` |
| `src/lib/session/session-storage-types.test.ts` | `migrateV5ToV6` + `compositeForExportSummary` V6 unit tests |
| `src/lib/session/session-storage.test.ts` | Migration tests retargeted V5→V6; added multi-frame V6 round-trip, V5→V6 on DB open, and the unreadable-record skip test |
| `src/lib/session/session-persistence.test.ts` | `save` writes a single-frame V6 record; legacy reference-hydration docs carried forward via a `putLegacyV5` helper |

### Key Decisions
- **Scope: record-level only (Scope A).** The snapshot producer (`toSnapshot()`) does not yet extract frames, so 190 stayed independent of 189: the live save/restore path **synthesizes one frame on write and collapses the active-frame Cel on read**. Multi-frame capacity is proven by record-level round-trip tests; the single-frame snapshot bridge is lossless because every record the live path writes is single-frame. The seam to flow real frames through the snapshot opens in a later slice (191/192).
- **Reference normalization preserved:** V5 input routes through `migrateV4ToV5` (not `migrateV5ToV6` directly) so legacy multi/misplaced Reference Layers still normalize to one bottom-most underlay before gaining the frame axis.

### Notes
- **`getAllSavedDocuments` hardened** to skip un-normalizable records (mirrors `restore()`'s graceful fallback) after a mid-edit HMR autosave left a malformed `schemaVersion: 5` + cel-layer record in a dev IndexedDB. Clean production data (≤V5 with `pixels`) is unaffected; the guard prevents one bad record from breaking the whole saved-work browser.
- The deferred **serde-wasm-bindgen + tsify** evaluation is *not* triggered here — this slice has no Rust↔TS cel serialization (frames are not yet extracted across the WASM boundary). That trigger belongs to the snapshot-extraction slice.
- **191 (ruler shell) is now unblocked** — it depended only on 190.
