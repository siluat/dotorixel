---
name: prd-to-issues
description: Break a PRD into independently-grabbable local issue files using tracer-bullet vertical slices. Use when user wants to convert a PRD to issues, create implementation tickets, or break down a PRD into work items.
---

# PRD to Issues

Break a PRD into independently-grabbable local issue files using vertical slices (tracer bullets).

## Process

### 1. Locate the PRD

Ask the user for the PRD file path (e.g., `issues/002-tab-system.md`).

If the PRD is not already in your context window, read it with the Read tool.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code.

### 3. Draft vertical slices

Break the PRD into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **Scenarios covered**: which scenarios from the PRD this addresses

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Create the issue files

For each approved slice, create a markdown file in the `issues/` directory.

1. Determine the next issue number by scanning existing files in `issues/` (three-digit zero-padded: `001`, `002`, `003`, …).
2. Create issues in dependency order (blockers first) so you can reference real issue numbers in the "Blocked by" field.
3. Link each issue file in `tasks/todo.md`: if the corresponding task item already exists, append a link. If no matching item exists, add a new item with the link.

<issue-template>

```markdown
---
title: <short descriptive title>
status: open
created: <YYYY-MM-DD>
parent: <NNN>-<parent-prd-slug>.md
---
```

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation. Reference specific sections of the parent PRD rather than duplicating content.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- [NNN — Title](NNN-slug.md) (if any)

Or "None — can start immediately" if no blockers.

## Scenarios addressed

Reference by number from the parent PRD:

- Scenario 3
- Scenario 7

</issue-template>

Do NOT modify the parent PRD file's status.
