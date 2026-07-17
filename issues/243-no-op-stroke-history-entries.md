---
title: No-op strokes push empty undo entries (web + Apple, all session species)
status: needs-triage
created: 2026-07-17
---

## Problem

Every stroke session pushes an undo snapshot at stroke start, before knowing
whether the stroke will change any pixels. A stroke that ends as a visual
no-op (out-of-canvas tap, same-color flood fill, zero-effect drag) therefore
leaves an entry on the undo stack that restores an identical state: the user's
next Undo appears to do nothing and consumes an undo slot (the stack is
capped).

This is cross-shell and cross-tool by construction:

- Web: the session sugars emit `captureUndoSnapshot` from `start()`
  unconditionally; `TabState.#applyEffects` pushes eagerly;
  `DocumentHistory.push_document` does not dedupe.
- Apple: `FreehandStrokeSession` / `ShapeStrokeSession` /
  `OneShotStrokeSession` call `captureUndoSnapshot()` in `start()`
  unconditionally; `PixelCanvasHistory.push_snapshot` does not dedupe.

The behavior is pinned as intentional web parity in `FloodFillSessionTests`
(issue 232) — flagged by greptile-apps and cubic-dev-ai on PR #321.

## Directions to evaluate

- Discard the snapshot at stroke end when nothing changed (needs an
  end-of-stroke "did change" signal on both shells' session seams).
- Dedupe identical consecutive snapshots in the core `History<T>` ring, fixing
  both shells at one authority — whole-Document equality on web may be costly;
  measure first.
- Accept the status quo (undo restoring an identical state is harmless, slots
  are cheap) and close as wontfix.

Any fix must land on both shells in the same change to preserve parity, and
must update the parity-pinning assertions in `FloodFillSessionTests`.
