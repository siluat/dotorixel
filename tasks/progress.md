# Progress

## Currently Working On

None

## Last Completed

Fix sampling disruption commits as cancel (PR 1) — pinch / pointerleave / blur during a sampling session now route to `onSampleCancel` instead of committing the picked color ([issue](../issues/078-deepen-loupe-session.md))

## Next Up

- Deepen SamplingSession — extract port-injected session with reactive position (PR 2) — [Plan](../issues/078-deepen-loupe-session.md)
  - Begins after PR 1 merges. Purely structural; 4 internal commits.
- [054 — Floating reference windows: UI design spec](../issues/054-reference-images-design.md) (HITL design)
  - First gate for PRD 053 (Floating reference image windows). Unblocks 055–062.
- [018 — RightPanel (Apple Native)](../issues/018-apple-right-panel.md)
  - Independent. Can start immediately.
- [019 — StatusBar (Apple Native)](../issues/019-apple-status-bar.md)
  - Same PRD as 018. Can start independently.
- Deepen per-stroke state — StrokeSession factory with typed openers ([plan](../issues/075-deepen-stroke-session.md))
  - Review-backlog refactor. Can start immediately.
