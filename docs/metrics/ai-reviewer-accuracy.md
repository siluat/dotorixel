# AI Reviewer Accuracy

Tracks accept/reject ratios per AI reviewer bot on PR review comments.

## Running Totals

| Reviewer | Total | Accept | Reject | Accept % |
|----------|-------|--------|--------|----------|
| greptile-apps[bot] | 4 | 3 | 1 | 75% |
| cubic-dev-ai[bot] | 3 | 1 | 2 | 33% |
| coderabbitai[bot] | 3 | 1 | 2 | 33% |

## Log

| PR | Reviewer | Verdict | Summary |
|----|----------|---------|---------|
| #131 | greptile-apps[bot] | Accept | Scoped CSS custom property for repeated #8a5d20 |
| #131 | cubic-dev-ai[bot] | Reject | Suggested `on:click` — Svelte 4 syntax, project uses Svelte 5 |
| #131 | cubic-dev-ai[bot] | Reject | Suggested `on:keydown` — same Svelte 4/5 confusion |
| #131 | coderabbitai[bot] | Reject | Claimed status:done conflicts with TopControlsRight — component not rendered |
| #131 | coderabbitai[bot] | Accept | Trim before stripKnownExtension — real trailing-space bug |
| #132 | greptile-apps[bot] | Accept | Form state resets visibly during close animation |
| #132 | greptile-apps[bot] | Reject | Global class names collision risk — names are specific enough |
| #132 | greptile-apps[bot] | Accept | Unused handleExport function — dead code |
| #132 | cubic-dev-ai[bot] | Accept | Form reset timing during close animation (duplicate of greptile) |
| #132 | coderabbitai[bot] | Reject | vaul-svelte Svelte 5 incompatibility — works correctly, tests pass |
