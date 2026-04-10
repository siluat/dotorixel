---
globs: **/*.test.ts, **/*.svelte.test.ts, e2e/**/*.ts
---

# Testing Conventions

Rules for writing and maintaining tests in this project.

- **Tests are specifications.** Each test should read as a behavioral description of its subject. A reader unfamiliar with the implementation should understand what the module does just by reading its tests.
- **Test behaviors, not implementation.** Assert on outcomes, not internal steps. If refactoring the internals breaks a test without changing behavior, the test was too tightly coupled.
- **Prioritize regression defense.** Focus test coverage on code paths where bugs would be hard to catch visually — edge cases in coordinate math, boundary conditions in flood fill, undo/redo state consistency.
- **Don't test the framework.** Don't verify that the UI framework's reactivity or rendering works correctly — that's the framework's job. Do test your own logic that *feeds into* the framework: state derivations, event handlers, computed values.
- **Guard the dev/prod gap.** Dev server and production build can have different runtime behaviors — CSP enforcement and WASM loading can diverge. Unit tests and dev-mode verification alone cannot catch these. CI should verify production builds to prevent regressions that only surface in the deployed app.
