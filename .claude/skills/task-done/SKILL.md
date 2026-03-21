---
description: Complete the current task. Record in done.md, remove from todo.md, update progress.md, and commit.
user_invocable: true
---

# /task-done

When a task item is completed, follow these steps in order, then create a git commit. This ensures implementation code and task records are included in the same commit.

## Steps

### 1. Update done.md

Add a record at the top of `tasks/done.md` (just below `# Done`) using the following format.

```text
### Task Title

#### Results
| File | Description |
|------|-------------|
| `file/path` | description |

#### Key Decisions
- Which option was chosen and why

#### Notes
- Exceptions, caveats, or anything that may affect follow-up work
```

- "Results" is required. "Key Decisions" and "Notes" are only included when applicable.

### 2. Update todo.md

Remove the completed item from `tasks/todo.md`.

### 3. Update progress.md

Update `tasks/progress.md`:
- Set "Currently Working On" to "None".
- Set "Last Completed" to the task just finished.
- Update "Next Up":
  1. Identify candidate items from `tasks/todo.md`.
  2. Analyze dependencies between them — only include items that can be worked on in parallel.
  3. List the independent items as bullet points.

### 4. Git commit

**Guard: verify current branch is not `main`.** If on `main`, stop and alert the user — do not commit.

Commit implementation code and task record changes together on the current work branch.
