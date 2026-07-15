---
title: Apple native — stroke session architecture (prefactoring for the full tool set)
status: ready-for-agent
created: 2026-07-15
---

## Parent

[013 — Apple native catch-up (RFC)](013-apple-native-catchup.md) — Phase 2: Full
tool set + color.

## What to build

Prefactor the Apple shell's drawing pipeline so that every pointer stroke runs
through a per-stroke **session** with an explicit lifecycle, then migrate pencil
and eraser onto it with unchanged behavior. This is the "make the change easy"
step: every remaining Phase 2 tool slice plugs a new session kind into this seam.

Today the canvas coordinator applies the active tool pixel-by-pixel as samples
arrive. That shape can express only continuous tools. The tools coming next need
lifecycles the current pipeline cannot represent:

- **Shape tools** (line/rect/ellipse) — snapshot at stroke start, restore + redraw
  the whole preview on every drag sample, commit on release.
- **One-shot tools** (flood fill) — fire once on the first sample, ignore the drag.
- **Deferred-commit tools** (eyedropper) — sample during the drag, commit an effect
  only at release; cancel must discard it.
- **Move** — snapshot + re-shift relative to the drag origin; cancel restores.

Introduce a per-stroke session contract — conceptually `start / draw(current,
previous) / end / cancel` — resolved from the active tool when a stroke begins.
The web's stroke engine and tool-authoring sugars are the behavioral reference,
but the Swift implementation should be idiomatic (protocol- or closure-based as
fits), not a transliteration.

Also widen the shell-side tool identity: the editor's active tool is currently
the core `ToolType` enum, which exists for per-pixel `apply` and will never gain
fill/eyedropper/move variants (those are canvas ops or shell behaviors, not
per-pixel stamps — same split the web uses). Introduce a Swift-side tool identity
that covers the current tools, carries the user-visible display name, and can
grow per tool slice; it maps down to core `ToolType` only where per-pixel apply
is involved.

Behavioral invariants to preserve (all covered by existing tests):

- Pencil/eraser paint interpolated segments between samples (no gaps on fast drags).
- An undo snapshot is captured at stroke start; one undo reverts the whole stroke.
- Redundant samples on the same pixel don't trigger redraws.
- An interrupted pointer sequence (e.g. `touchesCancelled`) tears the session down;
  after this slice it must route through the session's `cancel`, not `end`.

## Acceptance criteria

- Pencil and eraser draw exactly as before: interpolated, history-integrated,
  re-rendering only when pixels change. Existing editor-state tests and docked
  snapshot tests pass unchanged.
- A stroke session is created per stroke from the active tool and driven through
  start → draw* → end (or cancel); unit tests cover the lifecycle order, including
  cancel-without-commit.
- Tool identity is shell-owned: the active-tool state, toolbar, and status bar
  read the Swift-side tool identity; core `ToolType` appears only at the FFI
  drawing call sites.
- The session seam demonstrably supports a non-continuous lifecycle (e.g. a test
  double session that defers an effect to `end` and discards it on `cancel`) —
  proving the seam is ready for shape/eyedropper/move without shipping them.
- No new UI. Status bar and toolbar behavior unchanged.

## Blocked by

None - can start immediately.
