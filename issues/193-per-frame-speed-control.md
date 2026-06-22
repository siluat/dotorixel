---
title: "Per-frame speed control — per-frame duration (M4)"
status: done
created: 2026-06-21
---

## Problem Statement

DOTORIXEL users can now author multi-frame animations — add, duplicate, delete,
and reorder frames (PRD 186) that survive a refresh. But every frame is held for
the **same, invisible amount of time**. There is no way to say "hold this pose
longer" or "snap through these three frames quickly":

- A `Frame` is identity-only (`Frame { id }`) — it carries no duration. The
  decision to add one was explicitly deferred from 188 to this item, and the
  read seam was pre-shaped for it: `frames_metadata()` returns a
  `FrameMetadata` struct (not a bare id) precisely so a duration can be added
  "without reshaping the read" (189 key decision).
- The TimelinePanel shows frames as uniform columns with no timing affordance.
- The whole downstream animation cluster that *consumes* timing — animation
  preview (play/pause), GIF/spritesheet export — has no per-frame duration to
  read. They are blocked on this data existing and persisting.

Real animation is built on **timing**: a walk cycle's contact pose holds longer
than its passing pose; an idle blink is two fast frames inside a long hold.
Without per-frame duration, every animation DOTORIXEL can author is locked to a
single uniform cadence.

## Solution

Give every **Frame a duration in milliseconds** — the length of time that frame
is shown — and let the user edit it per frame.

From the user's perspective:

- Every frame has a duration. A new Document's frame, and every frame added
  afterward, starts at a sensible default (100 ms ≈ 10 fps), so nothing about the
  current workflow changes until the user chooses to retime.
- The user can **select a frame and change how long it is held**, in
  milliseconds. The change is immediate and is reflected wherever the frame's
  timing is shown.
- **Duplicating** a frame copies its duration (the duplicate is the same pose,
  held the same length); **adding** an empty frame uses the default.
- Reordering frames carries each frame's duration with it (timing is a property
  of the frame, not of its position).
- **Undo/redo** covers a duration change, just like it covers adding or deleting
  a frame — retiming is an edit to the artwork, not navigation.
- Per-frame durations **survive a refresh**, exactly like frames and per-cel
  pixels do today.
- An existing saved animation opens with every frame at the default duration, with
  no pixel loss — the upgrade is invisible.

This PRD authors and persists the timing data and exposes a per-frame editing
control. It deliberately does **not** play the animation back — preview and GIF
export are the consumers of this data and are separate M4 items. The payoff of
this slice is that the timing exists, is editable, and is durable, so those
consumers have something to read.

This PRD changes **the web shell + Rust core only**. The Apple shell preserves
its single `PixelCanvas` / `PixelCanvasHistory` model, consistent with PRD 186
and `docs/decisions/web-document-layer-apple-preserved.en.md`.

### Domain vocabulary update (CONTEXT.md)

No new term is introduced — **Frame** is amended. CONTEXT.md currently defines a
Frame as "identity only, carrying no persistent name, counter, **or duration**".
This PRD promotes duration to a first-class per-frame attribute, so:

- The Frame entry drops "or duration" and notes that a Frame now carries a
  **duration** (its display time, in milliseconds) alongside its identity; it is
  still nameless and counterless (displayed as its 1-based ordinal).
- The Cel entry's `_Avoid_` note ("a Frame is the time slot itself") stays valid.
- A short clarification is added that duration is **mutable metadata, not
  identity**: a retimed frame is the same frame (id unchanged).

## User Stories

