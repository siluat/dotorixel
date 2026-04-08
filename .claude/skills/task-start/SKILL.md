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
   - **Design task**: The item has a "Design:" prefix or "(.pen)" marker. → Go to **Path D**.
   - **Sub-issue**: The item links to an issue file (e.g., `[003 — ...](../issues/003-*.md)`). → Go to **Path C**.
   - **PRD exists, no sub-issues**: The item or its parent has a `[PRD]` link, but no indented sub-issue items exist below it yet. → Go to **Path B**.
   - **No PRD**: The item is plain text with no PRD link and no issue file link. → Go to **Path A**.

---

## Path A — No PRD

The item needs a PRD before implementation can begin.

5. Invoke the `/write-a-prd` skill for this item.

6. After the PRD is created, update "Currently Working On" in `tasks/progress.md` to the PRD title with a link (e.g., `Export UI — format selector and filename input ([PRD](../issues/033-export-ui-web.md))`).

Stop after the PRD is created.

## Path B — PRD exists, needs sub-issues

The item has a PRD but hasn't been broken into implementable sub-issues yet.

5. Invoke the `/prd-to-issues` skill for this item.

6. Ensure "Currently Working On" in `tasks/progress.md` is set to the PRD title with a link. If already set, leave unchanged.

Stop after issues are created.

## Path C — Sub-issue (implementation)

5. **Create a work branch**: Create a new branch from `main` for this task.
   - **Exception — .pen-only tasks**: If the task only modifies `.pen` files (Design/Sync tasks), skip branch creation and work directly on `main`.

6. Update "Currently Working On" in `tasks/progress.md`:
   - If the task has a `parent` PRD (check issue frontmatter): set to the parent PRD title with a link (e.g., `Tab system — multi-image workflow ([PRD](../issues/002-tab-system.md))`). If already set to this PRD, leave unchanged.
   - Otherwise: set to the selected task title.

7. **Begin TDD**: Invoke the `/tdd` skill to start implementation.

## Path D — Design task

The item is a UI design task that produces `.pen` file(s).

5. Update "Currently Working On" in `tasks/progress.md` to the design task title.

6. **Begin UI design**: Invoke the `/ui-design` skill.
