---
model: sonnet
effort: low
---

Create a git commit. Follow the commit message convention in CLAUDE.md.

1. Run `git status` and `git diff --staged` to understand the current changes.
2. If there are unstaged changes, ask the user which files to stage.
3. Write a commit message following CLAUDE.md's "Commit Messages" section.
4. If CLAUDE.md has a checklist item related to the committed work, update it to `[x]`.
5. Create the commit and verify with `git log --oneline -1`.
