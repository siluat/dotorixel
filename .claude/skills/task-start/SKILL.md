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

5. **Draft implementation plan**: Write an implementation plan for the selected task and get user approval via ExitPlanMode.

6. Update "Currently Working On" in `tasks/progress.md` to the selected task.
