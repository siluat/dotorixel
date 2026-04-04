---
title: Remove unused legacy TS core modules
status: done
created: 2026-04-04
---

## Problem Statement

The `src/lib/canvas/legacy/` directory contains ~863 lines of TypeScript source, tests, and documentation that were fully replaced by WASM (Rust) core modules on 2026-03-20. No module outside `legacy/` imports any of these files. The Vitest config and tsconfig both carry exclusion rules solely to suppress this dead code.

The dead code creates three kinds of friction:

- **Cognitive load**: Developers encountering the `canvas/` directory must trace imports to determine which modules are "real" vs legacy
- **False search hits**: Grepping for canvas concepts (e.g., `createCanvas`, `applyTool`, `undo`) returns matches in both active and dead code
- **Config noise**: `vitest.config.ts` and `tsconfig.json` each carry an `exclude` glob (`src/**/legacy/**`) that exists only to paper over the dead code

## Solution

Delete the entire `src/lib/canvas/legacy/` directory and clean up the two config files that reference it. No replacement code or documentation is needed — the WASM equivalents are already in place and fully tested.

## Commits

### Commit 1: Delete legacy TS core directory and clean up config exclusions

- Delete the `src/lib/canvas/legacy/` directory (all 9 files: 4 source, 4 test, 1 README)
- In `vitest.config.ts`: remove `exclude: ['src/**/legacy/**']` from the `test` block
- In `tsconfig.json`: remove `"src/**/legacy/**"` from the `exclude` array, keeping `"src/lib/wasm/setup.ts"`

This is a single atomic commit because the config exclusions exist only for the legacy directory — removing them separately would leave dangling rules between commits.

## Decision Document

- **No preservation of legacy content**: The TS→WASM replacement map in `legacy/README.md` does not need to be preserved in commit messages, ADRs, or elsewhere. Git history is sufficient for archaeology.
- **Config cleanup is in-scope**: Both `vitest.config.ts` and `tsconfig.json` exclusion rules are removed alongside the directory deletion.
- **Single commit**: The deletion and config cleanup are one logical change. Splitting them would leave the codebase in a technically-working but untidy state with dead config rules.

## Testing Decisions

- **No new tests needed**: The same logic is already covered by `src/lib/wasm/wasm-*.test.ts` and Rust unit tests in `crates/core/src/`.
- **4 test files deleted**: `canvas.test.ts`, `tool.test.ts`, `history.test.ts`, `viewport.test.ts` — all were already excluded from Vitest and never ran.
- **Verification**: A full `bun run test` pass after deletion confirms no hidden dependencies.

## Out of Scope

- Refactoring or abstracting the WASM layer (tracked separately as a deepening candidate)
- Archiving legacy code to a separate branch
- Writing migration documentation or ADRs about the TS→WASM transition
