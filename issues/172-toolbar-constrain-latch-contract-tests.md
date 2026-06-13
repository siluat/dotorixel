---
title: "Consolidate toolbar Constrain-latch specs into a shared contract"
status: done
created: 2026-06-12
---

## Context

First of four follow-ups porting the genuine strengths of the closed PR [#265](https://github.com/siluat/dotorixel/pull/265) onto the merged #266 implementation, per the [comparative review](https://github.com/siluat/dotorixel/pull/266#issuecomment-4691161728). This issue ports the shared contract-test pattern.

## What to build

The touch ToolStrip and the docked LeftToolbar share the same Constrain-latch re-tap semantics, but each component verifies them with its own near-identical spec file (~100 lines each, differing only in the interaction verb). Replace the twin specs with one shared contract: a helper that defines the toolbar Constrain-latch behavioral contract once, which each component's spec runs against its own render. This prevents the two toolbar surfaces from drifting apart behaviorally — and means the upcoming radiogroup conversion (issue 173) edits one contract instead of two spec files.

Derive the constrainable / non-constrainable tool lists and button labels inside the contract from the tool registry / tool-ui metadata rather than hardcoding them, so the contract cannot drift from the production classification (this was a review-round fix in the source PR — port the final form).

Adapt the ported pattern to this codebase's prop names and current markup semantics (`aria-pressed` buttons, label lookups tolerant of the latched label suffix). The source PR's helper asserts radio semantics that do not exist here yet; that conversion is issue 173, which builds on this helper.

Test-only change: production markup and behavior stay identical.

## Acceptance criteria

- A single shared contract helper defines the Constrain-latch toolbar behaviors; both toolbar specs invoke it instead of duplicating cases, reducing each per-component spec to a thin shell (render function + contract invocation)
- Tool lists and labels inside the contract are derived from registry/tool-ui exports, not literal sets
- The contract covers at least the union of today's two spec files — including ToolStrip's "inactive constrainable tools show no Constrain state" case, which LeftToolbar's spec currently lacks
- No production code changes; full unit suite passes; svelte-check clean

## Blocked by

None - can start immediately

## Results

| File | Description |
|------|-------------|
| `src/lib/ui-editor/toolbar-constrain-latch.contract.ts` | New shared contract: `describeToolbarConstrainLatch(name, verb, render)` defines the toolbar Constrain-latch behavior once; constrainable/non-constrainable tool lists and labels derived from `TOOL_ENTRIES` + `isConstrainableTool`; load-time guard fails loud if either tool group empties |
| `src/lib/ui-editor/LeftToolbar.svelte.test.ts` | Reduced to a thin shell (render fn + contract call); gained the inactive-constrainable case from the union (9 → 10 cases) |
| `src/lib/ui-editor/ToolStrip.svelte.test.ts` | Reduced to a thin shell (render fn + contract call) |

### Key Decisions

- **Contract = a `describe`-injecting function over each spec's own render.** Each surface keeps its markup/render local while sharing the behavioral contract — so the two toolbars cannot drift apart, and 173's radiogroup conversion edits one file instead of two.
- **Tool lists/labels derived from the registry, not literals**, so the contract can never disagree with production's `isConstrainable` classification.
- **`verb: 'click' | 'tap'` union** preserves each surface's wording ("re-click" / "re-tap") and deliberately avoids the codebase's established "gesture" term (pointer drag/zoom/resize) to keep domain vocabulary consistent.
- **Load-time guard (≥2 constrainable, ≥1 non-constrainable) over an in-suite assertion**: blocks `it.each` from silently collapsing to zero cases (false-green). Verified it fires with an actionable message.
- **First `.contract.ts` file in the codebase.** Not matched by vitest `include: ['src/**/*.test.ts']`, so it executes only when a spec imports it — no empty-suite collection.

### Notes

- Test-only change — no production markup or behavior touched. Full unit suite (1394 tests) + svelte-check clean.
- Union coverage closed a real gap: LeftToolbar previously lacked the "inactive constrainable tools show no Constrain state" case.
- Unblocks 173; 174 remains blocked by 173.
