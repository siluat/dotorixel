---
title: "Frame management (add/delete/duplicate/reorder) — M4 entry"
status: done
created: 2026-06-16
---

## Problem Statement

DOTORIXEL users can build multi-layer pixel art, but every Document is a single
still image. There is no way to author motion — a walk cycle, a blinking idle, a
spinning coin — which is the headline promise of Milestone 4 ("Animation-Capable
Editor"). Today the editor has:

- A `Document` that owns a layer stack but has exactly one moment in time.
- A `TimelinePanel` whose frame axis is a single static placeholder column
  carrying the literal hint *"M3 placeholder — frame ruler grows here in M4"*.
- A layer-system PRD (086) that already committed the data model and the UI to a
  **Layer × Frame grid**, but left the frame axis unbuilt.

Until frames exist, none of the rest of the animation cluster (per-frame speed,
timeline playback, onion skinning, GIF/spritesheet export) has anywhere to
stand. Frame management is the M4 entry point: every other M4 item depends on it.

## Solution

Introduce **Frames** as a first-class temporal axis on the Document, growing the
existing single-column placeholder into a real frame ruler in the TimelinePanel.

From the user's perspective:

- A new Document has one frame; the canvas they already know is "frame 1".
- The TimelinePanel shows a row per layer (as today) and now a **column per
  frame**. The intersection of a layer and a frame is the pixel content for that
  layer at that moment.
- They can **add** a new (empty) frame, **duplicate** the current frame, **delete**
  a frame, and **reorder** frames by dragging.
- Selecting a frame makes it the active frame; the canvas shows that frame, and
  every drawing tool writes into the active layer's content *for that frame*.
- Layers persist across frames: adding a layer adds it to every frame; hiding a
  layer hides it in every frame. A Reference Layer is a tracing aid and does not
  animate — it shows identically under every frame.
- Undo/redo covers frame structure changes just like it covers layer changes.
- Their animation survives a refresh (session persistence) exactly like layers do.

This PRD changes **the web shell only**. The Apple shell preserves its single
`PixelCanvas` / `PixelCanvasHistory` interface, consistent with the precedent in
`docs/decisions/web-document-layer-apple-preserved.en.md`.

### Domain vocabulary (new — to be added to CONTEXT.md)

CONTEXT.md currently lists "frame" only as a term to *avoid* for Layer. This PRD
promotes Frame to a first-class concept and adds Cel. The Layer-avoidance note
stays valid (a Layer is still never called a frame); these are orthogonal axes.

- **Frame**: A position in the Document's animation sequence — one column in the
  Layer × Frame grid. Frames are ordered and position-numbered (displayed as
  their 1-based ordinal); there is always at least one. _Avoid_: keyframe (no
  interpolation here — every frame is fully drawn), cell (that's the grid
  intersection — see Cel), scene.
- **Cel**: The pixel buffer at one (Pixel Layer × Frame) intersection — the unit
  a drawing tool actually writes to. Every Pixel Layer has exactly one Cel per
  Frame; an "empty" frame simply means its Cels are transparent. (Standard
  animation term, from *celluloid*.) _Avoid_: tile, cell (ambiguous spelling),
  frame-layer.
- **Active Frame**: The frame currently displayed and edited. Drawing targets the
  Cel at (active Pixel Layer, active Frame). Mirrors the Active Layer pointer.
  _Avoid_: current frame (informal), selected frame.

## User Stories

1. As a pixel artist, I want a new Document to start with exactly one frame, so that nothing changes about the familiar single-image workflow until I choose to animate.
2. As a pixel artist, I want to see a frame ruler in the TimelinePanel, so that I can tell how many frames my animation has and which one I'm editing.
3. As a pixel artist, I want to add a new empty frame, so that I can draw the next pose from scratch.
4. As a pixel artist, I want the new frame to be inserted right after the frame I'm on, so that frames land where I expect rather than at the far end.
5. As a pixel artist, I want a newly added frame to become the active frame, so that I can immediately start drawing on it.
6. As a pixel artist, I want to duplicate the current frame, so that I can make a small change to the previous pose instead of redrawing it.
7. As a pixel artist, I want a duplicated frame to copy every layer's content for that frame, so that the whole composited image is preserved, not just one layer.
8. As a pixel artist, I want to delete a frame I no longer want, so that I can remove a bad pose.
9. As a pixel artist, I want deleting a frame to be rejected when only one frame remains, so that the Document is never left with zero frames.
10. As a pixel artist, I want an adjacent frame to become active after I delete the active frame, so that I'm never left without a selected frame.
11. As a pixel artist, I want to reorder frames by dragging, so that I can fix the timing/sequence of poses without redrawing them.
12. As a pixel artist, I want the frame I had active to stay active after a reorder, so that my place in the timeline follows the content I was working on.
13. As a pixel artist, I want to click a frame in the ruler to make it active, so that I can move between poses.
14. As a pixel artist, I want the canvas to show the active frame's composite, so that what I see is what I'm editing.
15. As a pixel artist, I want my drawing tools (pencil, eraser, fill, shapes) to write into the active layer's cel for the active frame, so that I'm painting on the right moment in time.
16. As a pixel artist, I want the active frame to be visually highlighted in the ruler, so that I never lose track of which moment I'm editing.
17. As a pixel artist, I want my existing layers to apply across all frames, so that I don't have to recreate my layer structure for every frame.
18. As a pixel artist, I want adding a layer to add it to every frame (transparent), so that the grid stays rectangular and predictable.
19. As a pixel artist, I want hiding or showing a layer to affect every frame, so that layer visibility is a property of the layer, not of a single moment.
20. As a pixel artist, I want the Reference Layer to show identically under every frame, so that my tracing reference is stable while I animate over it.
21. As a pixel artist, I want to undo a frame add/duplicate/delete/reorder, so that I can recover from a structural mistake.
22. As a pixel artist, I want redo to restore a frame operation I just undid, so that undo is reversible.
23. As a pixel artist, I want undo to restore both frame structure and the pixels in each cel, so that a single undo brings back the whole state, not a partial one.
24. As a pixel artist, I want selecting a frame to *not* consume an undo step, so that navigating the timeline doesn't pollute my history.
25. As a pixel artist, I want my frames and their per-cel pixels to survive a page refresh, so that I don't lose an animation in progress.
26. As an existing user with a saved single-image Document, I want it to open as a one-frame animation with no pixel loss, so that the upgrade is invisible to me.
27. As a pixel artist resizing the canvas, I want every frame's pixels resized with the same anchor, so that my whole animation stays consistent.
28. As a pixel artist flipping/rotating, I want the transform to apply to the active layer's active-frame cel (or the whole active frame), consistent with how it works today on a still image.
29. As a pixel artist exporting a PNG, I want it to export the frame I'm currently viewing, so that single-image export still does the obvious thing.
30. As a mobile user, I want the frame ruler available in the Timeline tab, so that I can manage frames on a small screen too.
31. As a pixel artist, I want frame operations to feel as responsive as layer operations, so that animating doesn't feel heavier than drawing.
32. As a returning user, I want the active frame I left off on to be restored on reload, so that I resume where I was.
33. As a pixel artist with an in-progress floating selection, I want switching frames to commit it first, so that lifted pixels land on the cel they came from rather than leaking into another frame.

## Implementation Decisions

### Frame model — Cel grid (Rust core, `crates/core/src/document.rs` + `layer.rs`)

Adopt the **Cel grid** interpretation confirmed during planning, matching PRD
086's committed "Layer × Frame grid":

- Layers persist across all frames (a Layer is a row that spans every frame).
- Each Pixel Layer × Frame intersection is a **Cel** (a `PixelCanvas`).
- A Reference Layer is **frame-independent**: it has no Cels and renders
  identically under every frame.

`Document` gains a frame axis:

- New field `frames: Vec<Frame>` — ordered, always non-empty (mirrors the
  layer-stack non-empty invariant).
- New field `active_frame_id: Uuid` — always points at a frame in `frames`.
- `Frame` is identity-only: `Frame { id: Uuid }`. Frames have **no persistent
  name or counter** — they display as their 1-based ordinal position. (Per-frame
  duration is intentionally deferred to the "per-frame speed control" item.)

Cels live **inside the Pixel Layer** (high cohesion: a Pixel Layer's data is its
Cels). The `LayerKind::Pixel` variant changes from holding one `PixelCanvas` to
holding one `PixelCanvas` per frame, keyed by frame id. `LayerKind::Reference`
is unchanged. The exact container (e.g. an id-keyed map vs. a frame-aligned vec)
is an implementation choice, constrained by this invariant:

> **Grid invariant**: for every Pixel Layer L and every Frame F there is exactly
> one Cel. A Pixel Layer's cel keys equal the Document's frame ids — no missing
> and no extra cels. (Sparse/linked cels are out of scope; an empty frame is
> transparent cels, not absent cels.)

Frame operations mirror the existing layer operations (same UUID-keyed,
active-pointer-preserving style):

- `add_frame(new_frame_id, per_layer_cel_ids…)` — insert a new Frame directly
  **after the active frame**; seed a **transparent** Cel for every Pixel Layer;
  make the new frame active. (The "empty frame" path.)
- `duplicate_frame(new_frame_id, …)` — insert a new Frame after the active frame;
  **clone every Pixel Layer's active-frame Cel** into it; make the new frame
  active. (The "duplicate" path — copies the whole composited moment.)
- `remove_frame(frame_id)` — remove the Frame and drop the corresponding Cel from
  every Pixel Layer. Returns `FrameError::RemoveLastFrame` when only one frame
  remains. If the removed frame was active, relocate the active pointer to an
  adjacent frame (down, else up) — same policy as `remove_layer`.
- `reorder_frame(frame_id, new_index)` — move within `frames`; clamp/validate the
  index; the active pointer is preserved by id.
- `set_active_frame(frame_id)` — change the active pointer (not undoable; see
  History below).

Cross-cutting changes to existing Document operations:

- **Composite**: `composite()` / `composite_for_export()` render the **active
  frame** — for each visible Pixel Layer, blend its active-frame Cel; the
  Reference Layer renders as today. (Per-arbitrary-frame composite for onion
  skin / export-all is out of scope here.)
- **Drawing**: `set_pixel`, `flood_fill`, `restore_active_layer_pixels`,
  `flip_*`, `rotate_*` target the active layer's **active-frame Cel**. Drawing
  with a Reference Layer active stays rejected (no Cel).
- **`add_layer`**: a new Pixel Layer must seed a transparent Cel for **every
  existing frame**, preserving the grid invariant.
- **`resize(w, h, anchor)`**: apply the anchor to **every Cel of every Pixel
  Layer** across all frames; Reference placement translation unchanged.
- **`Document::new`**: creates one Layer **and one Frame**, with that layer's
  single (transparent) Cel; `active_frame_id` = that frame.

New error type `FrameError` (`RemoveLastFrame`, `FrameNotFound`) implementing
`Display + Error`, mirroring `LayerError`. `crates/core` stays framework-free and
i18n-agnostic (frames carry no localized strings — the shell formats ordinals).

### Web-shell wiring (`DocumentChangeJournal` + WASM binding)

Frame operations route through the existing `DocumentChangeJournal` seam, exactly
as layer operations do:

- New **undoable** document intents: `add-frame`, `duplicate-frame`,
  `remove-frame`, `reorder-frame`. Each flows through the established
  snapshot → apply → after-mutation pipeline (push history, mutate WASM document,
  reclamp/invalidate-render/mark-dirty).
- New **persisted, non-undoable** UI intent: `set-active-frame` — mirrors
  `set-active-layer` (persisted, marks dirty, bypasses history).
- Switching the active frame first restores/commits any in-flight Floating
  Selection (the journal already restores the floating baseline before document
  intents) so lifted pixels land on their origin Cel.

The WASM `Document` binding gains the matching methods (`add_frame`,
`duplicate_frame`, `remove_frame`, `reorder_frame`, `set_active_frame`,
`frames_metadata()` / `active_frame_id()` / `frame_count()`), plus a cel read for
the panel (e.g. `cel_pixels_at(layerIndex, frameId)`) if the frame cells render
content. The cached layer projection in `TabState` already invalidates on
`renderVersion`; frame mutations bump it the same way.

### Persistence (`DocumentSchemaV5` → `V6` + migration)

- Bump the document record to **V6**. New fields: `frames: FrameRecord[]`
  (ordered ids), `activeFrameId: string`. `nextLayerNumber` stays; there is no
  `nextFrameNumber` (frames are position-numbered).
- `PixelLayerRecord.pixels: Uint8Array` (single) becomes
  `cels: { frameId: string; pixels: Uint8Array }[]` — one entry per frame.
  `ReferenceLayerRecord` is unchanged (frame-independent).
- **V5 → V6 migration**: synthesize one Frame; each Pixel Layer's single `pixels`
  becomes that frame's single Cel; `activeFrameId` = the synthesized frame. No
  pixel loss; history resets (consistent with prior schema migrations).
- The workspace `viewports` / `references` / `displayStates` records are
  unaffected (frame state is per-document, not per-viewport).

### UI (`TimelinePanel.svelte`)

Grow the existing placeholder frame-col into a real frame axis:

- Render a **column per frame**; the `[layer row × frame column]` cell shows that
  Cel's content (or an occupied/empty indicator — fidelity is a design-issue
  detail). The single-placeholder-column markup and the "frame ruler grows here"
  hint are replaced.
