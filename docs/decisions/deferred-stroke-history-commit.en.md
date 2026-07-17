# Deferred Stroke History Commit

## Status

Accepted (2026-07-17)

## Context

Every stroke session on both shells pushed an undo snapshot at stroke start,
before knowing whether the stroke would change any pixels — strokes, unlike
commands, cannot be no-op-guarded predictively. A stroke that ended as a
visual no-op (out-of-canvas tap, same-color fill or retrace, zero-delta move,
cancelled shape preview) therefore left an entry that restores an identical
state: the next Undo appeared dead. Worse, the eager push cleared the redo
stack, so a stray no-op stroke silently destroyed the entire redo future.

The web journal already guards command paths predictively (`willChange`); the
stroke path was the one place the "no-op ⇒ no History entry" invariant did not
hold. (Issue 243.)

## Decision

Move the stroke commit into the core `History<T>` ring as a pending-baseline
seam — the **Stroke Baseline** — exposed on both species (`DocumentHistory`,
`PixelCanvasHistory`) and both FFI bindings:

- `begin_stroke` captures the pre-stroke value and holds it pending. Nothing
  is pushed; the redo stack is untouched.
- `end_stroke` compares the pending baseline with the caller's current value
  and pushes the baseline **only when they differ**. The redo future is
  cleared only on that real push.
- Equality is decided by the core via value comparison (`PartialEq`), never by
  shell- or tool-supplied signals. Cancel paths need no separate API: a cancel
  that restores the baseline compares equal and discards.
- `push` (command paths) stays eager and independent of any pending baseline.
  Undo/redo while a baseline is pending is a shell-side precondition violation
  (the `isDrawing` seals), debug-asserted in core.

## Alternatives considered

- **Shell/tool did-change signals** (`end_stroke(did_change: bool)`): no
  comparison cost, but the existing signals are write-accurate, not
  value-accurate (`apply_tool` reports true when repainting a pixel with its
  own color), so same-color retraces and zero-delta moves would still push —
  and every present and future session on both shells must thread the signal
  correctly, the same per-shell duplication that produced this bug.
- **Consecutive-duplicate dedupe at push**: a no-op stroke's entry equals the
  *current* state, not the stack top, so push-time dedupe never fixes the
  immediate case (undo right after the no-op is still dead); it only caps
  accumulation.
- **Shell-held pending baseline**: no FFI change, but re-implements the
  undo/redo state machine per shell — the Core Placement rule names that state
  machine as the canonical single-authority case.
- **Wontfix**: rejected once the redo destruction was found; the harm goes
  beyond one wasted undo slot.

## Consequences

- The comparison cost is the same order as the per-stroke clone the push
  already paid. Real strokes exit at the first differing byte; a full scan
  happens only for actual no-ops, which are rare. `Document` gains a
  `PartialEq` derive to support this.
- `can_undo` stays false during a stroke until the commit at stroke end
  (previously true from stroke start). Shells already block undo mid-stroke,
  so this is invisible in the UI.
- The Apple parity pins asserting "snapshot pushed even for a no-op stroke"
  invert, and the web sugars' snapshot-at-start contract becomes
  begin-at-start / commit-at-end.
