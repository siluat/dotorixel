---
title: "Constrain latch snapshot-restore guard + ownership wording"
status: done
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

## Results

| File | Description |
|------|-------------|
| `src/lib/canvas/editor-session/editor-controller.svelte.test.ts` | Added a snapshot-restore regression guard: arm the latch, round-trip the workspace through `toSnapshot()` → `restored`, assert the rebuilt editor starts with the latch off and a line stays free-form |
| `src/lib/canvas/constrain-latch.svelte.ts` | Reworded the doc comment from "Workspace-scoped" to "Editor-session-scoped" and added a paragraph naming the actual owner (composition root / controller) |

### Key Decisions

- The guard asserts **both** the flag (`isConstrainActive` off) and actual free-form drawing (`getPixel`), so it catches more than one failure mode: moving latch ownership into the Workspace, or leaking latch state through shared snapshot state. Not a vacuous test.
- In the ownership paragraph, dropped a redundant "stays out of the snapshot" clause because the existing "Session-transient" paragraph already states it — the new paragraph carries the *why* (ownership), the old one the *lifecycle*.
- Left `docs/platform-status.md` unchanged: no feature implementation or status marker changed; the Constrain latch row's behavior is unaffected.

### Notes

- The guard is GREEN from construction by design — the latch lives at the composition root and structurally cannot enter the workspace snapshot, exactly the property credited by the comparative review. The test pins the load-bearing "session-transient, never persisted" contract for upcoming project-file/persistence work.
- This was the fourth and final follow-up porting the strengths of closed PR #265; the thread is now complete.
