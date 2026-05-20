---
description: Complete the current task. Update issue file, done.md, todo.md, progress.md, platform-status.md, and commit.
user_invocable: true
# model: sonnet  # blocked by anthropics/Codex#34912
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

`tasks/progress.md` is **orientation for the next session**, not a changelog. Keep it tight: a reader should pick up "where are we, what just shipped, what's next" in seconds. Implementation details live in the issue file — link to it instead of restating it.

- **"Currently Working On"** — overwrite, do not append. 1–3 sentences max.
  - If the completed task has a `parent` PRD (check issue frontmatter) and sibling sub-issues remain open: keep "Currently Working On" as the parent PRD title with a link (e.g., `Tab system — multi-image workflow ([PRD](../issues/002-tab-system.md))`) and a brief progress summary (how many sub-issues done / remaining, what just unblocked).
  - Otherwise: set to "None".
- **"Last Completed"** — overwrite, do not append. 1–3 sentences max: link to the issue + the one or two facts a future reader needs (notable invariant locked in, out-of-scope follow-up). No function names, file paths, type signatures, or per-sub-issue change-by-change recaps — those are in the issue file.
- **"Next Up"**:
  1. Enumerate **every** uncompleted item in `tasks/todo.md` across all sections and milestones.
  2. Filter by dependency readiness — only keep items that can start now.
  3. List the independent items as bullet points; per-item note ≤ 1 line. Strip notes that have become stale (e.g., "blocked on X" when X is now done).

### 5. Update platform-status.md

`docs/platform-status.md` is a **cross-platform matrix**, not a changelog. The Notes column answers "what's the most important cross-platform caveat or user-facing behavior for this row?" — nothing more.

If the completed task added or changed any feature implementation, update `docs/platform-status.md`:

- Add new rows for newly implemented features.
- Update status markers (⬜ → 🔧 → ✅) for features that progressed.
- Update the Notes column **by overwriting, not appending**. Per-issue change recaps do not accumulate here.
- Only track features where at least one of Core / Web / Apple has an implementation.

**Notes column rules**:

- Aim for ≤ 200 characters per cell. Prefer one phrase or one short sentence.
- Keep: platform-difference callouts ("Apple: core ready, UI disabled"), algorithm name ("BFS, 4-connectivity"), user-facing behavior caveats ("skips transparent pixels"), key constants ("1–256px, 18 Pebble colors").
- Strip: function/method/file/type names, per-issue tags (`(#087)`), implementation step-by-step, internal struct fields, WASM/binding-glue detail.
- If a detail is structurally significant (e.g., "Document is single source of truth on Web"), state it as an invariant — not as a recap of which issue established it. The issue file carries the history.

### 6. Git commit

**Guard: verify current branch is not `main`.** If on `main`, stop and alert the user — do not commit.
- **Exception — .pen-only tasks**: If the task only modified `.pen` files (Design/Sync tasks), committing on `main` is allowed. No PR is needed. After committing, push to remote.
- **Exception — planning-only tasks**: If the task only created/modified issue files (`issues/`) and task tracking files (`tasks/`), with no implementation code, committing on `main` is allowed. No PR is needed. After committing, push to remote.

Commit changes and task updates together.
