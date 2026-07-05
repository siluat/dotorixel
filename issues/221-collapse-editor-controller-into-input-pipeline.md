---
title: "Collapse EditorController into an Input Pipeline module"
status: done
created: 2026-07-05
---

## Problem Statement

`EditorController` is a shallow facade: 80 public members that are almost all
1–2-line delegations, while its only caller (`src/routes/editor/+page.svelte`)
bypasses it 112 times (71 `editor.workspace` + 41 `editor.workspace.activeTab`
reach-throughs) across 18 command methods the facade never wraps — every layer,
frame, playback, and export-UI op. The class doc sanctions reach-through for
"persistence, tests, gestures", but plain UI commands drifted onto that path,
so there are two ways to do everything and no rule. 228 lines of its test suite
exist only to assert that delegation wiring exists.

Buried in the delegations are four real input policies (the module's actual
behaviour):

1. Shortcut-hints admission — `handleDrawStart`/`handleDraw` drop input while
   `keyboard.isShortcutHintsVisible`.
2. Temporary-tool restore — `handleDrawEnd`/`handleDrawCancel` call
   `keyboard.consumePendingToolRestore()` and restore the tool.
3. Constrain parity — `toggleConstrain` fires `activeTab.modifierChanged()`
   mid-stroke so a stationary pointer reflects the latch.
4. hex↔Color adapters over the shared color slots.

Known asymmetry (bug-shaped): the hints admission gate covers draw only.
`canvas-interaction` routes pointer-down to sample before draw, so while the
hints overlay is visible, drawing is blocked but eyedropper sampling passes and
silently changes a draw color slot (color slots are outside History).

## Solution

Deepen by shrinking: keep a module only where the behaviour is, and make
direct binding the single sanctioned path for everything else.

### New module: Input Pipeline

`src/lib/canvas/editor-session/input-pipeline.svelte.ts`, class `InputPipeline`
(constructor deps unchanged from the controller: `workspace`, `keyboard`,
`constrainLatch`). Scope = the canvas viewport input pipeline, ~16 members,
every one carrying real policy:

- Draw handlers (`handleDrawStart/Draw/DrawEnd/DrawCancel`) — hints admission
  gate + temporary-tool restore.
- Canvas sample handlers (`handleSampleStart/Update/End/Cancel`) — same
  pipeline, now behind the same admission gate (see behaviour change).
- Keyboard lifecycle — `handleKeyDown/KeyUp/Blur` forwarding plus the
  `isSpaceHeld` / `isShiftHeld` / `isShortcutHintsVisible` projections.
- Constrain latch — `toggleConstrain` (with mid-stroke `modifierChanged`
  parity) + `isConstrainActive`.

Excluded by design: Reference Window sampling (`referenceSample*`) — it does
not contend with canvas draw/sample admission and has its own interaction
lifecycle; it binds directly to `activeTab`.

The doc comment states the closed scope: reads and plain commands do not pass
through this module; adding a delegation member here is a design-violation
signal. Enforcement is documentation-only — deleting the wide delegation
surface removes the habitat drift needs.

### Behaviour change (intended, decided)

The hints admission gate also blocks canvas `sampleStart` while the shortcut
hints overlay is visible, closing the draw/sample asymmetry. Dedicated test.

### Facade deletion

- `editor-controller.svelte.ts` deleted. Templates bind directly:
  `workspace.shared.X` (workspace-shared state), `workspace.activeTab.X`
  (per-tab state + commands), `input.X` (canvas input pipeline only).
- Trivial adapters move to usage site in `+page.svelte` — no new getters on
  SharedState/Workspace (single consumer today; promote only if a second
  consumer appears):
  - fg/bg hex: `$derived(colorToHex(shared.foregroundColor))`, change handlers
    via `hexToColor`
  - tool cursor: `TOOL_CURSORS[shared.activeTool]`
  - paste availability: `shared.selectionClipboard !== null`
- Composition root: `create-editor-controller.ts` → `create-editor-session.ts`
  returning `{ workspace, input }`. Keyboard↔tool-runner cycle resolution and
  the Shift‖latch OR-combine stay inside it, unchanged.
- `openSession` returns flat `{ workspace, input, session }` (no aggregate bag
  object). The autosave snapshot closure narrows from `editorRef` to a
  `workspaceRef` — autosave only needs `workspace.toSnapshot()`.
- Update the stale `EditorController` mention in `keyboard-input.svelte.ts`'s
  doc comment.

### Tests: replace, don't layer

- Delete `editor-controller.svelte.test.ts` (681 lines). Delegation/projection
  blocks die with the getters; tab-switch projection reactivity is already
  covered by the workspace and tab-state suites.
- New `input-pipeline.svelte.test.ts` at the module's interface: hints gate
  blocks draw, hints gate blocks canvas sampling (new), temporary-tool restore
  on drawEnd and drawCancel, Constrain parity mid-stroke, keyboard forwarding.
- Small `create-editor-session` wiring test (Shift‖latch OR-combine,
  keyboard↔tool-runner cycle, returned instances wired).
- Page binding correctness is covered by `svelte-check` + existing e2e suite.

### Domain model

Register in `CONTEXT.md` within this PR (term names the new module):

