---
description: Complete the current task. Update issue file, done.md, todo.md, progress.md, platform-status.md, and commit.
user_invocable: true
# model: sonnet  # blocked by anthropics/claude-code#34912
# effort: medium
---

# /task-done

When a task item is completed, follow these steps in order, then create a git commit. This ensures implementation code and task updates are included in the same commit.

## Steps

### 1. Update the issue file

Find the issue file for the current task in `issues/`.

**a) Set status to done**: Update the frontmatter `status: open` → `status: done`.

**b) Append Results**: Add a `## Results` section using the following format:

```text
## Results

| File | Description |
|------|-------------|
| `file/path` | description |

### Key Decisions
- Which option was chosen and why

### Notes
- Exceptions, caveats, or anything that may affect follow-up work
```

- "Results" is required. "Key Decisions" and "Notes" are only included when applicable.

**c) Check parent PRD completion**: If the issue has a `parent` field in its frontmatter, check whether all sibling sub-issues (other issue files with the same `parent`) now have `status: done`. If so, update the parent PRD issue file's `status` to `done` as well.

### 2. Update done.md

Add a row at the top of the table in `tasks/done.md` (just below the header row) linking to the issue file. Use the issue file number as the `#` column:

```text
| NNN | [Task Title](../issues/NNN-slug.md) | YYYY-MM-DD |
```

### 3. Update todo.md

Remove the completed item from `tasks/todo.md`.

### 4. Update progress.md

Update `tasks/progress.md`:
- **"Currently Working On"**:
  - If the completed task has a `parent` PRD (check issue frontmatter) and sibling sub-issues remain open: keep "Currently Working On" as the parent PRD title with a link (e.g., `Tab system — multi-image workflow ([PRD](../issues/002-tab-system.md))`).
  - Otherwise: set to "None".
- Set "Last Completed" to the task just finished.
- Update "Next Up":
  1. Identify candidate items from `tasks/todo.md`.
  2. Analyze dependencies between them — only include items that can be worked on in parallel.
  3. List the independent items as bullet points.

### 5. Update platform-status.md

If the completed task added or changed any feature implementation, update `docs/platform-status.md`:

- Add new rows for newly implemented features.
- Update status markers (⬜ → 🔧 → ✅) for features that progressed.
- Update the Notes column if relevant context changed.
- Only track features where at least one of Core / Web / Apple has an implementation.

### 6. Git commit

**Guard: verify current branch is not `main`.** If on `main`, stop and alert the user — do not commit.
- **Exception — .pen-only tasks**: If the task only modified `.pen` files (Design/Sync tasks), committing on `main` is allowed. No PR is needed.

Commit changes and task updates together.
