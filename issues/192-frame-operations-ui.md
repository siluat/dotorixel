---
title: "Frame operations UI — add / duplicate / delete / reorder"
status: done
created: 2026-06-18
parent: 186-frame-management.md
---

# Frame operations UI — add / duplicate / delete / reorder

## Parent

[186 — Frame management (add/delete/duplicate/reorder) — M4 entry](186-frame-management.md)

## What to build

Complete PRD 186 by wiring the frame mutations into the ruler shell (191): the
user can add, duplicate, delete, and reorder frames, with undo/redo, persistence,
and an E2E tracer. This is the end-to-end demoable slice.

Per the [187 design spec](187-frame-ruler-design.md):

- A **header-right frame-action group**, prefixed with a `Frames` label
  (mirroring the left `Layers` label to resolve the two-`＋` ambiguity), acting on
  the **active frame**: `＋` add (empty frame), `⧉` duplicate, `🗑` delete, then
  the collapse chevron. Header **left is unchanged from M3** (add-layer `＋`,
  add-reference-layer `▣`, `Layers` label). On mobile the collapse chevron is
  dropped (the Timeline tab is the toggle).
- **Add** inserts a transparent frame after the active frame and makes it active
  (so the user can draw immediately); **duplicate** clones the active frame's full
  composite after it and makes it active; **delete** removes the active frame
  (rejected when only one remains, leaving an adjacent frame active).
- **Reorder** frames by dragging their ruler cell, reusing the layer-row
  drag-reorder pattern; the frame that was active stays active after the reorder.
- All four operations route through the journal intents from 189 (undoable) and
  persist via V6 (190); undo/redo restores both frame structure and per-cel
  pixels.
- New i18n keys for the frame actions in en / ko / ja.

## Acceptance criteria

- The header frame-action group (add / duplicate / delete) is present with the
  `Frames` label; the left layer actions and `Layers` label are unchanged.
- Add inserts an empty frame after the active frame and makes it active; the
  canvas is blank and ready to draw.
- Duplicate inserts a copy of the active frame's composite after it and makes it
  active.
- Delete removes the active frame and activates an adjacent one; delete is
  disabled/rejected when only one frame remains.
- Dragging a frame's ruler cell reorders frames; the previously-active frame
  remains active after the reorder.
- Each operation is a single undo step; undo restores the prior frame structure
  and pixels exactly, redo re-applies; selecting a frame is never an undo step.
- New frames and their per-cel pixels survive a page refresh.
- Frame action labels are localized in en / ko / ja.
- An E2E flow passes: add a frame, draw distinct content on it, switch frames and
  confirm the canvas differs, undo restores.

## Blocked by

- [191 — Frame ruler shell + selection (TimelinePanel)](191-frame-ruler-shell.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/TimelinePanel.svelte` | Header-right frame-action group (`Frames` label + add `＋` / duplicate / delete; delete disabled at one frame); ruler-cell **horizontal drag-reorder** mirroring the layer-row pattern (translateX preview + displaced-cell shift; a completed drag swallows the trailing select-click via a threshold flag) |
| `src/routes/editor/+page.svelte` | `handleAddFrame` / `Duplicate` / `Remove` / `Reorder` → `tab.*`; wired on both docked + mobile TimelinePanel instances |
| `messages/{en,ko,ja}.json` | `timeline_frames_label`, `aria_addFrame` / `aria_duplicateFrame` / `aria_removeFrame` |
| `src/lib/canvas/workspace-snapshot.ts` | `TabSnapshot` gains `frames` + `activeFrameId`; Pixel Layer snapshot single `pixels` → `cels` (one per frame) |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `toSnapshot` extracts every frame's Cel (floating selection baked only onto the active-frame Cel) |
| `src/lib/canvas/wasm-backend.ts` | `documentFromLayerSource` rebuilds a multi-frame Document from a Cel-based source via `add_frame` + `set_active_frame`/`set_active_layer` + `restore_active_layer_pixels`; legacy single-buffer sources still build one frame |
| `src/lib/session/session-persistence.ts` | `save` writes the snapshot's real frames/Cels (no more single-frame synthesis); `restore` / `getSavedDocumentSnapshot` carry every Cel through |
| `src/lib/canvas/workspace-snapshot-fixtures.ts` | Fixture supports `cels` / multi-frame |
| `e2e/editor/frames.test.ts` (new) | Add+draw+switch+undo tracer, duplicate-carries-content, delete (disabled/adjacent/undo), drag-reorder (active preserved), **per-cel pixels survive a page refresh** |
| `TimelinePanel.svelte.test.ts`, `document-hydration.test.ts`, `tab-state.svelte.test.ts`, `session-persistence.test.ts`, `workspace.svelte.test.ts` | Component coverage for the action group + drag; multi-frame round-trip (snapshot↔Document, save↔restore); migrated single-frame snapshot assumptions to Cels |

### Key Decisions
- **Multi-frame persistence landed in the web shell only** (no Rust/WASM change): the snapshot↔Document bridge reuses existing WASM primitives to reconstruct the frame axis on hydration, keeping binding friction at zero.
- **First-frame id is reassigned on rebuild and remapped.** The WASM builder mints the initial frame's id, so the first persisted frame id maps to it; later frames keep theirs. Frames are identity-only / position-numbered, so id stability across reload is not required.
- **Ruler cell is both select-on-click and drag-to-reorder.** A pointer move past a small threshold marks the gesture a drag and suppresses the trailing click, so reordering never also re-selects.
- **Header buttons follow the current 24×24 icon-button pattern**, not the 187 "bare-icon" ideal (that visual sync stays deferred).

### Notes
- **Scope correction:** 190 explicitly deferred flowing real frames through the snapshot to "a later slice (191/192)"; 191 was the read-only ruler shell, so multi-frame persistence (192 acceptance criterion 7) belonged here. It was missed in the first pass and then implemented + E2E-verified (refresh survival).
- **Mobile touch targets:** the frame action buttons stay 24px (below the ≥44px guideline) — tracked by the existing "TimelinePanel mobile touch targets" backlog item, to be solved together with the row icon buttons.
- **Verification:** 1518 unit tests + `svelte-check` clean + 105 E2E (incl. 5 frame flows with refresh survival); no regression in the other reload-persistence E2E (pixel-perfect / reference / workspace).
