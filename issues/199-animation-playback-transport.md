---
title: "In-editor animation playback — transport strip + preview (M4)"
status: ready-for-agent
created: 2026-06-23
---

## Problem Statement

DOTORIXEL users can now author multi-frame animations with real timing. PRD 186
gave them frames (add / duplicate / delete / reorder); PRD 193 gave every frame an
editable **duration in milliseconds** — durable, undoable, the timing a walk
cycle's hold or an idle blink needs. But the editor **cannot play any of it back**.
The timing they author is invisible:

- The canvas only ever shows the **active frame** — one frozen moment. There is no
  way to watch the frames advance in sequence at their authored durations. The core
  `composite()` is hard-wired to `active_frame_id`; there is no per-arbitrary-frame
  composite to drive a preview.
- The TimelinePanel deliberately **reserved a transport strip slot** directly above
  the frame ruler (187 spec §6: "play/pause · FPS · loop") and left it a dim
  placeholder — "a later M4 slice inserts the transport strip … Not built here."
- PRD 193 was explicit that "this feature shows no motion on its own … the visible
  payoff arrives with the preview and export consumers." **Playback is that
  consumer.** Until it exists, a user retiming a pose is authoring blind — they set
  a duration and have no way to see whether the motion reads right.

Animation work is iterative: draw a pose, play it, adjust the timing, play again.
Without in-editor playback every timing decision is guesswork, and the whole
frame + duration investment so far is data the user can author but never witness.

## Solution

Give the editor a **Play control** that animates the Document in the main canvas —
cycling through the frames in order, holding each for its own authored duration —
and a **transport strip** (filling the reserved slot above the ruler) to drive it.

From the user's perspective:

- Press **Play** and the canvas cycles through the frames, holding each for the
  duration authored in the timeline (PRD 193). Press **Pause** to stop.
- A **Loop** toggle: on → playback repeats from the start; off → it plays once and
  settles, returning to the frame you were editing.
- Playback is a **preview, not an edit**. It never changes the artwork, never moves
  the frame you were editing (the Active Frame), never marks the document dirty, and
  never lands in undo history. When playback stops, the canvas is exactly where you
  left off — ready to keep drawing.
- A **playhead** shows which frame is currently displayed, so the motion connects
  back to the timeline.
- A frame held longer **lingers**; a frame held briefly **flashes by** — the timing
  authored is the timing seen. Per-frame durations remain the single source of
  truth; there is no separate global speed to keep in sync.
- Playback respects **layer visibility** and excludes the **Reference Layer**,
  exactly as the still composite does.
- Playback works on the **Timeline tab on mobile**, with touch-friendly controls.

This PRD changes the **web shell + Rust core only**. The Apple shell preserves its
single `PixelCanvas` / `PixelCanvasHistory` model, consistent with PRD 186 / 193
and `docs/decisions/web-document-layer-apple-preserved.en.md`.

This PRD **subsumes the separate "Animation preview — play/pause in editor" todo
item.** The transport strip is the control surface and the preview is what those
controls drive — one vertical slice. Splitting them would ship either a dead strip
(controls with nothing to control) or invisible playback (an engine with no
controls); neither is a shippable tracer.

### Domain vocabulary update (CONTEXT.md)

Two new terms join the **Frames & Cels** section. CONTEXT.md's **Active Frame**
entry already _avoids_ "playhead (a playback/timeline term, not the edit pointer)";
this PRD defines the term that note anticipated and draws the line between them.

- **Playback**: The transient, non-persisted preview that advances a **Playhead**
  through the Document's frames at their authored durations, compositing each in the
  canvas without mutating the Document or the Active Frame. The clock is runtime I/O,
  so Playback is **shell-owned**; it reads each frame's `duration_ms` and the core's
  per-frame composite. _Avoid_: animation (the artifact, not the act of previewing),
  preview (overloaded with thumbnails/exports), play mode.
- **Playhead**: The frame currently displayed during Playback — a transient pointer
  **separate from the Active Frame**. Playback advances it; it never persists and
  never becomes the edit pointer. When Playback stops, the canvas returns to the
  Active Frame. _Avoid_: active frame (the edit pointer — the orthogonal concept this
  is explicitly *not*), current frame (informal), cursor, scrubber (a future
  seek-drag affordance, out of scope here).

## User Stories