1. As a pixel artist, I want every frame to have a duration, so that my animation has timing rather than a fixed uniform cadence.
2. As a pixel artist, I want a brand-new Document's single frame to start at a sensible default duration, so that I don't have to set timing before I've even animated.
3. As a pixel artist, I want each frame I add to start at the default duration, so that new frames are predictable.
4. As a pixel artist, I want to select a frame and change how long it is held, so that I can make a pose linger or pass quickly.
5. As a pixel artist, I want to set the duration in milliseconds, so that I have precise, standard control over timing (the unit every animation tool and the GIF format speak).
6. As a pixel artist, I want to see the active frame's current duration, so that I know what I'm changing from.
7. As a pixel artist, I want my duration change to take effect immediately, so that the editor reflects the value I just set.
8. As a pixel artist, I want a duration that's too small or too large to be clamped to a safe range rather than corrupting the document, so that I can't enter an invalid timing.
9. As a pixel artist, I want duplicating a frame to copy its duration, so that the duplicate holds for the same time as the pose it came from.
10. As a pixel artist, I want adding an *empty* frame to use the default duration, so that a fresh frame is a clean slate in both pixels and timing.
11. As a pixel artist, I want reordering frames to carry each frame's duration along, so that moving a pose doesn't change how long it's shown.
12. As a pixel artist, I want deleting a frame to leave the other frames' durations untouched, so that one deletion doesn't retime the rest.
13. As a pixel artist, I want to undo a duration change, so that I can recover the previous timing after a mistake.
14. As a pixel artist, I want redo to restore a duration change I just undid, so that retiming is reversible like every other edit.
15. As a pixel artist, I want selecting a frame to *not* consume an undo step, so that navigating the timeline to read or retime a frame doesn't pollute history (selection stays non-undoable; only the duration change is the undo step).
16. As a pixel artist, I want rapidly dragging/scrubbing a duration value to collapse into a single undo step per adjustment, so that one retime isn't shredded into dozens of history entries.
17. As a pixel artist, I want my per-frame durations to survive a page refresh, so that I never lose the timing I authored.
18. As a returning user with a saved single-image or pre-timing animation, I want it to open with every frame at the default duration and no pixel loss, so that the upgrade is invisible.
19. As a pixel artist, I want my per-frame timing to be carried through duplicating a tab / reopening saved work, so that the whole document — including timing — round-trips.
20. As a pixel artist, I want the duration control to live with the frame I've selected in the timeline, so that retiming is where I already manage frames, not in a disconnected panel.
21. As a mobile user, I want to edit a frame's duration on the Timeline tab, so that I can retime on a small screen too.
22. As a pixel artist, I want the per-frame duration I set to be the data that a future Play button and GIF export read, so that the timing I author is the timing that plays and exports.
23. As a developer, I want the default duration defined in exactly one place, so that the core, the schema migration, and the UI never disagree on what "default" means.

## Implementation Decisions

The seams below were reviewed with the maintainer. The chosen data model is
**per-frame milliseconds as the source of truth** (no separate global FPS in this
slice), and the per-frame editing UI is produced via a **leading `.pen` design
slice** (sibling to 187), implemented against afterward.

### Data model — duration on `Frame` (Rust core, `crates/core/src/frame.rs` + `document.rs`)

- `Frame` gains a `duration_ms: u32` field. It stays a small `Copy` value type:
  `Frame { id, duration_ms }`.
- The default duration is a single named constant — `Frame::DEFAULT_DURATION_MS`
  (= 100, i.e. 10 fps). `Frame::INITIAL` carries that default. This is the one
  source of truth the TS migration default must mirror (see User Story 23).
- **Identity stays id-based.** Duration is mutable metadata, not identity — a
  retimed frame is the same frame. `Frame`'s equality/hash must remain keyed on
  `id` only (implement them on `id`, or drop the now-ambiguous `PartialEq`/`Eq`/
  `Hash` derives if no by-value use remains). The cel store is keyed by frame
  `Uuid`, not by `Frame`, so the grid invariant is unaffected.
- New core operation: `set_frame_duration(frame_id, duration_ms)` — updates the
  frame's duration; `FrameError::FrameNotFound` for an unknown id. Mirrors the
  existing frame ops' UUID-keyed style.
