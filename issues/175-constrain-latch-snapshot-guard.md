---
title: "Constrain latch snapshot-restore guard + ownership wording"
status: ready-for-agent
created: 2026-06-12
---

## Context

Fourth of four follow-ups porting the strengths of the closed PR [#265](https://github.com/siluat/dotorixel/pull/265), per the [comparative review](https://github.com/siluat/dotorixel/pull/266#issuecomment-4691161728). Two small hardening items; either can ship the moment it's done.

## What to build

1. **Snapshot-restore regression guard.** A test pinning that the Constrain latch starts off when a workspace is restored from a snapshot: arm the latch, snapshot the workspace, rebuild the editor from that snapshot, and assert the latch is off and Shift-constrain is inactive. In the merged design the latch lives outside the Workspace and structurally cannot enter a snapshot — but the "session-transient, never persisted" contract is load-bearing for the upcoming project-file/persistence work, and the guard is cheap. The source PR carried this test; the merged implementation only covers the fresh-construction default.
2. **Ownership wording.** The ConstrainLatch doc comment opens with "Workspace-scoped", but the latch is deliberately *not* owned by the Workspace — it is constructed at the editor composition root and owned by the controller, which is exactly the property the comparative review credits the design for. Reword to "editor-session-scoped" (or equivalent) so the comment names the actual owner. (Raised by the Codex structural review.)

## Acceptance criteria

- A test arms the latch, round-trips the workspace through a snapshot restore, and asserts the restored editor starts with the latch off (no constrained drawing without keyboard Shift)
- The ConstrainLatch doc comment no longer claims workspace scope and names the actual ownership (editor session / composition root)
- Full unit suite passes

## Blocked by

None - can start immediately
