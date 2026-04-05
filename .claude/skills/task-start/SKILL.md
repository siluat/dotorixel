---
description: Start a task. Read progress.md, select the next task, and transition to working state.
user_invocable: true
model: opus
effort: high
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

4. **Classify the selected item** by checking its entry in `tasks/todo.md`:
   - **Sub-issue**: The item links to an issue file (e.g., `[003 — ...](../issues/003-*.md)`). → Go to **Path C**.
   - **PRD exists, no sub-issues**: The item or its parent has a `[PRD]` link, but no indented sub-issue items exist below it yet. → Go to **Path B**.
   - **No PRD**: The item is plain text with no PRD link and no issue file link. → Go to **Path A**.

---

## Path A — No PRD

The item needs a PRD before implementation can begin.

Invoke the `/write-a-prd` skill for this item. Stop after the PRD is created.

## Path B — PRD exists, needs sub-issues

The item has a PRD but hasn't been broken into implementable sub-issues yet.

Invoke the `/prd-to-issues` skill for this item. Stop after issues are created.

## Path C — Sub-issue (implementation)

5. **Create a work branch**: Create a new branch from `main` for this task.
   - **Exception — .pen-only tasks**: If the task only modifies `.pen` files (Design/Sync tasks), skip branch creation and work directly on `main`.

6. Update "Currently Working On" in `tasks/progress.md` to the selected task.

7. **Begin TDD**: Invoke the `/tdd` skill to start implementation.
