---
description: Start a task. Read progress.md, select the next task, and transition to working state.
user_invocable: true
---

# /task-start

Follow these steps in order when starting a task.

## Steps

1. Read `tasks/progress.md` to understand the current state.

2. **Check "Currently Working On"**: If not "None", notify the user that a previous task is still in progress and ask whether to continue it or start a new one.

3. **Select task from "Next Up"**:
   - 2 or more items → use `AskUserQuestion` to let the user choose which task to work on.
   - 1 item → start that task directly.
   - No items → notify the user there are no tasks and stop.

4. **Enter plan mode**: Call EnterPlanMode to switch to plan mode.

5. **Draft implementation plan**: Write an implementation plan for the selected task and get user approval via ExitPlanMode. Note: the plan mode file in `.claude/plans/` is a temporary working artifact — it is NOT the project record.

6. **Create the record file** (this is a separate action from step 5 — do not skip): After ExitPlanMode, determine the next record number by scanning existing files in `tasks/records/` (e.g., if `019-*.md` is the highest, the next is `020`). Use the Write tool to create `tasks/records/<NNN>-<slug>.md` with the approved plan content:

   ```markdown
   # NNN — Task Title

   ## Plan

   (approved plan content)
   ```

   **Verify**: confirm the file exists by reading it back before proceeding.

7. **Create a work branch**: Create a new branch from `main` for this task.
   - **Exception — .pen-only tasks**: If the task only modifies `.pen` files (Design/Sync tasks), skip branch creation and work directly on `main`.

8. Update "Currently Working On" in `tasks/progress.md` to the selected task.
