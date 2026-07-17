# Deferred History Commit

## Status

Accepted (2026-07-17)

## Context

Every edit recorded its undo entry before knowing whether it would change
anything, and an entry that restores an identical state is worse than useless:
the next Undo appears dead, and because the eager push clears the redo stack, a
single no-op silently destroys the entire redo future.

The two edit paths reached that state differently:

- **Strokes** could not be guarded predictively at all. A stroke that ends as a
  visual no-op (out-of-canvas tap, same-color fill or retrace, zero-delta move,
  cancelled shape preview) is only knowable once it has run. Every
  history-recording stroke session on both shells pushed at stroke start. (The
  eyedropper deliberately records none.)
- **Commands** were guarded predictively by the web journal's `willChange`
  table, but many of those guards inspected only the *kind* of the target, so a
  command that changed nothing still pushed: clearing an already-blank Pixel
  Layer, every marquee and canvas transform, the floating-selection commit.
  Apple's clear command had no content check at all. (Issues 243, 244.)

## Decision

Move the commit into the core `History<T>` ring as a pending-baseline seam —
the **Edit Baseline** — exposed on both species (`DocumentHistory`,
`PixelCanvasHistory`) and both FFI bindings. Both paths use it: a stroke and a
command are both edits, and the ring is the single authority on whether either
earned an entry.

- `begin_edit` captures the pre-edit value and holds it pending. Nothing is
  pushed; the redo stack is untouched.
- `end_edit` compares the pending baseline with the caller's current value and
  pushes the baseline **only when they differ**, returning whether it
  committed. The redo future is cleared only on that real push.
- Equality is decided by the core via value comparison (`PartialEq`), never by
  shell- or tool-supplied signals. Cancel paths need no separate API: a cancel
  that restores the baseline compares equal and discards.
- Shells gate on the returned verdict the follow-up work an edit only earns by
  changing something — re-render, dirty marking — and report the edit as
  not-applied to their own callers.
- The eager push is no longer reachable from either shell. Predicting a no-op
  is not merely unnecessary now; a second authority on the same question is
  what produced 244.
- What survives in the journal is a **validity** check, not a prediction: the
  rules the Document actually has (the last layer or frame cannot be removed, a
  Reference Layer cannot be reordered) and boundary validation of ids and
  sources. Two guards stay because they are rules rather than predictions —
  `set-marquee` and the floating-selection commit would move the Marquee even
  where their pixel work no-ops, so the core would honour them.
- Undo/redo while a baseline is pending is a shell-side precondition violation
  (the `isDrawing` seals), debug-asserted in core. Commands open and resolve
  their baseline synchronously, so they never nest inside a stroke's.

## Alternatives considered

- **Content-aware predictive guards per command** (244's original framing): keep
  the `willChange` table and teach each entry to inspect content — scan the
  layer for blankness before a clear, and so on. Rejected: it collapses for the
  transforms. Predicting whether a canvas flip changes anything means testing
  the pixels for symmetry, which is applying it and comparing — the comparison
  the ring already owns, re-implemented once per intent. It also keeps the
  guards load-bearing: they gate the apply, so a wrong one silently drops a
  *real* edit, a worse failure than the bug being fixed. And the core already
  no-ops gracefully on the cases the kind guards duplicated.
- **Shell/tool did-change signals** (`end_edit(did_change: bool)`): no
  comparison cost, but the existing signals are write-accurate, not
  value-accurate (`apply_tool` reports true when repainting a pixel with its
  own color), so same-color retraces and zero-delta moves would still push —
  and every present and future session on both shells must thread the signal
  correctly, the same per-shell duplication that produced this bug.
- **Consecutive-duplicate dedupe at push**: a no-op edit's entry equals the
  *current* state, not the stack top, so push-time dedupe never fixes the
  immediate case (undo right after the no-op is still dead); it only caps
  accumulation.
- **Shell-held pending baseline**: no FFI change, but re-implements the
  undo/redo state machine per shell — the Core Placement rule names that state
  machine as the canonical single-authority case.
- **Wontfix**: rejected once the redo destruction was found; the harm goes
  beyond one wasted undo slot. Frequency is no defence when the loss is silent
  and unrecoverable, and the paths most likely to hit it — rotate on a blank
  canvas, flip with nothing selected — are what a newcomer does while learning
  the tools.

## Consequences

- The comparison cost is the same order as the per-edit clone the push already
  paid. Real edits exit at the first differing byte; a full scan happens only
  for actual no-ops, which are rare. A no-op command now pays that clone and
  scan where a kind check was free — the accepted price for one authority.
  `Document` implements `PartialEq` manually to support this — a derive would
  inherit `Frame`'s identity-only equality and call retimed documents equal.
- `can_undo` stays false during a stroke until the commit at stroke end
  (previously true from stroke start). Shells already block undo mid-stroke, so
  this is invisible in the UI.
- The web journal applies its intent inside a `try`/`finally`: an apply that
  throws must still resolve the baseline, or it would stay pending and poison
  the next edit's `begin_edit`. A partial mutation compares as a change and
  stays undoable.
- The Apple parity pins asserting "snapshot pushed even for a no-op" invert,
  and the web sugars' snapshot-at-start contract becomes begin-at-start /
  commit-at-end.
- The core's public eager push (`push_document`, `push_snapshot`) keeps no
  production caller, surviving only as a test shortcut — issue 246 removes it
  so that "the Edit Baseline is the only way to record history" holds by
  construction rather than by convention.