- A frame ruler/header carries the frame ordinals and the **add (＋)**,
  **duplicate**, and **delete** affordances, plus selection (click a frame to
  activate it). The active frame column is highlighted (combined fill + accent,
  matching the active-layer treatment for color-blind safety).
- Frames reorder by dragging frame headers (reuse the drag-reorder pattern the
  layer rows already use).
- Mobile: the existing 4th BottomTabs "Timeline" full-screen takeover gains the
  frame axis.
- Keep `TimelinePanel` a **pure view** (props in, callbacks out) — no WASM
  awareness — consistent with the 093 decision; the page/`TabState` owns the
  Document seam. Detailed pixel-level layout/tokens are produced via the
  `/ui-design` flow against `docs/pencil-dotorixel.pen` (sibling design slice,
  like 092 was for layers).

### Apple shell

Untouched. Frames are web-shell-only for now, exactly as the layer system was,
per `docs/decisions/web-document-layer-apple-preserved.en.md`. No Apple work in
this PRD.

## Testing Decisions

Good tests assert **external behavior**, not the internal Cel container. For the
core, that means asserting composite output, frame/active-frame metadata, and
error variants — never the private cel-map representation. Prefer the highest
seam that still isolates the unit.

- **Rust core `Document`** (inline unit tests — prior art: the 21 tests in
  `document.rs`, the `history.rs` tests). Highest-value seam: pure, fast,
  deterministic. Cover: `new` yields one frame + one cel; `add_frame` inserts
  after active and seeds transparent cels for every pixel layer; `duplicate_frame`
  reproduces the source frame's composite; `remove_frame` rejects the last frame
  (`RemoveLastFrame`) and relocates active to an adjacent frame; `reorder_frame`
  rearranges and preserves active by id; `composite` reflects the active frame
  and switches when active changes; drawing writes the active-frame cel only
  (other frames unchanged); `add_layer` seeds cels across all frames; `resize`
  maps every cel; the grid invariant holds after each mutation.