> **Input Pipeline**: The session-level module in front of the canvas viewport
> that admits or blocks draw/sample input (shortcut-hints admission), restores
> a temporary tool switch when a stroke ends or cancels, and owns the keyboard
> and Constrain-latch lifecycles. Reads and plain commands do not pass through
> it — templates bind `workspace.shared` / `workspace.activeTab` directly.
> _Avoid_: editor controller (the deleted facade), canvas interaction (the
> per-view pointer capture machine), input handler (generic).

### Explicitly out of scope

- No Action-pattern adoption — `tasks/todo.md` keeps its future trigger (menu
  bar / command palette / plugin system). A future Action layer would sit above
  `workspace` + `InputPipeline`; this change does not foreclose it.
- No behaviour changes beyond the hints/sampling unification.
- No Rust core / wasm / Apple changes.

## Acceptance criteria

- `EditorController` and `editor-controller.svelte.test.ts` no longer exist;
  nothing in production code references them.
- `+page.svelte` binds all reads and commands via `workspace.shared` /
  `workspace.activeTab`; the only `input.*` bindings are draw, canvas sample,
  keyboard, and Constrain.
- With the shortcut-hints overlay visible: `drawStart`, `draw`, and canvas
  `sampleStart` are all ignored; temporary-tool restore still fires on
  `drawEnd`/`drawCancel`.
- `toggleConstrain` during an active stroke still triggers `modifierChanged`
  parity (test survives at the new interface).
- `openSession` returns `{ workspace, input, session }`; the autosave snapshot
  closure reads the workspace directly.
- Reference Window sampling binds directly to `activeTab`, behaviour unchanged.
- `CONTEXT.md` gains the Input Pipeline entry; the module doc states the
  closed-scope rule.
- `svelte-check` clean; unit suites pass; e2e editor specs pass.

## Blocked by

None — can start immediately.

## Notes

- 2026-07-05: Produced by an `/improve-codebase-architecture` review (candidate
  #1 of 11) followed by a full grilling pass. Decision tree resolved with the
  user: shrink-to-policy over facade-completion/deletion/Action-pattern; canvas
  viewport pipeline scope (reference sampling excluded); hints/sampling
  unification in the same PR; adapters inlined at usage site; name "Input
  Pipeline"; flat 3-field session return; documentation-only enforcement;
  replace-don't-layer test strategy.

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/input-pipeline.svelte.ts` | New `InputPipeline` — exactly the 16 spec'd members, every one carrying policy; closed-scope doc; `#`-private deps |
| `src/lib/canvas/editor-session/input-pipeline.svelte.test.ts` | 9 behavior tests: hints gate both edges (draw + canvas sampling), restore on drawEnd/drawCancel, Constrain parity mid-stroke (pixel-level), keyboard projections/blur |
| `src/lib/canvas/editor-session/create-editor-session.ts` | Composition root returning `{ workspace, input }`; keyboard↔tool-runner cycle and Shift‖latch OR-combine unchanged inside |
| `src/lib/canvas/editor-session/create-editor-session.test.ts` | 5 wiring tests: OR-combine both sources, shortcut routing, instance wiring, latch session-transience (snapshot-restore regression port) |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Deleted (377 lines) |
| `src/lib/canvas/editor-session/editor-controller.svelte.test.ts` | Deleted (681 lines) |
| `src/lib/canvas/editor-session/create-editor-controller.ts` | Deleted (62 lines) |
| `src/lib/session/session.ts` | `openSession` returns flat `{ workspace, input, session }`; autosave closure narrowed to `workspaceRef.toSnapshot()`; stale controller mentions rewritten |
| `src/lib/session/session.test.ts` | Handles renamed to the new return shape |
| `src/routes/editor/+page.svelte` | All reads/commands bind `workspace.shared` / `workspace.activeTab`; only draw/sample/keyboard/Constrain bind `input.*`; hex / toolCursor / canPasteSelection adapters inlined as `$derived`s |
| `src/lib/canvas/keyboard-input.svelte.ts` | Doc comment: `EditorController` → Input Pipeline |
| `CONTEXT.md` | Input Pipeline registered under new `### Input` section |

### Key Decisions

- `InputPipeline` holds its deps as `#`-private fields: reach-through via
  `input.workspace` is structurally unrepresentable, one step past the
  documentation-only enforcement the issue required.
- Template binding rule: `input.*` handlers direct-bound (stable arrow
  fields); every other command is an inline `() => workspace…` arrow, so
  member style changes on Workspace/TabState can never break `this`-binding.
- The old spy-based Constrain-parity test was replaced by a pixel-outcome
  test at the new interface (spec over implementation).

### Notes

- Incidental contract cleanup: TopBar's `onclick={onFit}` used to flow a
  MouseEvent into `handleFit(maxZoom)` (harmless — NaN is ignored by the
  downstream fit clamp); the new `() => zoomFit()` binding matches the
  declared no-arg contract.
- "Restore fires on drawEnd/drawCancel while hints are visible" is
  unreachable by construction (Slash is blocked mid-stroke; Alt-up while not
  drawing restores immediately) — satisfied by gate placement: end/cancel
  stay ungated.
- `isShortcutHintsVisible` has no live UI consumer (the hints overlay UI
  exists only in legacy story-only components); it remains as the admission
  gate's observable state.
- Verification: unit 93 files / 1,616 tests, `svelte-check` 0 errors,
  e2e 110/110 (editor 89 + landing 21). Net ≈ −600 lines.