1. As a pixel artist, I want a Play control in the editor, so that I can watch my animation move instead of inspecting frames one at a time.
2. As a pixel artist, I want playback to hold each frame for the duration I authored, so that the timing I set in the timeline is the timing I see.
3. As a pixel artist, I want to Pause playback, so that I can stop the motion when I've seen what I needed.
4. As a pixel artist, I want a Loop toggle, so that I can watch a cycle repeat continuously while I judge it.
5. As a pixel artist, I want playback with Loop off to play once and settle, so that I can preview a one-shot sequence without it restarting forever.
6. As a pixel artist, I want playback to never alter my artwork, so that previewing is always a safe, read-only act.
7. As a pixel artist, I want playback to never move the frame I was editing, so that when I stop I'm exactly where I left off and can keep drawing.
8. As a pixel artist, I want pressing play/pause to never create an undo step, so that previewing doesn't pollute my history.
9. As a pixel artist, I want playback to never mark my document as needing a save, so that watching an animation doesn't trigger spurious auto-saves.
10. As a pixel artist, I want to see which frame is currently showing during playback, so that I can connect the motion back to the timeline.
11. As a pixel artist, I want a frame I made longer to visibly linger during playback, so that I can confirm a hold reads correctly.
12. As a pixel artist, I want a frame I made shorter to flash past, so that I can confirm a quick pass reads correctly.
13. As a pixel artist, I want playback to reflect my latest edits the next time I play, so that I'm always previewing the current state of the artwork.
14. As a pixel artist, I want playback to respect layer visibility, so that a hidden layer stays hidden in the preview just like in the still canvas.
15. As a pixel artist, I want the Reference Layer to stay out of playback, so that my tracing underlay never appears in the animation preview.
16. As a pixel artist with a single-frame document, I want the Play control to degrade gracefully (no surprising motion), so that playback is harmless when there's nothing to animate.
17. As a pixel artist, I want to stop playback and immediately keep drawing on my active frame, so that the preview → edit loop is fast.
18. As a pixel artist, I want the playback controls in the reserved transport strip above the frame ruler, so that they sit where the timeline already hinted they would.
19. As a mobile user, I want to play my animation on the Timeline tab, so that I can preview on a small screen.
20. As a mobile user, I want the play/pause and loop controls to be touch-friendly (≥44px), so that I can tap them reliably.
21. As a pixel artist with multiple tabs, I want playback to be per-document, so that playing one tab doesn't animate another.
22. As a pixel artist, I want switching tabs to stop playback of the tab I left, so that a backgrounded tab isn't still running a clock.
23. As a pixel artist with an in-progress lifted selection, I want it resolved when I start playback, so that the preview shows my committed artwork, not a half-floating edit.
24. As a pixel artist, I want every Play to start from a predictable point in the sequence, so that previews are repeatable.
25. As a pixel artist, I want the play/pause control to clearly show whether it's currently playing, so that I always know the state at a glance.
26. As a pixel artist, I want the loop toggle to clearly show whether looping is on, so that I know whether the preview will repeat.
27. As a keyboard user, I want to reach and toggle the transport controls with the keyboard, so that playback is operable without a pointer.
28. As a screen-reader user, I want the play/pause and loop controls to announce their state, so that playback is usable without sight.
29. As a pixel artist, I want playback timing to stay smooth and not drift badly across a long loop, so that the preview is trustworthy.
30. As a pixel artist, I want retiming a frame and replaying to be an immediate feedback loop, so that I can dial in timing quickly.
31. As a returning user, I want playback state to simply not persist (a document always opens stopped), so that reopening never resumes a runaway animation.
32. As a developer, I want the per-frame composite to come from one core method shared by playback, onion skinning, and GIF export, so that all three agree on how a frame composites.

## Implementation Decisions

The seams below were reviewed with the maintainer. Two decisions anchor the slice:
(1) **scope** — Timeline UI (transport strip) and "Animation preview (play/pause)"
are merged into this one in-editor-playback PRD; (2) **playback architecture** — a
**transient playhead** driven by a shell-side clock that composites arbitrary frames
through one new core seam, **never touching the Active Frame**. The rejected
alternative (advance the `active_frame_id` pointer via `set_active_frame`) was
declined because at 10 fps it would mark the document dirty and commit any floating
selection on every tick, and would leave the edit pointer wherever playback stopped
— playback would pollute edit state. The transient playhead keeps previewing and
editing cleanly separate.

### Per-frame composite — one new core seam (`crates/core/src/document.rs`)

