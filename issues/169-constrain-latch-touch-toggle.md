---
title: "Constrain latch + touch tool strip toggle"
status: done
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
- The latch is toggled from the touch tool strip (compact/medium layouts) by **re-tapping the active constrainable tool button** (line, rectangle, ellipse, selection) — no dedicated toggle button is added. *(Amended during implementation: the original plan was a dedicated, gated toggle button, but the compact strip is already past its width budget — 10 × 44px buttons flex-shrink below the touch minimum on phone widths — so adding an 11th button worsened a pre-existing touch-target violation. The re-tap pattern was chosen by the user instead.)* While latched, the active constrainable tool button carries an accent corner dot and announces the constrain state in its accessible label; for non-constrainable tools the re-tap stays inert and no dot shows, keeping the latch's scope predictable.
- Keyboard Shift behavior is completely unchanged; either source alone constrains (OR). On a hybrid device both work.
- The latch is session-transient: it resets to off on reload and is not persisted to the workspace snapshot.
- The same re-tap gesture and dot were extended to the docked `LeftToolbar` in this branch, delivering issue 171's scope early. *(An interim docked-entry reset guard was briefly considered to keep an armed latch from entering the docked layout invisibly — e.g. iPad portrait → landscape rotation — but the user chose layout-uniform re-tap instead, which makes the state visible and clearable everywhere and needs no guard.)*
- Because tools live-read the held state per draw sample, toggling mid-stroke is inherently safe and affects subsequent samples; the *immediate* stationary-pointer refresh (modifier-change notification parity) is deferred to issue 170.
- New i18n message key for the latched state's accessible label in en/ko/ja, following existing message conventions.

Covers parent user stories 1–9 and 12–17 on the touch (non-docked) layout.

## Acceptance criteria

- A workspace-scoped Constrain latch exposes its active state and a toggle command; the composition root ORs it with keyboard Shift into the existing held-modifier dependency.
- With the latch on (keyboard untouched): line constrains to 45°, rectangle/ellipse constrain to square/circle, Selection DefineMarquee constrains to square, Floating Selection drag locks to the dominant axis.
- Re-tapping the active tool button in the touch tool strip flips the latch when that tool is line, rectangle, ellipse, or selection; re-tapping a non-constrainable active tool never flips it; tapping an inactive tool switches tools without touching the latch.
- While latched, the active constrainable tool button shows an accent corner dot and its accessible label announces the constrain state; the dot never shows on inactive or non-constrainable tools.
- The re-tap target is the existing tool button (meets the touch target minimum); no extra button is added to the width-constrained strip.
- Keyboard Shift alone, latch alone, and both together all constrain; neither path regresses the other.
- The latch resets to off on editor reload; across a layout-mode change it survives as one shared workspace state, visible and clearable in both layouts (covered by E2E `e2e/editor/constrain-latch.test.ts`).
- The latched state's accessible label is localized in en, ko, and ja.
- Tests: latch unit behavior (toggle flips state); OR-combination at the composition seam (keyboard only / latch only / both / neither); a shape-tool session constrains when the latch supplies the held state; tool strip stories and component tests covering re-tap-toggles-for-constrainable-tools, inert-re-tap-for-other-tools, tool-switch-without-toggling, and badge/announced-label latched states.

## Blocked by

None - can start immediately

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/constrain-latch.svelte.ts` | Workspace-scoped sticky Constrain latch (`isActive` + `toggle()`), session-transient |
| `src/lib/canvas/editor-session/create-editor-controller.ts` | ORs the latch with keyboard Shift at the single `getShiftHeld` seam |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | `isConstrainActive` projection + `toggleConstrain` command on the facade |
| `src/lib/canvas/tool-registry.ts` | `isConstrainable` tool metadata + `isConstrainableTool()` helper |
| `src/lib/ui-editor/tool-ui.ts` | Shared re-tap semantics: `isConstrainToggleTap`, `showsConstrainState`, `toolButtonLabel` |
| `src/lib/ui-editor/ToolStrip.svelte` | Re-tap toggle + accent corner dot on the touch strip |
| `src/lib/ui-editor/LeftToolbar.svelte` | Same re-tap toggle + dot in the docked toolbar (delivers issue 171) |
| `src/routes/editor/+page.svelte` | Wires `constrainActive` / `onToggleConstrain` to both toolbars |
| `messages/{en,ko,ja}.json` | `modifier_constrain` — "Constrain" / "고정" / "固定" |
| `e2e/editor/constrain-latch.test.ts` | Touch arm, docked arm/disarm, cross-layout latch survival |

Unit/component coverage: latch unit tests, OR-seam behavior at the controller (keyboard only / latch only / both / neither, pixel-level through the real wasm backend), registry classification, ToolStrip + LeftToolbar component tests (re-tap toggles, inert for non-constrainable, label announce) and stories.

### Key Decisions

- **No dedicated toggle button.** Re-tapping the active constrainable tool toggles the latch; the armed state reads as an accent corner dot plus an accessible-label suffix ("Line (Constrain)"). Chosen because the compact strip is past its width budget (10 × 44px buttons already flex-shrink on phone widths).
- **Layout-uniform gesture.** The same re-tap works in the docked `LeftToolbar` (issue 171's scope, delivered in this branch by user decision) — the latch is one shared workspace state, visible and clearable in every layout, which removed the need for an interim docked-entry reset guard.
- **Single OR seam.** No tool, shape, selection, or keyboard-handling code changed; tools keep reading the same live `isShiftHeld()` callback.

### Notes

- Mid-stroke *immediate* refresh (modifier-change notification parity) is issue 170 — tools live-read the held state per sample, so mid-stroke toggling is already safe, just not instant on a stationary pointer.
- Pre-existing width debt documented in `ToolStrip.svelte` CSS: 10 strip buttons flex-shrink below the 44px touch minimum on narrow phones (this task added no button).
- Parent PRD 168's UI-placement wording (`BottomToolsPanel`, dedicated toggle button, display gating) is superseded by the decisions above; `BottomToolsPanel` turned out to be a legacy component not rendered by the editor — the live touch strip is `ToolStrip.svelte`.
