---
name: write-a-prd
description: Create a PRD through user interview, codebase exploration, and module design, then save as a markdown file in issues/. Use when user wants to write a PRD, create a product requirements document, or plan a new feature.
---

This skill will be invoked when the user wants to create a PRD. You may skip steps if you don't consider them necessary.

1. Ask the user for a long, detailed description of the problem they want to solve and any potential ideas for solutions.

2. Explore the repo to verify their assertions and understand the current state of the codebase.

3. Interview the user relentlessly about every aspect of this plan until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one.

4. Sketch out the major modules you will need to build or modify to complete the implementation. Actively look for opportunities to extract deep modules that can be tested in isolation.

A deep module (as opposed to a shallow module) is one which encapsulates a lot of functionality in a simple, testable interface which rarely changes.

Check with the user that these modules match their expectations. Check with the user which modules they want tests written for.

5. Once you have a complete understanding of the problem and solution, use the template below to write the PRD as a markdown file in the `issues/` directory.

**File creation steps:**

- Determine the next issue number by scanning existing files in the `issues/` directory (three-digit zero-padded: `001`, `002`, `003`, …). If no issue files exist yet, start at `001`.
- Create the file as `issues/<NNN>-<slug>.md` where `<slug>` is a short kebab-case summary.
- Link the issue file in `tasks/todo.md`: if the corresponding task item already exists, append a link (e.g., `— [PRD](../issues/<NNN>-<slug>.md)`). If no matching item exists, add a new item with the link.

<prd-template>

```markdown
---
title: <short descriptive title>
status: open
created: <YYYY-MM-DD>
---
```

## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## Key Scenarios

A numbered list of concrete scenarios that describe observable behavior. Each scenario states a situation, an action, and the expected outcome in plain language. Focus on what the system does, not on restating user motivation — the Problem Statement already covers "why."

<scenario-example>
1. The user presses Ctrl+Z after drawing a stroke → the stroke is removed and the canvas reverts to its previous state
2. The user draws a new stroke after undoing → the redo stack is cleared
3. The user attempts to undo with an empty history → nothing happens, no error shown
</scenario-example>

Cover all distinct aspects of the feature (breadth), but for each aspect, list only the scenarios that carry non-obvious implementation or testing signal (depth). Trivial variations of an already-clear behavior can be omitted.

## Implementation Decisions

A list of implementation decisions that were made. This can include:

- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

## Testing Decisions

A list of testing decisions that were made. Include:

- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Rejected Alternatives

Approaches that were considered and explicitly rejected during the design discussion. For each, state what was proposed and why it was not chosen. This prevents future sessions from re-exploring dead ends.

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.

</prd-template>
