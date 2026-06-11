---
title: "Touch modifier alternatives — touch-reachable Shift-constrain"
status: ready-for-agent
created: 2026-06-11
---

## Problem Statement

On desktop, holding **Shift** constrains drawing in three places: the line tool snaps to 45° multiples, the rectangle and ellipse tools force a 1:1 square/circle, and the Selection tool constrains a new Marquee to a square (issue 151) or locks a Floating Selection drag to one axis (issue 152). These are everyday pixel-art moves — drawing a clean horizontal line, a perfect square frame, nudging a lifted region straight down a column.

A touchscreen user has **no Shift key**. Every one of these constraints is unreachable on iPad or a phone. The Selection keyboard-Shift work (151, 152) deliberately left its touch path out of scope and recorded that "touch-reachable Shift-equivalent behavior belongs to the project-wide **Touch modifier alternatives** task, which will connect its global modifier state to this same Selection behavior." This PRD is that task: it gives touch users a way to invoke the Shift constraint, and it does so by feeding the *same* internal modifier state the keyboard already drives, so all four constraint behaviors light up at once.

The Alt-key eyedropper convention (quick color-pick without leaving the current tool) already has a touch equivalent — the 400ms long-press color-sampling loupe (issues 061, 065–068, 079, 139) — so it is **out of scope** here.

## Solution

Add a **Constrain toggle** to the touch tool UI: a latched on/off button that, while active, applies the Shift constraint to whichever constrainable tool is in use. Because the existing tools read a single live `isShiftHeld()` callback, turning the toggle on is indistinguishable — from the tools' perspective — from holding the physical Shift key.

From the user's perspective:

- Tap the Constrain toggle on. It stays on (sticky latch) with a clear active visual state.
- Draw a line → it snaps to 45° multiples. Draw a rectangle or ellipse → it forces a square/circle.
- With the Selection tool: drag a new Marquee → it stays square; drag a lifted Floating Selection → it locks to the dominant axis.
- Tap the toggle off to return to free drawing.

The toggle is a workspace-global modifier latch. Keyboard Shift continues to work unchanged; the two are OR-combined, so a hybrid device (iPad with a keyboard) can use either. Toggling the latch mid-stroke updates the in-progress stroke immediately, exactly as pressing or releasing Shift mid-stroke does today.

## User Stories

1. As an iPad user drawing with the line tool, I want to constrain lines to 45° angles without a keyboard, so that I can draw clean horizontals, verticals, and diagonals.
2. As an iPad user drawing with the rectangle tool, I want to force a perfect square, so that I can frame sprites and tiles precisely.
3. As an iPad user drawing with the ellipse tool, I want to force a perfect circle, so that I can draw round shapes without trial and error.
4. As a touchscreen user with the Selection tool, I want a new Marquee to stay square, so that I can select uniform tile regions.
5. As a touchscreen user moving a Floating Selection, I want to lock the drag to one axis, so that I can slide a region straight down a column or across a row without drifting.
6. As a touchscreen user, I want the Constrain toggle to stay on until I turn it off (sticky latch), so that I can draw several constrained shapes in a row without re-arming it each time.
7. As a touchscreen user, I want the Constrain toggle to show a clear active/inactive visual state, so that I always know whether my next shape will be constrained.
8. As a touchscreen user, I want to turn the Constrain toggle off with a single tap, so that I can return to free drawing immediately.
9. As a user on a hybrid iPad-plus-keyboard setup, I want physical Shift and the Constrain toggle to both work, so that I can use whichever is convenient in the moment.
10. As a user who turns the toggle on partway through dragging a shape, I want the shape to snap to the constraint immediately, so that I do not have to release and restart the stroke.
11. As a user who turns the toggle off partway through dragging a shape, I want the shape to return to free-form immediately, so that mid-stroke correction feels responsive.
12. As a touchscreen user, I want the Constrain toggle to be reachable from the touch tool surface without hunting through menus, so that constraining is a one-tap action mid-flow.
13. As a touchscreen user, I want the toggle's meaning to read in my language (en/ko/ja), so that I understand what it does.
14. As a touchscreen user, I want the Constrain toggle to meet the touch target minimum, so that I can hit it reliably with a fingertip.
15. As a user, I want the Constrain latch to reset to off when I reload the editor, so that I start each session in the predictable free-drawing default.
16. As a keyboard user, I want my existing Shift behavior to be completely unchanged by this feature, so that nothing I rely on regresses.
17. As a touchscreen user with a non-constrainable tool active (pencil, eraser, fill, eyedropper, move), I want the toggle to have no surprising effect, so that the latch's scope is predictable.

## Implementation Decisions

