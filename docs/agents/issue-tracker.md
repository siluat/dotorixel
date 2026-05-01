# Issue tracker: Local Markdown

Issues and PRDs for this repo live as local markdown files. GitHub Issues are not used.

## Directory layout

- `issues/NNN-slug.md` — individual issue file. `NNN` is a zero-padded 3-digit sequence (`001`, `002`, …); `slug` is a kebab-case one-line summary.
- `tasks/todo.md` — full task list (items removed on completion).
- `tasks/progress.md` — currently working on / last completed / next up.
- `tasks/done.md` — completion log.

## Issue file format

Each issue file starts with YAML front-matter.

```yaml
---
title: <issue title>
status: <triage label>   # one of the labels in docs/agents/triage-labels.md
created: YYYY-MM-DD
---
```

The body typically contains `## Problem Statement`, `## Solution`, and `## Commits` sections, but may be adjusted freely depending on the issue type.

## When a skill says "publish to the issue tracker"

Create a new markdown file under `issues/` with the next sequence number.

1. Find the largest existing number under `issues/` and assign the next one.
2. Write the front-matter using the template above.
3. Write the PRD or issue body.
4. If the work should enter the active workflow, also append an item to `tasks/todo.md`.

## When a skill says "fetch the relevant ticket"

The user will normally pass a file path or an issue number directly. Use the `Read` tool to load the file. If only a number is given, match the `issues/<NNN>-*.md` pattern.

## Comments / progress notes

Append a `## Notes` or `## Comments` section at the bottom of the issue file in chronological order. On task completion, the `/task-done` skill accumulates results and key decisions into the issue file.
