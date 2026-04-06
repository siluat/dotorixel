---
name: request-refactor-plan
description: Create a detailed refactor plan with tiny commits via user interview, then file it as a markdown issue in issues/. Use when user wants to plan a refactor, create a refactoring RFC, or break a refactor into safe incremental steps.
---

This skill will be invoked when the user wants to create a refactor request. You should go through the steps below. You may skip steps if you don't consider them necessary.

1. Ask the user for a long, detailed description of the problem they want to solve and any potential ideas for solutions.

2. Explore the repo to verify their assertions and understand the current state of the codebase.

3. Ask whether they have considered other options, and present other options to them.

4. Interview the user about the implementation. Be extremely detailed and thorough.

5. Hammer out the exact scope of the implementation. Work out what you plan to change and what you plan not to change.

6. Look in the codebase to check for test coverage of this area of the codebase. If there is insufficient test coverage, ask the user what their plans for testing are.

7. Break the implementation into a plan of tiny commits. Remember Martin Fowler's advice to "make each refactoring step as small as possible, so that you can always see the program working."

8. Write the refactor plan to an issue file in `issues/`.

   First, check for an uncommitted RFC file: run `git status` and look for untracked or modified files in `issues/` that use the RFC template structure (contain sections like "Proposed Interface" or "Dependency Strategy"). An uncommitted RFC means it was just created in the current session — likely by a preceding `improve-codebase-architecture` workflow.

   **If an uncommitted RFC exists**, update it in place:
   1. Preserve the RFC's architectural context (Problem, Proposed Interface sections).
   2. Replace "Implementation Recommendations" with the detailed "Commits" section.
   3. Replace "Testing Strategy" with the detailed "Testing Decisions" section.
   4. Merge "Dependency Strategy" into a new "Decision Document" section, adding implementation decisions from the interview.
   5. Add "Out of Scope" section.
   6. Update the `tasks/todo.md` link if the label changed.

   **Otherwise**, create a new issue file:
   1. Determine the next issue number by scanning existing files in `issues/` (three-digit zero-padded: `001`, `002`, `003`, …).
   2. Create `issues/NNN-<slug>.md` using the template below, including frontmatter with `status: open`.
   3. Link the issue file in `tasks/todo.md`: if the corresponding task item already exists, append a link (e.g., `— [Plan](../issues/NNN-<slug>.md)`). If no matching item exists, add a new item with the link.
   4. Share the file path with the user.

### Issue lifecycle

When an issue is completed, update its frontmatter `status` to `done`. The issue file remains in `issues/` as a permanent record.

### Issue template

<refactor-plan-template>

---
title: <concise description of the refactor>
status: open
created: <YYYY-MM-DD>
---

## Problem Statement

The problem that the developer is facing, from the developer's perspective.

## Solution

The solution to the problem, from the developer's perspective.

## Commits

A LONG, detailed implementation plan. Write the plan in plain English, breaking down the implementation into the tiniest commits possible. Each commit should leave the codebase in a working state.

## Decision Document

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

## Out of Scope

A description of the things that are out of scope for this refactor.

## Further Notes (optional)

Any further notes about the refactor.

</refactor-plan-template>