- `add_frame` seeds the new frame at `DEFAULT_DURATION_MS`; `duplicate_frame`
  copies the source frame's `duration_ms` (the duplicate is the same moment, held
  the same length). `remove_frame` / `reorder_frame` carry durations untouched
  (they already move/drop whole `Frame`s, so duration follows for free).
- **Range / clamping is a boundary concern, not core's.** Per "fail at the
  boundary, trust the core", `set_frame_duration` in the core trusts a valid
  value; the WASM binding (and the journal guard) clamp to a sane range —
  **1 ms … 60_000 ms** — before it reaches the core. `0` (instant) and
  sub-millisecond are out of scope. The min/max are sane defaults, adjustable.

### WASM binding + facade (`wasm/src/lib.rs`, `src/lib/canvas/canvas-model.ts`)

- `WasmFrameMetadata` gains a `duration_ms` getter — filling the seam its own doc
  comment reserved ("leaves room for per-frame attributes (e.g. a duration for
  playback speed) without reshaping the read"). `frames_metadata()` now carries
  `{ id, duration_ms }` per frame.
- New `WasmDocument::set_frame_duration(id: String, duration_ms: u32)` — parses
  the UUID, clamps `duration_ms` to `[1, 60_000]`, delegates to the core. Errors
  only on an invalid UUID / unknown frame (clamping never errors).
- The TS `FrameMetadata` interface gains the matching duration field, and the
  `Document` facade gains `set_frame_duration`. The structural-compatibility
  check in `wasm-sync.test.ts` keeps the facade and the binding in lockstep.
- The `fake-drawing-ops.ts` `Document` fake gains the method + duration on its
  frame metadata (interface conformance).

### Web-shell wiring (`DocumentChangeJournal` + `TabState`)

- New **undoable** document intent: `set-frame-duration { id, durationMs }`. It
  flows through the established snapshot → apply → after-mutation pipeline (push
  history, mutate WASM document, invalidate-render + mark-dirty). Like the other
  frame ops it does **not** reclamp the viewport (timing changes neither canvas
  dimensions nor the active layer).
- **No-op guard:** the intent is a no change (skips history) when the target
  frame's current duration already equals the requested value — mirroring the
  `set-layer-visibility` `willChange` guard. This also makes idempotent re-sets
  free.
- **Coalescing rapid edits (User Story 16):** the *committed* value is what
  becomes one undo step. A scrub/drag UI must dispatch the intent on **commit**
  (release / blur / Enter), not on every intermediate value — so one retime = one
  history entry. (If the chosen control is a plain numeric input that only emits
  on change/blur, this falls out naturally.) The PRD's contract is "one user-level
  duration adjustment is one undo step"; the exact debounce/commit mechanics are a
  UI-slice detail.
- `TabState` gains a `setFrameDuration(id, durationMs)` dispatch, alongside the
  existing `addFrame` / `duplicateFrame` / `removeFrame` / `reorderFrame` /
  `setActiveFrame` methods.

### Persistence (`DocumentSchemaV6` → `V7` + migration)

- Bump the document record to **V7** (`DB_VERSION` 6 → 7). The only change:
  `FrameRecord` gains a `duration` (ms) field. `frames`, `activeFrameId`, the cel
  grid, layers, and the workspace viewport/reference/display-state records are
  all unchanged.
- **V6 → V7 migration**: every existing `FrameRecord` gains
  `duration = DEFAULT_DURATION_MS`. Lossless — no pixel or structure change;
  history resets, consistent with prior schema migrations. (V5/earlier still
  route through the existing V5→V6 step first, then V6→V7.)
