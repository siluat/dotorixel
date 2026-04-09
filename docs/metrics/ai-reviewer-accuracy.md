# AI Reviewer Accuracy

Tracks accept/reject ratios per AI reviewer bot on PR review comments.

## Running Totals

| Reviewer | Total | Accept | Reject | Miss | Accept % | Recall |
|----------|-------|--------|--------|------|----------|--------|
| greptile-apps[bot] | 6 | 4 | 2 | 6 | 67% | 40% |
| cubic-dev-ai[bot] | 9 | 6 | 3 | 2 | 67% | 75% |
| coderabbitai[bot] | 11 | 6 | 5 | 2 | 55% | 75% |

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
| #134 | coderabbitai[bot] | Reject | "constrain tests" wording in RFC — function-name-derived modifier, clear in context |
| #134 | coderabbitai[bot] | Accept | isValidToolType uses `in` operator accepting prototype keys — regression from Set.has() |
| #134 | cubic-dev-ai[bot] | Accept | isValidToolType uses `in` operator (duplicate of coderabbit finding) |
| #134 | greptile-apps[bot] | Miss | Did not flag isValidToolType prototype key regression |
| #135 | coderabbitai[bot] | Reject | Rename `saved` to `isSaved` (persistence.ts) — past participle is idiomatic |
| #135 | coderabbitai[bot] | Reject | Rename `saved` to `isSaved` (types.ts) — same finding |
| #135 | coderabbitai[bot] | Accept | Migration test asserts via normalized read, not raw DB |
| #135 | coderabbitai[bot] | Accept | Await deleteDatabase before reopening in test |
| #135 | coderabbitai[bot] | Accept | Capture documentId before async flush to prevent stale index |
| #135 | cubic-dev-ai[bot] | Accept | Capture documentId before async flush (duplicate of coderabbit) |
| #135 | cubic-dev-ai[bot] | Accept | Migration test asserts via normalized read (duplicate of coderabbit) |
| #135 | cubic-dev-ai[bot] | Miss | Did not flag await deleteDatabase race condition |
| #135 | greptile-apps[bot] | Reject | dispose/flush race in onMount cleanup — pre-existing issue, out of scope |
| #135 | greptile-apps[bot] | Miss | Did not flag migration test raw DB assertion |
| #135 | greptile-apps[bot] | Miss | Did not flag await deleteDatabase race condition |
| #135 | greptile-apps[bot] | Miss | Did not flag stale index after async flush |
| #135 | cubic-dev-ai[bot] | Reject | Claimed greptile running totals mismatch — totals are correct |
| #136 | greptile-apps[bot] | Accept | Enter on Delete/Cancel triggers concurrent save race |
| #136 | cubic-dev-ai[bot] | Accept | Stale saveDialogTabIndex after closeTab during await |
| #136 | cubic-dev-ai[bot] | Accept | Enter-to-save not restricted to input (duplicate of greptile) |
| #136 | greptile-apps[bot] | Miss | Did not flag stale saveDialogTabIndex after closeTab |
| #136 | coderabbitai[bot] | Miss | Did not flag Enter-key concurrent save race |
| #136 | coderabbitai[bot] | Miss | Did not flag stale saveDialogTabIndex after closeTab |
| #136 | coderabbitai[bot] | Accept | Clear saveDialogTabIndex before closeTab in save path (consistency with delete) |
| #136 | greptile-apps[bot] | Miss | Did not flag stale index in save path |
| #136 | cubic-dev-ai[bot] | Miss | Did not flag stale index in save path |
