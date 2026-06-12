---
title: "Consolidate toolbar Constrain-latch specs into a shared contract"
status: ready-for-agent
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
