---
title: "Transport strip UI + playhead + i18n + E2E"
status: done
created: 2026-06-23
parent: 199-animation-playback-transport.md
---

## Parent

[199 — In-editor animation playback (transport strip + preview, M4)](199-animation-playback-transport.md)

## What to build

The end-to-end demoable capstone of PRD 199 (as 198 was for per-frame duration): wire
the transport strip into the editor per the [200 design spec](200-animation-playback-transport-design.md),
driving the playback controller (202) so the user can press Play and watch the
animation in the canvas.

- A transport-strip view in the reserved slot above the ruler, rendering **Play/Pause**
  and **Loop** controls per the 200 design, plus the **playhead** indication while
  playing (distinct from the active-frame highlight). Kept a **pure view** (props in,
  callbacks out — the 093 decision, exactly as `TimelinePanel` is): props for
  `isPlaying` / `isLooping` / playhead + frame state; `onTogglePlay` (or `onPlay` /
  `onPause`) and `onToggleLoop` callbacks.
- Wired in `+page.svelte` on **both** the docked and mobile instances to the playback
  controller (202) — mirroring how `onReorderFrame` → `tab.reorderFrame` is wired.
  Mobile (Timeline tab) touch targets ≥44px.
- New i18n keys for the play / pause / loop labels and aria-state in en / ko / ja.

## Acceptance criteria

- The strip matches the 200 design (placement in the reserved slot, control set,
  playhead treatment, states) in both Light and Dark.
- Pressing Play animates the canvas through the frames at their authored durations;
  Pause stops and returns to the active frame; Loop toggles repeat vs. play-once.
- The controls reflect `isPlaying` / `isLooping` state (e.g. `aria-pressed`) and are
  keyboard-operable; labels/aria are localized in en / ko / ja.
- Wired on both docked and mobile instances; mobile touch targets ≥44px.
- The strip is a pure view (no WASM / `TabState` awareness).
- Component tests: play/pause and loop controls fire their callbacks and reflect state.
- An E2E tracer passes (prior art `e2e/editor/frames.test.ts`): author two frames with
  distinct content, press Play and confirm the playhead advances (a stable data
  attribute, not a pixel-diff race), press Pause and confirm the canvas is back on the
  active frame, and confirm playback created **no** undo entry and left the active
  frame unchanged.

## Blocked by

- [200 — Animation playback transport strip design (.pen)](200-animation-playback-transport-design.md)
- [202 — Shell playback controller (transient playhead)](202-playback-controller.md)

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/TransportBar.svelte` | New pure-view bar: single Play/Pause toggle + Loop toggle + right-aligned `n / N` readout; `role="toolbar"`, `aria-pressed`, single-frame disabled; component-scoped sizing tokens, mobile ≥44px touch targets |
| `src/lib/ui-editor/TransportBar.svelte.test.ts` | 8 component tests — toolbar + play/loop callbacks, play/loop state reflection (aria-pressed + on-state class), `n / N` readout, single-frame disabled |
| `src/lib/ui-editor/TimelinePanel.svelte` | Renders `TransportBar` between the header and the `[duration-corner｜ruler]` band; adds the ▾ playhead marker lane above the ruler (column-aligned) + a sidebar alignment spacer; new optional transport props; panel height 180→224px (mobile 220→288px) |
| `src/lib/ui-editor/TimelinePanel.svelte.test.ts` | +6 tests — transport render + play passthrough, readout (active vs playhead), ▾ marker present-while-playing / absent-when-stopped, hidden when collapsed |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `playheadFrameId` public getter (drives the readout + marker) |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | +1 test — `playheadFrameId` reflects the playhead while playing, `null` when stopped |
| `src/routes/editor/+page.svelte` | Wires both docked + mobile `TimelinePanel` instances to the controller via `activeTab` (mirrors the frame wiring): `isPlaying`/`isLooping`/`playheadFrameId` derivations + `togglePlay`/`toggleLoop` handlers |
| `messages/{en,ko,ja}.json` | 4 i18n keys — `aria_play` / `aria_pause` / `aria_toggleLoop` / `aria_playbackToolbar` |
| `src/lib/ui-editor/TimelinePanel.stories.svelte` | "Playing" story (pause icon, loop-on, ▾ marker) |
| `e2e/editor/playback.test.ts` | E2E tracer — single-frame Play disabled → author two frames → Loop on → Play → ▾ advances (stable data attribute) → canvas shows frame 1 → Pause → Active Frame restored → first undo reverts the real edit (no playback history entry) |

### Key Decisions

- **`TransportBar` split out; ▾ marker kept in `TimelinePanel`** (HITL-chosen): the control bar is a focused, independently-tested pure view; the marker stays where it must align to the ruler columns and scroll with them.
- **Placement = full-width bar between header and the band** (200 design), not 187's "above the ruler" reserved slot — only the ▾ marker sits above the ruler. Panel grows ~44px to seat it.
- **Wired directly to `activeTab`** (no new `EditorController` projection), mirroring the existing frame-operation wiring the issue pointed to.
- **"Morphing aria-label + aria-pressed"** for Play/Pause matches the project's established toggle convention (pixel-perfect, grid, constrain latch).

### Notes

- No schema change and no Rust core change — playback is shell-owned; only a `playheadFrameId` getter was layered onto the 202 engine.
- Verified: 1587 unit tests + frames/layers/smoke + the new playback E2E pass; `svelte-check` clean; production build (`bun run build`) succeeds; mobile touch targets measured at exactly 44×44px; Light/Dark/mobile/single-frame states visually checked against the 200 spec.
- Apple shell untouched (web + core only, per PRD 199). Completes PRD 199 (4/4 sub-issues).