- **`DocumentChangeJournal`** (web-shell unit tests — prior art: the layer-intent
  journal tests). Cover: each frame intent produces the expected document state;
  undoable intents push history and mark dirty; `set-active-frame` marks dirty
  but does **not** push history; switching frames commits an in-flight floating
  selection first.
- **Persistence round-trip** (prior art: existing schema-migration tests). Cover:
  V6 serialize → deserialize preserves frames, activeFrameId, and per-cel pixels;
  V5 → V6 migration yields one frame with no pixel loss.
- **`TimelinePanel.svelte`** (Vitest + @testing-library/svelte, framework-only —
  prior art: `TimelinePanel.svelte.test.ts`). Cover: N frame columns for N
  frames; active frame highlighted (e.g. `aria-current`); add/duplicate/delete/
  reorder/select callbacks fire with the right ids.
- **E2E (Playwright)** — one tracer flow: add a frame, draw distinct content on
  it, switch frames and confirm the canvas differs, undo restores. Keep it thin;
  the unit seams carry the matrix.

## Out of Scope

- **Per-frame duration / speed control** — frames carry no duration yet (separate
  M4 item). `Frame` stays identity-only.
- **Timeline playback** (play/pause/loop in the editor) — separate M4 item.
- **Onion skinning** — needs per-arbitrary-frame composite; separate M4 item.
- **GIF / spritesheet export** — PNG export stays single-frame (active frame);
  multi-frame export is a separate M4 item.
