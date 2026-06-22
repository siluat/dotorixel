---
title: "Per-frame duration — TimelinePanel control + i18n + E2E"
status: done
created: 2026-06-21
parent: 193-per-frame-speed-control.md
---

## Parent

[193 — Per-frame speed control (per-frame duration, M4)](193-per-frame-speed-control.md)

## What to build

Complete PRD 193 by wiring the per-frame duration control into the TimelinePanel
per the [194 design spec](194-per-frame-duration-design.md): the user selects a
frame and edits how long it is held, with undo/redo, persistence, and an E2E
tracer. This is the end-to-end demoable slice (the capstone, as 192 was for frame
management).

- `FrameColumn` gains a `durationMs` field; the panel renders the **active
  frame's** duration per the 194 design.
- A new `onSetFrameDuration(frameId, durationMs)` callback prop, wired in
  `+page.svelte` on **both** the docked and mobile TimelinePanel instances to
  `tab.setFrameDuration` — mirroring how `onReorderFrame` → `tab.reorderFrame` is
  wired. The dispatch fires on **commit** (release / blur / Enter) so one
  adjustment is one undo step (the 196 coalescing contract).
- `TimelinePanel` stays a **pure view** (props in, callbacks out — the 093
  decision); no WASM awareness.
- New i18n keys for the duration control's label / aria in en / ko / ja.

## Acceptance criteria

- The duration control matches the 194 design (placement, control type, ms unit,
  states) in both Light and Dark.
- The control displays the active frame's duration and updates when the active
  frame changes.
- Editing the value fires `onSetFrameDuration` with the right frame id and the
  clamped value; the change is a single undo step, and undo restores the prior
  value.
- The control is wired on both the docked and mobile TimelinePanel instances;
  mobile touch targets are ≥44px.
- Duration label / aria are localized in en / ko / ja.
- Component tests: the control displays the active frame's duration and fires
  `onSetFrameDuration` with the correct id and value.
- An E2E flow passes: set a frame's duration, reload and confirm the value
  persisted, undo and confirm the prior value is restored. (Playback timing is not
  asserted — there is no preview in this slice.)
- `TimelinePanel` remains a pure view (no WASM/`TabState` awareness).

## Blocked by

- [194 — Per-frame duration control design (.pen)](194-per-frame-duration-design.md)
- [196 — Per-frame duration WASM binding + journal intent + TabState](196-frame-duration-wasm-journal.md)
- [197 — Per-frame duration document schema V7 + snapshot persistence](197-frame-duration-schema-v7.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/document-frame-projection.ts` | `DocumentFrameRead` gains `durationMs`, populated from `frames_metadata()` in a single crossing |
| `src/lib/ui-editor/TimelinePanel.svelte` | Active-frame duration editor in the ruler-aligned top-left corner (text input + `ms` + desktop-only read-only fps helper). Commits on Enter/blur (one undo step); empty/invalid reverts; `tick()` reconciles the field to the clamped stored value. Adds `FrameColumn.durationMs` + `onSetFrameDuration` prop; collapsed summary gains a `· <ms>` token; mobile input ≥44px |
| `src/routes/editor/+page.svelte` | `handleSetFrameDuration` → `tab.setFrameDuration`, wired on both docked + mobile TimelinePanel instances |
| `messages/{en,ko,ja}.json` | `aria_frameDuration` key + `{duration}` token in `timeline_collapsed_summary` |
| `src/lib/ui-editor/TimelinePanel.stories.svelte` | `frame()` factory gains `durationMs`; varied durations for review |
| `src/lib/canvas/document-frame-projection.test.ts` | Projection reports each frame's `durationMs` (default 100, set→250) |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | 11 component tests: displays active-frame duration, tracks active frame, Enter/blur commit, empty/non-numeric/unchanged revert, out-of-range forwarded unclamped, localized aria, fps helper, collapsed token |
| `e2e/editor/frames.test.ts` | Tracer: set duration → undo/redo → reload → value persisted |

### Key Decisions

- **Control = text input (`type="text" inputmode="numeric"`)**, not `type="number"`. Implements the 194 spec's "plain numeric input" while honouring its "steppers deferred" note (the spinner is `type="number"`'s built-in UI) and avoiding number-input value quirks. The HITL review on the original `type="number"` build flagged this; switched per maintainer.
- **Clamp single-sourced at the WASM boundary** (196 contract): the view forwards the raw parsed value and lets an out-of-range entry snap back via the projection round-trip; empty/invalid reverts in the view. The component never re-derives the `[1, 60000]` clamp.
- **One retime = one undo step**: commit fires on Enter/blur only. Forcing a blur on Enter caused a second, stale commit (caught in E2E debugging) — removed; `tick()` reconciliation handles the clamp-to-current edge.
- **Value centred** in the field (maintainer preference); mobile input height uses `--ds-touch-target-min`.

### Notes

- Completes PRD 193 (5/5 sub-issues done) — per-frame duration is now authored, editable, durable, and undoable end-to-end on Web. Playback/preview and GIF export remain separate M4 consumers.
- The broader **"TimelinePanel mobile touch targets"** backlog (header/row icon buttons still 24px) is untouched — only the new duration input meets ≥44px here.
- fps helper is desktop-only and decorative (`aria-hidden`); at the 60000ms bound it rounds to `0 fps` — acceptable for the helper, flagged for any future polish.
- Verified: 1545 unit/component tests, `svelte-check` 0 errors, E2E frames 6/6 + layers/smoke 14/14.
