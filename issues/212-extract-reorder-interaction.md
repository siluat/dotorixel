---
title: Extract Reorder Interaction module from TimelinePanel's twin drag machines
status: ready-for-agent
created: 2026-07-04
---

## Problem Statement

TimelinePanel implements the same pointer drag-reorder machine twice, axis-swapped: layer rows (vertical) and frame ruler cells (horizontal) — ~220 LOC of duplicated lifecycle (offset → target index → clamp → displacement preview → drop commit) fused into the component script, testable only through the repo's largest component-mount suite (~1,947 test LOC). A reorder bug must be found and fixed twice, and every behavior test pays the DOM-mount cost.

The two machines are not identical twins; their five real divergences are policy parameters, not reasons for two implementations:

1. **Allowed-target set** — layers clamp to the Pixel-row subset (the Reference row is fixed at the bottom); frames clamp to the full `[0, n-1]` range.
2. **Tap discrimination** — frame cells double as select-on-click targets, so they carry a 4px threshold plus a trailing-click suppression flag (keyboard clicks exempt via `detail > 0`); layer handles are dedicated, no threshold.
3. **Extent measurement** — row height from the closest layer-row element vs. cell width from the event target.
4. **preventDefault on pointerdown** — layers do (suppresses the compatibility click they don't want); frames don't (they need the trailing click for tap-select).
5. **Keyboard stepping** — ArrowUp/Down reorder exists only on layer handles.

Surfaced as candidate 1 of the 2026-07-04 architecture review; design finalized the same day through a grilling session. The domain term **Reorder Interaction** was registered in `CONTEXT.md` (§ Timeline) as part of that session.

## Solution

Extract one deep module — **Reorder Interaction** — behind a small interface; the Timeline's layer rows and frame ruler cells become its two adapters.

### Finalized design decisions

| Decision | Outcome |
|---|---|
| Module scope | Owns the full pointer lifecycle: pointer-id guard (second pointers can't steal a drag), capture/release with try/catch, preventDefault policy, tap-vs-drag threshold, trailing-click suppression, index math, displacement preview |
| Target policy | `allowedIndices: () => readonly number[]` getter; the module derives the offset clamp (first/last allowed × extent), target snap, and `canReorder` (length > 1, gates pointerDown) |
| Tap/suppression | `tapThresholdPx` (default 0 = dedicated handle); `consumeClickSuppression(detail)` owns the whole flag lifecycle — armed on crossing the threshold, unconditionally reset at the next pointerdown, `detail === 0` (keyboard) clicks never suppressed. preventDefault-on-down is a derived rule: only when the threshold is 0. Unified commit rule: `(threshold === 0 || wasDrag) && target !== base` |
| Keyboard | Module owns axis-aware arrow stepping (`y` → ArrowUp/Down, `x` → ArrowLeft/Right) via `keydown(): boolean` (true = handled + preventDefault); commits through the same `onDrop`; keys ignored mid-drag. Enter/Space propagation concerns stay in the component |
| Name | **Reorder Interaction** — registered in `CONTEXT.md` § Timeline |
| Placement | `src/lib/gestures/reorder-interaction.svelte.ts` (beside `long-press`) |
| Shape | Factory `createReorderInteraction(options)` returning an interface, runes in `.svelte.ts` — the `createCanvasInteraction` / `createLongPressDetector` idiom |
| Tests | Port the ~20 existing drag/keyboard behavior cases headlessly 1:1 (checklist against the current suite); the component keeps its ~5 DOM-contract tests and gains 3–4 adapter wiring smokes |

### Interface sketch

```ts
export interface ReorderInteractionOptions {
	axis: 'x' | 'y';
	allowedIndices: () => readonly number[];
	measureExtent: (target: Element) => number | undefined;
	onDrop: (id: string, toVisualIndex: number) => void;
	tapThresholdPx?: number;   // default 0 — dedicated handle
	fallbackExtentPx?: number; // default 32
}

export interface ReorderInteraction {
	pointerDown(e: PointerEvent, id: string, visualIndex: number): void;
	pointerMove(e: PointerEvent, id: string): void;
	pointerUp(e: PointerEvent, id: string): void;
	pointerCancel(e: PointerEvent, id: string): void;
	keydown(e: KeyboardEvent, id: string, visualIndex: number): boolean;
	consumeClickSuppression(detail: number): boolean;
	translateFor(id: string, visualIndex: number): number;
	readonly draggingId: string | null;
	readonly canReorder: boolean;
}
```

### Behavior preservation

- Target snap keeps the existing algorithm (first allowed index ≥ bounded candidate, else last allowed) — equivalent to nearest-clamp while the allowed set is a contiguous run, which it always is (the Reference Layer is the fixed bottom row).
- Items changing mid-drag (e.g. undo removing a layer) keep the current getter-reevaluation behavior; no new defensive logic.
- `onDrop(id, toVisualIndex)` aligns with the existing `onReorderLayer` / `onReorderFrame` prop signatures — no prop changes.
- Input representation intentionally differs from `long-press` (PointerEvents vs. snapshots): this module owns capture/preventDefault policy, which requires the event and element; `long-press` doesn't own those, hence its snapshots. A doc comment on the module should state this distinction.

## Agent Brief

> *This was generated by AI during triage.*

**Category:** enhancement
**Summary:** Extract TimelinePanel's twin layer/frame drag-reorder machines into one headless Reorder Interaction module (two adapters), moving behavior coverage from component-mount tests to headless unit tests.

**Current behavior:**
Layer-row reorder (vertical) and frame-ruler reorder (horizontal) are two parallel state machines inside TimelinePanel's script: separate `$state` fields, separate compute/clamp/translate/handler functions, separate commit paths. Keyboard reorder exists only for layers via a helper that duplicates the allowed-set neighbor knowledge. All of it is reachable only by mounting the component and dispatching synthetic PointerEvents.

**Desired behavior:**
One `createReorderInteraction` factory (per the interface sketch above) instantiated twice in TimelinePanel — layers (`axis: 'y'`, allowed = Pixel visual indices, no threshold) and frames (`axis: 'x'`, allowed = full range, `tapThresholdPx: 4`). The component becomes a thin adapter: forwards pointer/keyboard events, measures extents, applies translate style vars, and routes `onDrop` to the existing reorder props. Observable behavior is unchanged (see Behavior preservation).

**Key interfaces:**
- `ReorderInteractionOptions` / `ReorderInteraction` — as sketched in this issue; treat the sketch as the contract, adjusting only marshalling details discovered during implementation.
- TimelinePanel props (`onReorderLayer`, `onReorderFrame`, `onSelectFrame`) — must not change.
- CONTEXT.md "Reorder Interaction" (§ Timeline) — the canonical vocabulary for names in code and tests.

**Acceptance criteria:**
- [ ] The module lives in `src/lib/gestures/` as a factory returning the sketched interface; it imports nothing from other `$lib` areas (foundational leaf, like `long-press`).
- [ ] TimelinePanel instantiates it twice and deletes both inline machines, including the twin compute/clamp/translate functions, the keyboard neighbor helper, and the suppression flag — the component keeps only adapter wiring and its Enter/Space propagation guard.
- [ ] Every existing drag/keyboard behavior case (~20: layer pointer drags, layer arrow-key steps, frame drag/tap/suppression) has a 1:1 headless counterpart in the module's test file; the mapping is stated in the test file or PR description.
- [ ] The component suite keeps its DOM-contract tests (handle rendering/disabled states, propagation) and gains adapter wiring smokes: a layer drag commit, a frame tap-select vs. drag-commit pair, and a translate style-var application.
- [ ] Behavior invariants hold in the headless tests: second pointer cannot steal a drag; cancel never commits; release at the original index never commits; layer drags cannot target the Reference row; sub-threshold frame jitter selects instead of reordering; keyboard clicks (`detail === 0`) are never suppressed; a stale suppression flag is cleared by the next pointerdown; arrow keys are ignored mid-drag.
- [ ] Full unit suite and existing e2e specs pass with no e2e modifications.

**Out of scope:**
- Wiring keyboard reorder for frames (the module makes it possible; enabling it is a separate product decision).
- New defensive logic for items changing mid-drag (preserve current behavior).
- TimelinePanel touch-target sizing (tracked separately in the todo backlog).
- Every other candidate from the 2026-07-04 architecture review.
