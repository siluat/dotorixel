---
title: "Onion skin state — neighbor selection, ghost projection, persisted per-tab flag"
status: done
created: 2026-07-05
parent: 217-onion-skinning.md
---

## Parent

[217 — Onion skinning — adjacent-frame ghosts while editing (M4)](217-onion-skinning.md)

## What to build

The onion-skin state layer, landing dead-code-tolerant (no renderer/UI consumer yet)
exactly as the cel-grid (188), duration core (195), and `composite_at` (201) slices
did. No core or WASM change anywhere in this feature — ghost sources are the existing
`composite_at` seam.

- **Neighbor selection pure function** — the only new seam in PRD 217. Given the
  ordered frame projection, the active frame id, and a config (previous/next counts),
  it returns ghost descriptors (frame id, previous/next kind, distance), clamped at
  the axis ends, never wrapping. The v1 config is a fixed constant of previous 1 /
  next 1, but counts flow as data so a future range control adds only UI.
- **Per-tab persisted flag** — an onion-skin boolean beside the grid flag in the
  per-tab viewport state and its stored viewport record. Default off; a stored record
  without the field reads as off, so no schema-version bump and no migration.
  Toggling flows through the same viewport chain as the grid toggle and persists via
  the existing workspace auto-save; restoring a saved document (as opposed to the
  live workspace) resets to the default, matching grid behavior.
- **Ghost projection on the tab state** — computed through the existing
  render-invalidation cache exactly like the frame projection: a list of ghost
  descriptors each carrying its neighbor's `composite_at` buffer. The projection is
  empty while the flag is off, while Playback runs, or on a side with no neighbor.
  Computing it never mutates the document, never moves the Active Frame, and never
  pushes History.
- **Domain vocabulary** — CONTEXT.md gains **Onion Skin** in the Frames & Cels
  section with the avoid-list from the PRD (ghosting / tracing / overlay / underlay).

## Acceptance criteria

- Pure function: a middle frame yields previous + next; the first/last frame clamps
  to one side; a single frame yields none; counts come from the config; no
  wrap-around. Unit-tested with synthetic frame lists (playback-advance prior art).
- The flag round-trips per tab through the workspace snapshot and persistence; a
  stored viewport record without the field reads as off; restoring a saved document
  resets it to default. Prior art: the session-persistence viewport tests.
- Toggling the flag marks the workspace dirty for auto-save (grid parity) but pushes
  no History entry and leaves the document untouched.
- Tab-state integration (real WASM): with the flag on, ghost buffers equal the
  neighbors' `composite_at`; flag off / Playback running / single frame → empty
  projection; switching the Active Frame re-targets ghosts; undo/redo and
  neighbor-frame edits refresh ghost pixels. Prior art: the composite-buffer playback
  tests.
- Computing the projection leaves `active_frame_id`, History, and dirty state
  unchanged (asserted, not assumed).
- Lands dead-code-tolerant: no renderer or UI consumer; the full test suite stays
  green.
- CONTEXT.md contains the **Onion Skin** entry.

## Blocked by

None — can start immediately (runs in parallel with 218). Unblocks 220.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/onion-skin.ts` | New module: `OnionSkinConfig` + `DEFAULT_ONION_SKIN_CONFIG` (previous 1 / next 1), ghost descriptor types, pure `onionSkinGhosts` selection (axis order, end-clamped, never wrapping), and the `OnionSkinGhostRead` shape 220's renderer consumes |
| `src/lib/canvas/editor-session/onion-skin.test.ts` | Unit spec: middle frame prev+next, first/last clamp, single frame, config-driven counts, overrun clamp — 6 tests |
| `src/lib/canvas/viewport.ts` | `ViewportData.showOnionSkin` as a required field (grid-flag contract parity) |
| `src/lib/canvas/editor-session/tab-viewport.svelte.ts` | `toggleOnionSkin()` through the same apply → commit(markDirty) chain as the grid toggle |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `toggleOnionSkin` delegation + `onionSkinProjection` getter cached on `(document, renderVersion)`, gated by the flag and `playheadFrameId`; `NO_GHOSTS` keeps empty reads referentially stable |
| `src/lib/canvas/wasm-backend.ts` | `DEFAULT_SHOW_ONION_SKIN = false` seeds `forCanvas` (new tabs start off) |
| `src/lib/session/session-storage-types.ts` | `ViewportRecord.showOnionSkin?` — optional, absence documented as "off" (`pixelPerfect` precedent, no schema bump) |
| `src/lib/session/session-persistence.ts` | Restore-boundary normalization (`?? false`); `DEFAULT_VIEWPORT` carries the flag so saved-document reopen resets by construction |
| `CONTEXT.md` | **Onion Skin** entry in Frames & Cels with the PRD avoid-list |
| Existing tests (~10 files) | Mechanical `showOnionSkin: false` on every `ViewportData` literal (typecheck-driven sweep); new behavior tests in tab-state, tab-viewport, and session-persistence suites |

### Key Decisions

- **Required in the live type, optional only in storage.** `ViewportData.showOnionSkin` is required like `showGrid`; only the stored `ViewportRecord` is optional, normalized once at the restore boundary — the type system forces every construction site to decide.
- **`onionSkinGhosts` named as a query** — avoided a `select…` verb so Selection/Marquee domain vocabulary stays unambiguous.
- **Order contract is axis order** (previous farthest-first, then next nearest-first); the farthest-first *draw* order is 220's renderer concern.
- **Playback gate reads `playheadFrameId`** — the same signal `compositeBuffer` uses, so the projection and display buffer can never disagree about "playing".
- **Cache identity is part of the contract**: a test pins referential stability until the next render invalidation, so Svelte consumers may depend on identity.

### Notes

- Lands dead-code-tolerant: no renderer/UI consumer. 220 wires rendering, the transport toggle, i18n, and the E2E tracer.
- Full suite green (92 files / 1654 tests), `bun run check` 0 errors.
- Test helpers `paintActiveFrame` / `makeFramesTab` were hoisted to file scope in the tab-state suite (now shared by the playback and onion-skin describes).
