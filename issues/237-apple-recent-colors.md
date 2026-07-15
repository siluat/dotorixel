---
title: Apple native — recent colors row
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Track and display **recent colors** on the Apple shell, matching the web editor.

State: an ordered list of hex strings, most-recent first, **max 12**, deduplicated
case-insensitively (re-using a color moves it to the front). In-memory only for
now — persistence arrives with Phase 4 (the web persists this in the workspace
snapshot; note the parity gap in the issue when closing).

Recording rules (web parity — the list records colors *used*, not colors
*browsed*):

- When a **drawing stroke starts** (pencil, shapes, fill), record the stroke's
  draw color — foreground or background per the pressed button. The eraser
  records nothing.
- When the **eyedropper commits**, record the sampled color.
- Merely selecting a color in the palette or picker records nothing.

UI: a "Recent" labeled swatch row in the RightPanel color section (web
RightPanel is the reference — it renders below the palette). Hidden while the
list is empty. Tapping a recent swatch sets the foreground color.

The recording points hook into the 230 session lifecycle (stroke-start effects)
and the 234 commit path — mirror how the web folds an "add recent color" effect
into those two moments rather than scattering calls per tool.

## Acceptance criteria

- Drawing with pencil/shape/fill adds the used color to the front of the list;
  drawing with the eraser does not.
- A right-click stroke records the background color it drew with.
- An eyedropper commit records the sampled color.
- Selecting a palette color without drawing records nothing.
- The list dedupes case-insensitively, caps at 12, most-recent first.
- The Recent row appears once the first color is recorded, shows swatches in
  order, and tapping one sets the foreground color.
- List semantics unit-tested (dedupe, cap, ordering); RightPanel snapshot
  baseline updated with a populated Recent row.

## Blocked by

- [230 — stroke session architecture](230-apple-stroke-sessions.md)
- [234 — eyedropper tool](234-apple-eyedropper.md)