- The workspace **snapshot already carries `readonly FrameRecord[]`**
  (`TabSnapshot.frames`), so once `FrameRecord` has `duration` the snapshot
  transports it automatically. Two call sites do real work:
  - `tab-state.svelte.ts` `toSnapshot` reads each frame's `duration` from
    `frames_metadata()` into the snapshot's `FrameRecord`s.
  - `wasm-backend.ts` `documentFromLayerSource` applies each frame's duration on
    rebuild via `set_frame_duration` (after the frame exists), so a reopened /
    duplicated document restores timing. Legacy single-buffer sources build one
    frame at the default.
- The deferred **serde-wasm-bindgen + tsify** evaluation is still **not**
  triggered: a single `u32` per frame crosses the boundary as a metadata getter,
  not a multi-type Rust↔JSON↔TS payload.

### UI — leading `.pen` design slice, then TimelinePanel wiring

Per the maintainer decision, the per-frame duration control is **designed in
`docs/pencil-dotorixel.pen` first** (a `/ui-design` slice, sibling to the 187
frame-ruler spec), then implemented against that spec. 187 deliberately left
per-frame-speed UI out of scope ("No … per-frame speed UI beyond the reserved
strip"), so there is no existing mockup.

Design intent the spec should resolve (not the reserved transport strip — that is
**global** playback, a separate item):

- A **per-frame** duration editor bound to the **active frame** (reuse the
  existing ruler frame-selection — click a frame, edit its duration). Unit:
  **milliseconds**; fps may be shown as a derived read-only helper if the design
  calls for it.
- Where it sits relative to the ruler/header/collapsed-readout, the control type
  (numeric input vs. stepper vs. scrub), and how the value is surfaced per frame
  (e.g. a small ms caption under occupied ruler cells, or active-frame-only) are
  the design slice's decisions. Light + Dark via tokens; mobile (Timeline tab)
  touch targets ≥44px.

Implementation (after the design lands), keeping `TimelinePanel` a **pure view**
(props in, callbacks out — the 093 decision):

- `FrameColumn` gains a `durationMs` field; the panel renders the active frame's
  duration per the design.
- A new `onSetFrameDuration(frameId, durationMs)` callback prop, wired in
  `+page.svelte` (both docked + mobile instances) to `tab.setFrameDuration`,
  mirroring how `onReorderFrame` → `tab.reorderFrame` is wired.
- New i18n keys (en / ko / ja) for the duration control's label / aria.

### Apple shell

Untouched. Per-frame timing is web-shell + core only, exactly as the frame axis
itself was, per `docs/decisions/web-document-layer-apple-preserved.en.md`.

## Testing Decisions

Good tests assert **external behavior** — a frame's reported duration, the
composite, history push/no-push, and round-tripped persisted values — never the
internal frame/cel representation. Prefer the highest seam that still isolates the
unit; the `TabState` real-WASM integration tests are the top behavior seam, as
they were for 189/192.

- **Rust core `Document`** (inline unit tests — prior art: the 25 frame tests in
  `document.rs` from 188). Cover: `new` / `add_frame` seed `DEFAULT_DURATION_MS`;
  `duplicate_frame` copies the source duration; `set_frame_duration` updates the
  target and `FrameNotFound` for an unknown id; `remove_frame` / `reorder_frame`
  leave other frames' durations intact and preserve a moved frame's duration by
  id. Assert via `frames()` metadata, never a private field.
- **WASM binding** (prior art: the frame-method unit tests in `wasm/src/lib.rs`).
  Cover: `frames_metadata()` carries `duration_ms`; `set_frame_duration`
  round-trips through `frames_metadata()`; out-of-range values clamp to
  `[1, 60_000]`; invalid UUID / unknown frame errors.
- **`DocumentChangeJournal`** (prior art: the 8 frame-intent journal tests from
  189). Cover: `set-frame-duration` produces the expected duration; it pushes a
  history entry and marks dirty; it is a no-op (no history push) when the value is
  unchanged; `set-active-frame` is still non-undoable.
- **`TabState`** (real-WASM integration — prior art: the 7 frame integration tests
  from 189). Cover: `setFrameDuration` updates document state; undo restores the
  prior duration and redo re-applies; selecting a frame is not an undo step;
  duration survives a snapshot → Document → snapshot round-trip.
- **Persistence** (prior art: the V5→V6 migration + multi-frame round-trip tests
  from 190/192). Cover: a V7 record serialize → deserialize preserves every
  frame's `duration`; a V6 record migrates to V7 with every frame at
  `DEFAULT_DURATION_MS` and no pixel loss; `documentFromLayerSource` rebuilds a
  multi-frame document with durations intact.
- **`TimelinePanel.svelte`** (Vitest + @testing-library/svelte, framework-only —
  prior art: `TimelinePanel.svelte.test.ts`). Cover: the control displays the
  active frame's duration; editing fires `onSetFrameDuration` with the right id
  and value; the control is bound to whichever frame is active.
- **E2E (Playwright)** — one tracer flow (prior art: `e2e/editor/frames.test.ts`):
  set a frame's duration, reload, confirm the value persisted; undo restores the
  prior value. Playback timing is not asserted (no preview in this slice) — the
  tracer verifies the authored value is durable and undoable.

## Out of Scope

- **Animation playback / preview** (play / pause / loop in the editor) — the first
  *consumer* of per-frame duration, but a separate M4 item.
- **GIF / spritesheet export** — also a consumer (GIF stores per-frame delays in
  centiseconds; ms maps cleanly). Separate M4 item; PNG export stays single-frame.
- **Global FPS / "set duration for all frames" convenience** — per-frame ms is the
  source of truth; a global FPS or bulk-apply is a thin future layer on top, not
  this slice.
- **Onion skinning** — unrelated; separate M4 item.
- **Sub-millisecond durations** and **easing / interpolation between frames** —
  every frame is an explicit hold; no tweening.
- **Frame tags / ranges / loop points / per-tag timing**.
- **Apple shell per-frame timing** — preserved single-canvas model.

## Further Notes

- **Sequencing** (each slice keeps `main` shippable, mirroring 186 → 187 → 188 …):
  1. **`.pen` design slice** (`/ui-design`) — the per-frame duration control
     (HITL, leading slice).
  2. **Core** — `Frame.duration_ms` + `DEFAULT_DURATION_MS` + `set_frame_duration`
     + add/duplicate seeding (dead-code-tolerant; single-frame behavior unchanged).
  3. **WASM + journal + TabState** — metadata getter, `set_frame_duration`, the
     undoable intent, dispatch.
  4. **Schema V7** — `FrameRecord.duration` + V6→V7 migration + snapshot transport
     (`toSnapshot` / `documentFromLayerSource`).
  5. **UI** — TimelinePanel control wired against the design, i18n, E2E.

  `/to-issues` will cut these into independently-grabbable tracer slices.
- **This feature shows no motion on its own.** Its value is *authored, editable,
  durable timing data*; the visible payoff arrives with the preview and export
  consumers. Reviewers and the demo should expect "set a duration, see the
  readout, reload, it persists, undo restores" — not playback. Worth stating so
  the slice isn't judged against a moving canvas it doesn't yet produce.
- **One default, one place.** `Frame::DEFAULT_DURATION_MS` in the core is the
  single source of truth; the V6→V7 migration default and any UI placeholder must
  reference a mirror of it, not a re-typed literal (User Story 23). This is the
  same cross-shell "single source of truth for a shared constant" discipline the
  design tokens follow.
- **GIF export forward-compat:** GIF's Graphic Control Extension stores delay in
  centiseconds (1/100 s), so the export slice will convert ms → cs at encode time.
  Storing ms (a clean superset) now keeps that conversion lossy-only at the GIF
  boundary, never in DOTORIXEL's own model.
- CONTEXT.md's **Frame** entry must be updated as part of this work (drop "or
  duration"; note duration is mutable metadata, not identity) — see Domain
  vocabulary update above.
