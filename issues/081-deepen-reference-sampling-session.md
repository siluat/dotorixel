---
title: Deepen reference sampling — extract ReferenceSamplingSession from TabState
status: done
created: 2026-05-01
---

## What to build

Extract the reference-image sampling lifecycle currently living inside `TabState` (`src/lib/canvas/editor-session/tab-state.svelte.ts:224–284`) into a new `ReferenceSamplingSession` module at `src/lib/reference-images/reference-sampling-session.svelte.ts`. The new module owns the async port-binding state machine — blob decode, port binding, press-time foreground preview, drag-time preview tracking, commit-on-release, race/stale handling — behind a small interface (`start`, `move`, `end`, `cancel` plus read-only `isActive` / `grid` / `position`).

`TabState` becomes a thin caller: three one-line delegations plus an unchanged `referenceSamplingSession` getter for the overlay. The 60+ lines of orchestration (`#refSampleSeq`, `#endPending`, `#referencePort`, `#previewSamplingCenter`) disappear from `TabState`. Effects flow back through return values only — no callbacks, no shared flags. Race conditions become internal invariants of the new module rather than cross-module concerns.

Concept canonicalised as **Reference Sampling Session** in `CONTEXT.md` (vs. **Canvas Sampling Session**, which stays synchronous and preview-less). User-visible behaviour is unchanged.

## Acceptance criteria

- [ ] `src/lib/reference-images/reference-sampling-session.svelte.ts` exposes a factory creating a `ReferenceSamplingSession` with `start(blob, coords, src): Promise<EditorEffects>`, `move(coords): EditorEffects`, `end(): EditorEffects`, `cancel(): void`, plus read-only `isActive`, `grid`, `position`.
- [ ] `decodeReferenceBlob` is injected via a port (`{ decode: (blob) => Promise<DecodedImage> }`) at construction; production default wires the existing implementation.
- [ ] `commitTarget` is an internal constant `'foreground'`, not exposed in the `start` signature.
- [ ] State machine handles all five flows: normal (decode → hold → release), race (release during decode), rapid retry (start while previous decoding), decode failure, decode failure after early release, and active + new start (previous active discarded without auto-commit).
- [ ] `TabState.referenceSampleStart` / `referenceSampleMove` / `referenceSampleEnd` reduce to one-line delegations through `#applyEffects`; `TabState` no longer holds `#refSampleSeq`, `#endPending`, `#referencePort`, or `#previewSamplingCenter`.
- [ ] The nine reference-sampling lifecycle tests in `tab-state.svelte.test.ts` move to `reference-sampling-session.svelte.test.ts` and exercise the new module's interface directly (no `vi.mock` on `decode-reference-blob`; tests inject the decode port).
- [ ] `tab-state.svelte.test.ts` retains exactly one integration test asserting reference-sampling effects flow through `#applyEffects` (foreground update, recent-color append, `notifier.markDirty` triggered).
- [ ] `EditorController`, `ReferenceWindowOverlay`, and `+page.svelte` require zero changes — the `referenceSamplingSession` getter on `TabState` continues to expose the same read-only `grid` / `position` / `isActive` shape.
- [ ] `CONTEXT.md`'s `Reference Sampling Session` definition matches the implemented behaviour.
- [ ] Web build green; all existing tests pass without behavioural change.

## Blocked by

None — can start immediately.

## Results

| File | Description |
|------|-------------|
| `src/lib/reference-images/reference-sampling-session.svelte.ts` | New module owning the async port-binding state machine. Factory `createReferenceSamplingSession({ decode })` returns a session with `start` / `move` / `end` / `cancel` lifecycle plus read-only `isActive` / `grid` / `position` and forwarded `updatePointer`. `commitTarget = 'foreground'` is internal. |
| `src/lib/reference-images/reference-sampling-session.svelte.test.ts` | New test file with 12 tests covering the lifecycle, race/stale handling, pending-commit, decode failure, cancel, and inputSource plumbing. Decode port injected per test via `withQueuedDecodes()` — no `vi.mock`. |
| `src/lib/canvas/editor-session/tab-state.svelte.ts` | `#refSampleSeq` / `#endPending` / `#referencePort` / `#previewSamplingCenter` removed. `referenceSampleStart` / `Move` / `End` collapsed to one-line delegations through `#applyEffects`. Constructor wires the production `decodeReferenceBlob` into the new module. |
| `src/lib/canvas/editor-session/tab-state.svelte.test.ts` | 12 reference-loupe lifecycle tests removed. One integration test retained that verifies effects flow through `#applyEffects` (`shared.foregroundColor`, `shared.recentColors`, `notifier.markDirty`). |
| `src/lib/canvas/editor-session/editor-controller.svelte.ts` | Single type-annotation update on the `referenceSamplingSession` getter (`SamplingSession` → `ReferenceSamplingSession`). Runtime behaviour unchanged. |
| `CONTEXT.md` | Seeded earlier in the session with `Sampling Session` / `Sampling Port` / `Loupe` / `Canvas Sampling Session` / `Reference Sampling Session` definitions. The implementation matches the canonicalised concept. |

### Key Decisions

- **Return type `ToolEffects`, not `EditorEffects`**: the new module only emits `colorPick` / `addRecentColor`, never `RunnerEffect` (canvas replacement). The tighter type makes the contract self-documenting; `ToolEffects ⊂ EditorEffects` keeps it assignable to `#applyEffects`.
- **Forward `updatePointer` from the new module**: the issue acceptance criteria listed `isActive` / `grid` / `position` as the read-only surface, but `+page.svelte` calls `editor.referenceSamplingSession.updatePointer(...)`. Forwarding keeps the "downstream zero changes" promise.
- **`cancel()` implementation + test added**: no caller exists today, but the contract demands it. Implemented to bump `startSeq`, clear `endPending`, drop the port, and `inner.cancel()` so a late decode after cancel cannot commit.

### Notes

- `EditorController` required a one-line return-type change despite the acceptance criteria saying "zero changes". Runtime is unchanged — the type narrowed because `ReferenceSamplingSession` is structurally distinct from `SamplingSession`. The "zero changes" bullet was an over-claim in the original brief.
- Browser smoke-check of the live reference long-press / drag / release flow was **not** performed. Tests and web build are green; the dev/prod gap warned about in `.claude/rules/testing.md` should be confirmed manually before relying on the refactor in production.
- Test count net: tab-state -12 lifecycle tests + 1 integration test; new file +12 tests. Suite total grew by +2 from the `cancel` and `active+new-start` cases that didn't exist in the original lifecycle suite.