The single new core primitive is a **per-arbitrary-frame composite**:

- `composite_at(&self, frame_id: Uuid) -> Vec<u8>` — the same straight source-over
  blend `composite()` does today, but for the **requested** frame's cels rather than
  the active frame's. Reference Layers stay excluded from pixel buffers; layer
  visibility and opacity apply identically.
- The existing `composite()` becomes `self.composite_at(self.active_frame_id)` — one
  definition of "how a frame composites", with the active-frame composite a special
  case. No behavior change for existing callers.
- Per "fail at the boundary, trust the core", `composite_at` trusts a valid
  in-document `frame_id` (it relies on the same grid invariant `composite()` already
  `expect`s on). Validation lives at the WASM boundary (below).

This is the **shared seam the rest of M4 stands on**: onion skinning needs the
composite of adjacent frames; GIF/spritesheet export needs every frame's composite.
PRD 186 explicitly deferred "per-arbitrary-frame composite for onion skin /
export-all" to exactly these consumers — this PRD builds it, and the others reuse it.

### WASM binding + facade (`wasm/src/lib.rs`, `src/lib/canvas/canvas-model.ts`)

- New `WasmDocument::composite_at(&self, frame_id: String) -> Result<Vec<u8>, JsError>`
  — parses the UUID and confirms the frame exists, then delegates to the core; errors
  only on an invalid UUID / unknown frame (the shell only ever passes ids from
  `frames_metadata()`, so it never errors in practice). This is the **read-only**
  sibling of the existing `composite()` getter.
- The TS `Document` facade gains `composite_at(frameId)`; the `fake-drawing-ops.ts`
  fake gains it too (returning the appropriate per-frame buffer for interface
  conformance). The structural-compatibility check in `wasm-sync.test.ts` keeps the
  facade and the binding in lockstep, as it does for every other method.
- **No mutation methods are added** — playback reads; it never writes. There is no
  new document intent and no journal change.

### Shell playback controller (`src/lib/canvas/…`, per-tab)

A new **playback controller** owns playback for a tab — the transient state and the
clock — and is the only place that knows about time:

- **State (transient, never persisted):** `isPlaying`, `isLooping`, and the current
  **playhead** frame. None of it enters the document schema, the WASM document, the
  history, or the workspace snapshot. A tab always starts stopped.
- **Clock:** a `requestAnimationFrame` loop accumulates elapsed wall-clock time and
  advances the playhead when the accumulated time reaches the **current playhead
  frame's `duration_ms`** (read from `frames_metadata()`); leftover time carries into
  the next frame so variable durations and sub-frame deltas don't drift. At the
  sequence end it loops to the first frame (Loop on) or stops (Loop off). The canvas
  is **re-composited only when the playhead frame actually changes**, not every rAF
  tick — a 100 ms frame composites once, not six times.
- **Testability seam:** the advance decision is extracted as a **pure function** —
  `(playheadIndex, accumulatedMs, durations, isLooping) → { nextIndex, carryMs,
  stopped }` — so the timing logic is unit-tested deterministically with synthetic
  elapsed values, with the rAF loop a thin wrapper that only feeds it real deltas.
  This is the new seam designed for testability; the clock wiring itself stays
  un-asserted.
- **Start resolves edit state:** starting playback first commits any in-flight
  **Floating Selection** (mirroring the active-frame-switch precedent in PRD 186), so
  the preview shows the committed Document rather than a half-lifted edit.
- **Stop returns to the Active Frame:** stopping (Pause, Loop-off completion, or a
  document/tab change) discards the playhead; the canvas returns to the Active Frame,
  which never moved. (Aseprite precedent: play is a transient preview; stopping
  returns you to the frame you were on.) **Play starts from the first frame** for a
  predictable, repeatable preview; "play from the active frame" is a later refinement
  the design slice may revisit.
- **Lifecycle:** switching tabs, closing a tab, or a structural document change
  (e.g. deleting the frame under the playhead) **stops playback** — a backgrounded or
  invalidated tab never keeps a clock running.

### Display-buffer seam — the renderer is unchanged

The renderer already paints whatever the editor-controller's `compositeBuffer`
exposes (`editor-controller.svelte.ts` → `workspace.activeTab.compositeBuffer`).
Playback feeds **that same seam**:

- While playing, the displayed buffer is `document.composite_at(playheadFrameId)`
  (no Floating Selection overlay — playback previews committed art); while stopped it
  is the normal edit composite (active frame + floating overlay) exactly as today.
- The override lives at the `compositeBuffer` boundary (the controller / `TabState`
  returns the playhead composite while playing), so **the renderer, the viewport, and
  every downstream consumer are untouched.** One core seam (`composite_at`) + one
  shell seam (the display buffer) carry the whole feature.

### Transport strip UI — leading `.pen` design slice, then a pure view

Per the 187 / 194 precedent (timeline UI is designed in `docs/pencil-dotorixel.pen`
first, then implemented against the spec), the transport strip is **designed in a
leading `/ui-design` slice** before the shell wiring. 187 only reserved a dim
placeholder ("play/pause · FPS · loop"); the actual control set, layout, and playhead
treatment are unspecified, so there is no mockup to implement yet.

Design intent the spec should resolve:

- A **transport strip** in the reserved slot above the ruler, carrying at minimum
  **Play/Pause** (a toggle that shows its state) and a **Loop** toggle (showing its
  state). The 187-mentioned "FPS" is **not** a global-speed control — per PRD 193,
  per-frame ms is the source of truth; any fps shown is a derived read-out, not an
  input.
- A **playhead** indication while playing — distinct from the Active-Frame highlight
  (which marks the edit pointer and does not move during playback). Whether the
  playhead is a moving marker over the ruler, a highlighted ruler cell, or a strip
  read-out is the design slice's decision.
- Exact affordance split (single Play/Pause toggle vs. separate Play / Pause / Stop),
  start-from-where, and any single-frame disabled state are design decisions; the PRD
  pins only the contracts above. Light + Dark via tokens; mobile (Timeline tab) touch
  targets ≥44px.

Implementation (after the design lands), keeping the strip a **pure view** (props in,
callbacks out — the 093 decision, exactly as `TimelinePanel` is):

- A new transport-strip component (or a strip region of `TimelinePanel`) takes
  `isPlaying`, `isLooping`, and playhead/frame-count props, and emits `onPlay` /
  `onPause` (or a single `onTogglePlay`) and `onToggleLoop` callbacks, wired in
  `+page.svelte` (docked + mobile instances) to the playback controller — mirroring
  how `onReorderFrame` → `tab.reorderFrame` is wired.
- New i18n keys (en / ko / ja) for the play / pause / loop labels and aria-state.

### Persistence

**None.** Playback (`isPlaying`, playhead) is transient, like a Floating Selection or
a Sampling Session — it never persists. **No schema bump** (the V7 record from PRD
193 is unchanged). `isLooping` is also transient for this slice (a document opens with
a default loop state); persisting it as a UI preference is a possible future refinement
and is intentionally out of scope to keep the tracer free of a schema change.

### Apple shell

Untouched. In-editor playback is web-shell + core only, exactly as the frame axis and
per-frame timing were, per `docs/decisions/web-document-layer-apple-preserved.en.md`.

## Testing Decisions

Good tests assert **external behavior** — the composite a frame produces, the
playhead's position over synthetic time, and the invariant that the Document and
Active Frame are untouched by playback — never the internal timer or controller
representation. Prefer the highest seam that still isolates the unit; the pure advance
function and the `TabState` real-WASM integration tests are the top behavior seams.