- **Cel linking / sharing** (one buffer reused across frames) and **copy/paste
  cels across frames** — the grid is dense; every cel is independent for now.
- **Frame tags, groups, or ranges**.
- **Per-frame thumbnails at full fidelity** — an occupied/empty indicator is
  acceptable for the first slice; richer cel previews can follow.
- **Apple shell frames** — preserved single-canvas model.
- **The detailed `.pen` design** — produced by a sibling `/ui-design` slice, not
  this PRD.

## Further Notes

- This is the **M4 entry point**; sequencing matters. The Rust core cel-grid +
  frame operations should land first (dead-code-tolerant, like 087 was for
  layers), then the WASM binding, journal intents, persistence V6, and finally
  the TimelinePanel UI — each a vertical-ish slice that keeps `main` shippable.
- The cel-grid refactor touches the pixel-data hot path (`composite`, drawing,
  resize, export). Watch that single-frame documents pay no meaningful cost — the
  common case is still one cel per layer.
- CONTEXT.md must gain **Frame**, **Cel**, and **Active Frame** entries (see
  Domain vocabulary above) as part of this work, and the existing "avoid frame
  for Layer" note should be reconciled (the two axes are orthogonal).
- Consider whether the V5→V6 migration and the broader Rust↔TS cel serialization
  is the trigger to revisit the deferred "Evaluate serde-wasm-bindgen + tsify"
  todo item — the cel grid is exactly the kind of multi-type Rust↔JSON↔TS
  conversion that note anticipated.
