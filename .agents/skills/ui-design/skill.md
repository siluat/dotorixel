---
description: Design UI in .pen files. Interview for design direction, create issue file, execute design, and get user review.
user_invocable: true
model: opus
effort: high
---

# /ui-design

Follow these steps in order for UI design tasks that produce `.pen` file(s).

## Steps

### 1. Interview

Invoke the `/grill-me` skill to interview the user about the design direction. Reach agreement on scope, layout, visual approach, and any constraints.

### 2. Create a design issue file

Create a markdown file in the `issues/` directory:

- Determine the next issue number by scanning existing files (three-digit zero-padded).
- Use the design issue template below.
- Link the issue file in the corresponding `tasks/todo.md` entry.

<design-issue-template>

```markdown
---
title: <short descriptive title>
type: design
status: open
created: <YYYY-MM-DD>
---

## Design Scope

What to design, which .pen file(s), and which frames/screens.

## References

- Related existing designs, screens, or documents
- Related implementation tasks or PRDs

## Design Plan

Key decisions and direction agreed during the interview.

## Constraints

- Technical, layout, or platform constraints
```

</design-issue-template>

### 3. Design

Begin design work using Pencil MCP tools.

### 4. Review

Ask the user to review the design. Adjust as needed based on feedback.
