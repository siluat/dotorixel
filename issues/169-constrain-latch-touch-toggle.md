---
title: "Constrain latch + touch tool strip toggle"
status: ready-for-agent
created: 2026-06-11
parent: 168-touch-modifier-alternatives.md
---

## Parent

[168 — Touch modifier alternatives — touch-reachable Shift-constrain](168-touch-modifier-alternatives.md)

## What to build

The tracer bullet for touch-reachable Shift-constrain: a workspace-scoped **Constrain latch** that touch users toggle from the touch tool strip, feeding the same live held-modifier state that keyboard Shift already drives.

End-to-end behavior:

- A sticky on/off **Constrain latch** lives at workspace scope. It is OR-combined with keyboard Shift at the single seam where the workspace consumes the held-modifier state — the one `getShiftHeld` dependency the editor composition root passes in. No shape-tool, selection-tool, or constraint-math changes: they keep reading the same live `isShiftHeld()` callback.
- With the latch on and no keyboard involved: the line tool snaps to 45° multiples, rectangle/ellipse force a square/circle, Selection DefineMarquee stays square, and a Floating Selection drag locks to the dominant axis — all through the existing tool logic.
- A **Constrain toggle button** appears in the touch tool strip (compact/medium layouts) **only while a constrainable tool is active** (line, rectangle, ellipse, selection). This display gating is a deliberate decision: the compact strip is already at its width budget, and hiding the toggle for tools it cannot affect keeps its scope predictable. The button shows a latched active visual state consistent with existing active-tool styling and meets the touch target minimum.
- Keyboard Shift behavior is completely unchanged; either source alone constrains (OR). On a hybrid device both work.
- The latch is session-transient: it resets to off on reload and is not persisted to the workspace snapshot.
- Because tools live-read the held state per draw sample, toggling mid-stroke is inherently safe and affects subsequent samples; the *immediate* stationary-pointer refresh (modifier-change notification parity) is deferred to issue 170.
- New i18n message key for the toggle's label/tooltip in en/ko/ja, following existing message conventions.

Covers parent user stories 1–9 and 12–17 on the touch (non-docked) layout.

## Acceptance criteria

- A workspace-scoped Constrain latch exposes its active state and a toggle command; the composition root ORs it with keyboard Shift into the existing held-modifier dependency.
- With the latch on (keyboard untouched): line constrains to 45°, rectangle/ellipse constrain to square/circle, Selection DefineMarquee constrains to square, Floating Selection drag locks to the dominant axis.
- The toggle button renders in the touch tool strip only while line, rectangle, ellipse, or selection is the active tool; tapping it flips the latch; its pressed/active state reflects the latch.
- The button meets the touch target minimum and uses the existing active-state styling pattern of the strip.
- Keyboard Shift alone, latch alone, and both together all constrain; neither path regresses the other.
- The latch resets to off on editor reload.
- The toggle label/tooltip is localized in en, ko, and ja.
- Tests: latch unit behavior (toggle flips state); OR-combination at the composition seam (keyboard only / latch only / neither); a shape-tool session constrains when the latch supplies the held state; tool strip story (and component test if warranted) covering visible-with-constrainable-tool, hidden-with-other-tools, and active/inactive toggle states.

## Blocked by

None - can start immediately
