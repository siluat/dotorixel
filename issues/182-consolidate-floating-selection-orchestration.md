---
title: Consolidate Floating Selection orchestration out of TabState
status: ready-for-agent
created: 2026-06-14
---

## Context

From an architecture-depth review of the editor-session hub. The transient **Floating Selection** lifecycle already lives in a deep module (`FloatingSelectionLifecycle`) with a small interface; the friction is that its *orchestration* spilled back into the `TabState` god-object in two concrete places. This slice pulls that spill back behind the lifecycle's interface. It is a web-only TypeScript consolidation — no behavior change.

The two spills:

1. **commit-before-mutation, repeated ~13×.** Every undoable document mutation on `TabState` (clear, flip H/V, rotate CW/CCW, clear marquee, clear marquee pixels, add/remove/reorder layer, set active layer, set layer visibility, set reference placement, resize) calls `#commitIdleFloatingSelection()` before committing. The policy is one rule smeared across thirteen call sites.
2. **snapshot baseline marquee leak.** During a selection-drag the document's **Marquee** is transiently projected to the dragged position, so `TabState` holds a `#selectionPreviewBaselineMarquee` field — captured in the draw lifecycle and read in `toSnapshot()` — to persist the *pre-drag* marquee. Selection-drag internals leak into the persistence path.

Shape decided during the review (the commit boundary and the snapshot accessor are the decision-rich parts):

```ts
// TabState: one boundary replaces the 13 scattered commit-before-mutation calls
#mutate(intent: UndoableDocumentIntent): DocumentChangeResult {
  this.#floatingSelection.commitIfPending();   // was #commitIdleFloatingSelection ×13
  return this.#documentChangeJournal.commit({ kind: 'undoable-document', intent });
}

// FloatingSelectionLifecycle owns the marquee-to-persist; the TabState field is deleted
marqueeForSnapshot(documentMarquee): MarqueeRegion | null   // baseline while a selection-drag
                                                            // projection is active, else documentMarquee
```

## What to build

Move the Floating Selection commit-before-mutation policy and the snapshot-marquee ownership behind `FloatingSelectionLifecycle`, so `TabState` drives the selection feature through that one interface instead of re-implementing its policy.

- Route every undoable document mutation through a single `TabState` boundary that first commits any pending Floating Selection via a new `FloatingSelectionLifecycle.commitIfPending()`, replacing the thirteen `#commitIdleFloatingSelection()` calls.
- Give `FloatingSelectionLifecycle` a `marqueeForSnapshot(documentMarquee)` accessor that returns the pre-drag baseline while a selection-drag projection is active and the live document marquee otherwise; delete `TabState`'s `#selectionPreviewBaselineMarquee` field and its captures in the draw lifecycle, and have `toSnapshot()` query the accessor.
- Optionally route the floating effects (begin / move / commit / cancel) through a `FloatingSelectionLifecycle.applyEffect` to shrink the `TabState` effect switch — only if it reads cleaner; not required.

Preserve two subtleties: the existing `isDrawing` guard semantics that some callers (e.g. the clear-marquee path) rely on must survive the move to the single boundary; and `setMarquee` stays a journal-routed Marquee mutation, not part of the floating-commit path.

## Acceptance criteria

- A single `TabState` mutation boundary commits any pending Floating Selection (via `FloatingSelectionLifecycle.commitIfPending()`) before applying an undoable intent; the per-method `#commitIdleFloatingSelection()` repetition is gone and the prior `isDrawing` guard behavior is unchanged.
- `toSnapshot()` obtains the marquee to persist from `FloatingSelectionLifecycle.marqueeForSnapshot(...)`; the `#selectionPreviewBaselineMarquee` field and its draw-lifecycle captures no longer exist.
- Selection behavior is unchanged end-to-end: define marquee, lift and drag, paste, duplicate, nudge, cancel, commit; undo cancels an active Floating Selection; mutating the document while a Floating Selection floats commits it first; a persisted snapshot stores the pre-drag marquee.
- The existing `TabState` behavior tests pass unchanged (the regression net); new unit tests cover `commitIfPending()` and `marqueeForSnapshot()` at the `FloatingSelectionLifecycle` interface.
- Web-only: no Rust core, binding, persistence-format, `CONTEXT.md`, or ADR changes.

## Blocked by

None - can start immediately.