- **Single global modifier latch, OR-combined at the existing seam.** Introduce a workspace-scoped reactive modifier state (e.g. a small `TouchModifiers`/constrain-latch holder) exposing `isConstrainActive` and a toggle command. Wire it into the *one* place keyboard Shift is consumed — the `getShiftHeld` dependency passed to `Workspace` in `create-editor-controller.ts`. That dependency becomes the OR of keyboard Shift and the latch: `() => keyboard.isShiftHeld || constrainLatch.isActive`. No tool, shape, or selection logic changes — `shape-tool.ts`, `selection-tool.ts`, and `tool-authoring.ts` keep reading `host.isShiftHeld()` unchanged. This is the highest seam available: every constraint behavior already routes through it.
- **Mid-stroke updates reuse the existing notify path.** Toggling the latch while a stroke is in progress must call the same `activeTab.modifierChanged()` path the keyboard handler uses (`notifyModifierChange`), so an in-flight shape re-resolves its constraint. The latch's toggle command checks whether a stroke is active and fires the modifier-change notification, mirroring `keyboard-input.svelte.ts` Shift handling.
- **Sticky latch semantics.** The toggle is on/off and persists until tapped again — not one-shot, not momentary. A momentary "hold" button is rejected because a single touch is already consumed by the drawing drag; there is no second finger free (two-finger touch is reserved for pinch-zoom).
- **Latch is session-transient.** It is not persisted to the workspace snapshot; it resets to off on reload. (Consistent with how keyboard Shift is never "remembered".)
- **Scope is the Shift constraint only.** One latch drives all four Shift behaviors (line 45°, rect/ellipse square, Marquee square, Floating axis-lock) because they share `isShiftHeld()`. There is no separate axis-lock toggle and no separate square toggle — the constraint each tool applies is the tool's own existing decision.
- **UI placement on the touch tool surface.** Surface the toggle in the touch-oriented tool UI (`BottomToolsPanel.svelte`, the compact/medium floating panel). The button reflects the latch's active state using the same active-state styling tools already use (`active` prop on `EditorButton`). Whether the toggle is shown always or only when a constrainable tool (line, rectangle, ellipse, selection) is active is a UI-design decision to settle during implementation; default to showing it whenever the touch panel is shown, with the active-tool gating treated as an optional refinement.
- **Keyboard path untouched.** `keyboard-input.svelte.ts` Shift handling is not modified. The latch is additive.
- **i18n.** Add a new message key (e.g. `modifier_constrain`) to `messages/en.json`, `ko.json`, and `ja.json`, following the existing `tool_*` / `action_*` conventions. Used for the button label/tooltip.
- **Apple shell is out of scope** for this PRD (web shell only). The Apple native shell has no Selection/shape-constrain parity yet; its touch-modifier story is a separate future concern.

## Testing Decisions

Good tests here assert *external behavior* — "with the latch on, a line stroke snaps to 45°" — not the internal wiring of how the boolean is OR-combined. Prefer the highest seam that still exercises real behavior.

- **Modifier latch unit tests.** Test the new latch holder directly: toggling flips `isActive`; toggling while a stroke is active invokes the modifier-change notification; toggling while idle does not. Prior art: `keyboard-input.svelte.test.ts` (mocks `KeyboardInputHost`, verifies `notifyModifierChange` is called on Shift toggle).
- **Constraint-through-latch behavior.** Verify that a tool session constrains when the latch (not the keyboard) supplies the held state. Prior art: `shape-tool.test.ts` already mocks `SessionHost.isShiftHeld()` and asserts the constraint is applied/removed across `modifierChanged()`; the same seam covers a latch-driven `isShiftHeld()` returning `true`. Selection square + axis-lock already have coverage in `selection-tool.test.ts` that reads `host.isShiftHeld()` — no new selection tests are required if the latch feeds the same callback, but add a focused test asserting the OR-combination (latch on, keyboard off ⇒ constrained).
- **Composition wiring.** A test at the `create-editor-controller` / workspace seam asserting that `getShiftHeld` returns `true` when either keyboard Shift or the latch is active, and `false` when neither is.
- **UI component test / Storybook.** Add a story (and, if warranted, a component test) for `BottomToolsPanel` showing the Constrain toggle in active and inactive states, following the existing `BottomToolsPanel.stories.svelte` pattern. The component test asserts the toggle's click invokes the toggle callback and the active state reflects the prop.
- **No new E2E is required** for the core behavior, but a Playwright touch-emulation check that a latched constraint snaps a line is a reasonable optional addition if the existing `e2e/` suite already exercises touch drawing.

## Out of Scope

- **Alt-eyedropper touch UI.** Already covered by the 400ms long-press color-sampling loupe (issues 061, 065–068, 079, 139). On touch, long-press already provides "pick a color without leaving the current tool," which is the value Alt provides on desktop. No new eyedropper affordance is added here.
- **Apple native shell.** Web shell only.
- **Persisting the latch** across reloads or per-document.
- **A separate momentary/hold modifier button**, or two-finger modifier gestures — rejected in favor of the sticky latch.
- **Space-to-pan touch alternative** and any modifier other than Shift-constrain.
- **Changes to what each tool constrains** — the constraint math (`constrainLine`, `constrainSquare`, `constrainAxis`) and the tools' decisions about which to apply are unchanged.

## Further Notes

- The design vision for this task is already recorded in issues 151 and 152, which explicitly defer the touch path to "the project-wide Touch modifier alternatives task, which will connect its global modifier state to this same Selection behavior." This PRD honors that by introducing exactly one global modifier state and routing it through the shared `getShiftHeld` seam rather than duplicating constraint logic.
- The original Next Up item bundled three sub-features ("touch Shift-constrain, Selection axis lock, Alt-eyedropper UI"). Two of them (Shift-constrain and Selection axis-lock) collapse into the single constrain latch because they already share `isShiftHeld()`; the third (Alt-eyedropper) is already shipped. The effective new work is therefore the latch state + the touch toggle button + i18n.
- Because the latch feeds the existing seam, the riskiest part is not the logic but the UI/UX: where the toggle lives and how its active state reads at a glance. Treat that as a small UI-design pass during implementation.
