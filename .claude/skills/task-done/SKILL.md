---
description: Complete the current task. Record in done.md, update record file, update todo.md, update progress.md, update platform-status.md, and commit.
user_invocable: true
model: sonnet
effort: medium
---

# /task-done

When a task item is completed, follow these steps in order, then create a git commit. This ensures implementation code and task records are included in the same commit.

## Steps

### 1. Update the record file

Find the record file for the current task in `tasks/records/`. If the file does not exist (e.g., `/task-start` was interrupted before creating it), create it now:

1. Determine the next record number by scanning existing files in `tasks/records/`.
2. Create `tasks/records/<NNN>-<slug>.md` with a `# NNN — Task Title` heading and a `## Plan` section containing the original implementation plan verbatim from the current conversation context. Do not summarize or paraphrase — copy the approved plan as-is.

Once the record file exists, append a `## Results` section using the following format:

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

### 2. Update done.md

Add a row at the top of the table in `tasks/done.md` (just below the header row) linking to the record file:

```text
| NNN | [Task Title](records/NNN-slug.md) | YYYY-MM-DD |
```

### 3. Update todo.md

Remove the completed item from `tasks/todo.md`.

### 4. Update progress.md

Update `tasks/progress.md`:
- Set "Currently Working On" to "None".
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

Commit changes and task record updates together.