- **Rust core `Document`** (inline unit tests — prior art: the composite tests in
  `document.rs`). Cover: `composite_at(frame_id)` returns the requested frame's
  composite (distinct from the active frame's when their cels differ); `composite()`
  equals `composite_at(active_frame_id)`; compositing a non-active frame leaves
  `active_frame_id` and the active composite unchanged; visibility/opacity and
  Reference-Layer exclusion behave as in `composite()`.
- **WASM binding** (prior art: the frame-method + composite unit tests in
  `wasm/src/lib.rs`). Cover: `composite_at(frameId)` round-trips a known frame's
  buffer; an unknown frame / invalid UUID errors; calling it does not mutate the
  active frame.
- **Playback advance (pure function)** — the highest-value new seam. Cover, with
  synthetic elapsed values (no real rAF): the playhead advances when accumulated time
  reaches the current frame's duration; a longer-duration frame holds proportionally
  longer; leftover time carries into the next frame (no drift); the sequence loops
  with Loop on and stops on the last frame with Loop off; a single-frame sequence
  never advances.
- **`TabState` / playback controller** (real-WASM integration — prior art: the frame
  integration tests from 189/192). Cover: starting playback exposes the playhead
  composite through the display buffer while leaving the Active Frame and document
  state unchanged; stopping returns the display buffer to the active-frame composite;
  starting playback commits an in-flight floating selection; no playback action pushes
  a history entry or marks the document dirty; a tab/document change stops playback.
- **Transport strip `.svelte`** (Vitest + @testing-library/svelte, framework-only —
  prior art: `TimelinePanel.svelte.test.ts`). Cover: play/pause and loop controls
  fire their callbacks; the controls reflect `isPlaying` / `isLooping` (e.g.
  `aria-pressed`); the strip renders in the reserved slot.
- **E2E (Playwright)** — one thin tracer (prior art: `e2e/editor/frames.test.ts`):
  author two frames with distinct content, press Play, assert the playhead advances
  (a stable data attribute, not a pixel-diff race), press Pause and confirm the canvas
  is back on the active frame, and confirm playback created **no** undo entry and left
  the active frame unchanged. Playback smoothness/exact timing is not asserted in E2E
  — the pure-function tests carry the timing matrix.

## Out of Scope

- **GIF / spritesheet export** — a consumer of `composite_at` (per-frame composite),
  but a separate M4 item. PNG export stays single-frame (active frame).
- **Onion skinning** — also a consumer of `composite_at` (adjacent-frame composite);
  separate M4 item.
- **Global FPS / playback-speed multiplier** (0.5× / 1× / 2×, "set fps for all
  frames") — per PRD 193, per-frame ms is the source of truth; a global speed is a
  thin future layer, not this slice. Any fps in the strip is a derived read-out only.
- **Timeline scrubbing / seek-drag** — dragging a playhead along the ruler to scrub
  to a frame. Frame *reorder* drag already exists; seek-drag is a separate affordance.
- **Persisting playback / loop state** — playback is transient; no schema change.
- **Audio, frame ranges, loop points / tags, ping-pong playback, easing/tweening** —
  every frame is an explicit hold; no interpolation.
- **Per-frame thumbnails at full fidelity** — unrelated to playback.
- **Apple shell playback** — preserved single-canvas model.

## Further Notes

- **Sequencing** (each slice keeps `main` shippable, mirroring 186 → 187 → 188 … and
  193's 194 → core → wasm → schema → UI). Note there is **no schema step** — playback
  is transient:
  1. **`.pen` design slice** (`/ui-design`) — the transport strip + playhead
     treatment (HITL leading slice, sibling to 187 / 194).
  2. **Core** — `composite_at(frame_id)` + `composite()` delegating to it
     (dead-code-tolerant; existing composite behavior unchanged).
  3. **WASM + facade** — `composite_at(frameId)` getter, TS facade + fake +
     `wasm-sync` structural check.
  4. **Shell playback controller** — transient playhead, the pure advance function +
     rAF wrapper, the display-buffer override, floating-commit-on-start, stop-on-tab/
     document-change.
  5. **UI** — transport strip wired against the design, i18n, E2E.

  `/to-issues` will cut these into independently-grabbable tracer slices.
- **This slice subsumes the "Animation preview — play/pause in editor" todo item.**
  Reconcile `tasks/todo.md` (and `progress.md` Next Up) so the two M4 lines — "Timeline
  UI" and "Animation preview" — collapse into this one PRD-linked entry.
- **`composite_at` is the high-leverage seam.** It is the one new core primitive, and
  it is reused verbatim by the next two M4 items (onion skinning, GIF/spritesheet
  export). Building it well here — pure, framework-free, the generalization of
  `composite()` — pays the whole animation cluster forward.
- **Playback never enters history or persistence.** This is the load-bearing
  invariant that made the transient-playhead architecture the right call over driving
  the active-frame pointer: previewing must be free of edit side effects (no dirty
  mark, no undo entry, no floating-selection churn, no moved edit pointer).
- **Smoothness vs. correctness.** The accumulator-with-carry advance keeps long loops
  from drifting; rAF naturally pauses when the tab is backgrounded (acceptable). The
  preview is a fidelity aid, not a frame-accurate render target — the export slice,
  not playback, owns exact timing fidelity.
- CONTEXT.md gains **Playback** and **Playhead** in the Frames & Cels section (see
  Domain vocabulary update above); the **Active Frame** entry's existing _avoid_ note
  on "playhead" now points at a defined term.
