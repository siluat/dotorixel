# DOTORIXEL

A pixel art editor.

## Project Stage

Past MVP — the core drawing experience (four tool categories, history, session persistence, i18n, multi-tab workspace) is functional and validated. Current focus is **robustness and clarity on that foundation**: deepening shallow modules, tightening contracts between them, expanding regression-defense tests, and incrementally building features.

This means architectural refactors are justified on their own merit, not only when piggybacking on feature work. "Premature abstraction" is still avoided — build what's needed now and leave seams for future extension, rather than pre-building infrastructure for hypothetical needs.

## Future Directions

DOTORIXEL's long-term direction is not yet fixed. The possibilities below are being **considered** as paths the project may evolve toward — they are not committed plans. They exist here so that architectural decisions can keep doors open rather than inadvertently closing them.

- **Learning aid for pixel art beginners**: An interactive learning environment for pixel art drawing fundamentals, evolving the editor into a tool for newcomers.
- **Indie game dev tool**: Efficiency-focused workflow for solo and small-team game developers.
  - Integration with AI and established game dev tools
  - Solving real pain points in game asset production
- **Casual hobby tool**: Coloring-book-style experiences and similar low-commitment play patterns.
  - iPad + Apple Pencil ergonomics as a priority

Several investments serve every direction and should be treated as high-priority regardless: reliable canvas drawing, solid color management, robust history, durable file persistence, and cross-platform feature parity. Other investments serve multiple directions at once — for example, palette management (all three), iPad + Apple Pencil support (casual + learning), and solid export/file formats (game dev + casual portfolio sharing) — and should be preferred over single-direction investments when cost is proportional.

When a decision has long-term architectural consequences — extension points, data schema shape, platform-specific feature placement — prefer options that keep multiple of these directions viable over committing early to one.

## Tech Stack

### Shared Core (`crates/core/`)

| Concern | Technology | Notes |
|---|---|---|
| Language | Rust | Placement follows Core Placement criteria |
| Build | Cargo | Workspace: `crates/core`, `wasm`, `apple` binding crates |
| Testing | `cargo test` | Inline unit tests across core modules |

### Web Shell (`src/`)

| Concern | Technology | Notes |
|---|---|---|
| UI | TypeScript + Svelte 5 | SvelteKit (adapter-static) |
| Rendering | Canvas2D | WebGL2 later when rendering performance demands it |
| Rust Bindings | wasm-bindgen | Built via `wasm-pack` from `wasm/` crate |
| Build | Vite | |
| Package Manager | bun | Always `bun run <script>`, never bare `bun <script>` |
| Unit & Component Testing | Vitest + happy-dom | `@testing-library/svelte` for components |
| E2E Testing | Playwright | `e2e/` directory |
| Component Preview | Storybook 10 | `@storybook/sveltekit`, Svelte CSF v5 |
| i18n | Paraglide.js | Compile-time, URL path routing (`/en/`, `/ko/`, `/ja/`) |
| Deployment | Vercel | SPA |

### Apple Shell (`apple/Dotorixel/`)

| Concern | Technology | Notes |
|---|---|---|
| UI | SwiftUI | macOS + iPadOS |
| Rendering | Metal | |
| Rust Bindings | UniFFI | `apple/` crate → `apple/generated/*.swift` |
| Build | Xcode | Project generated via XcodeGen |
| Testing | XCTest | `apple/DotorixelTests/` |

## Task Workflow

Implementation tasks are managed through files in the `tasks/` directory.

| File / Directory | Purpose |
|------|---------|
| [tasks/todo.md](tasks/todo.md) | Full task list (items removed on completion) |
| [tasks/progress.md](tasks/progress.md) | Currently working on / last completed / next up |
| [tasks/done.md](tasks/done.md) | Completion log |

### Starting a Task

Run the `/task-start` skill.

1. Read `tasks/progress.md` to understand the current state.
2. If there are 2+ items in "Next Up", ask the user which task to work on.
3. Classify the item and route to the appropriate skill (write-a-prd / prd-to-issues / tdd).

### Completing a Task

When a task item is completed, notify the user and suggest using the `/task-done` skill. Running `/task-done` performs the following steps, then creates a git commit.

1. **Update issue file**: Append results, key decisions, and notes to the task's issue file in `issues/`.
2. **Update done.md**: Add a row to the completion log.
3. **Update todo.md**: Remove the completed item from `tasks/todo.md`.
4. **Update progress.md**: Set current to "None", update last completed, refresh next up.
5. **Git commit**: Include implementation code and task updates in a single commit.

### Branch Rule

- Task work is always done on a work branch, never directly on `main`.
- Before writing any implementation code, verify the current branch is not `main`. If it is, create and switch to a work branch first.
- **Exception — .pen-only tasks**: Tasks that only modify `.pen` files (Design/Sync tasks) do not require a work branch or PR. Commit directly to `main`.

### Principles

- Work on one task item at a time. Never work on two or more items simultaneously.

## Development Guide

### Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/) format.

```text
<type>: <subject>

<optional body>
```

- **type**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `design`
  - Use `design` for commits that only change design spec files (`.pen`). When a commit mixes `.pen` changes with implementation, classify by the implementation change (e.g., `feat`).
- **subject**: lowercase, no period, imperative mood
- **body**: only when additional context is needed
- scope: introduce when the project grows enough to need it
- **PR title**: follows the same Conventional Commits format — squash merge makes it the final commit message on `main`

### Markdown

- **Fenced code blocks must have a language specifier.** Use ` ```text ` for plain text, diagrams, or sequences. The pre-commit markdownlint hook enforces this (MD040).

### Code Style

- **Declarative over imperative, when it clarifies.** Prefer data descriptions and transformations over step-by-step mutations when it makes the code easier to understand. When imperative logic is more direct (e.g., canvas rendering, sequential I/O), use it without apology.
- **Readable code over clever code.** If a function needs an inline comment to explain *what* it does, rename it. Reserve inline comments for *why* — non-obvious constraints, trade-offs, or domain context. Doc comments (`///` in Rust, `/** */` in TS) are different: they describe the public API contract (*what* the function does, its parameters, return value, and error conditions) and should be written for consumers who haven't read the implementation.
- **Make values self-documenting.** When a value requires domain knowledge to understand, choose the right level of clarification: name the value (`const isMiddleClick = event.button === 1`, `--press-offset: calc(...)`) when it appears in one place, define a shared constant or token when the same value appears in multiple places, or eliminate the magic value through types (`null` instead of `-1` as a sentinel) when the type system can enforce the meaning. For CSS, prefer component-scoped custom properties over comments when a value is derived from design tokens (e.g., `--depth: calc((var(--border-width) + var(--border-width-thick)) / 2)`). Promote to a global token only when reuse across components is confirmed.
- **Right paradigm for the situation.** Use pure functions for stateless data transformations (coordinate math, color conversion). Use objects with encapsulation when identity and lifecycle matter (history manager, tool state). Don't force one paradigm everywhere.

### Naming

- **Names reveal intent.** A variable named `offset` is ambiguous; `panOffset` or `gridOffset` is clear. If the name needs a comment to disambiguate, the name is wrong.
- **Booleans read as questions.** `isVisible`, `hasSelection`, `canUndo` — not `visible`, `selection`, `undo`. Exception: component props may follow framework conventions (e.g., `visible` as a prop is fine).
- **Functions read as actions or answers.** `applyTool()`, `exportAsPng()` for actions. `getCanvasCoords()`, `isInsideBounds()` for queries.
- **Consistent domain vocabulary.** Use the same term for the same concept everywhere. If "canvas" means the pixel data, don't call it "image" or "bitmap" elsewhere. Document the domain glossary if it grows.

### Core Placement

When deciding whether to implement logic in the Rust core (shared via WASM + UniFFI) or natively per shell, evaluate these criteria:

- **Cross-platform need.** Is this logic used by multiple shells (web, Apple native)? If only one shell uses it, implement in that shell's native language.
- **Complexity and bug surface.** Complex algorithms with subtle edge cases (flood fill, undo/redo state machine, pixel manipulation) benefit most from a single authoritative implementation. Simple arithmetic with clear formulas carries low duplication risk.
- **Change frequency.** Logic that changes often multiplies synchronization cost across implementations. Stable logic that rarely changes has low synchronization cost regardless of placement.
- **Binding friction.** FFI boundaries (WASM bridge, UniFFI wrapping) add build complexity, type synchronization overhead, and debugging friction. Weigh this cost against the duplication cost of separate implementations.
- **Platform divergence.** If platforms may need different behavior in the future (e.g., touch-specific gestures, platform-specific UX conventions), a shared core becomes a constraint rather than an asset.

**Rule of thumb:** Rust core earns its keep when multiple shells share the same complex, frequently-changing logic. When the logic is simple, stable, and the binding overhead is disproportionate, native implementation is acceptable even if the logic is shared.

### Architecture

- **Depend on interfaces, not implementations.** Modules (rendering, state management, tool system) should interact through types and contracts, not concrete implementations. This keeps them independently replaceable.
- **High cohesion, low coupling.** Group code by what changes together. A tool's logic, its state, and its cursor behavior belong together — not scattered across "utils/", "types/", and "state/" directories.
- **Right-sized modules.** Single responsibility is valuable, but a module split so finely that understanding one feature requires jumping across 8 files is worse than a slightly larger, self-contained module. Optimize for navigability: a reader should understand a feature by looking at one place.
- **Core logic is self-contained.** Coordinate transforms, pixel manipulation, tool algorithms, and undo/redo must have no framework dependencies (DOM, Svelte) and no hidden side effects (global state, I/O). Stateless transformations should be pure functions; stateful operations may mutate explicitly passed data structures. This is a structural rule — it enables testability, portability across runtimes, and future migration paths.

### Error Handling

- **Fail at the boundary, trust the core.** Validate inputs where they enter the system (user input, file I/O, external APIs). Inside core logic, trust that preconditions are met — don't litter internal functions with redundant guards.
- **Errors should be actionable.** An error message should tell the developer (or user) what went wrong and what to do about it. "Invalid canvas size" is useless; "Canvas size must be between 1 and 256 pixels" is actionable.
- **Use the type system to prevent errors.** Prefer types that make illegal states unrepresentable over runtime validation. If a tool can only be one of five kinds, use a union type, not a string.

### Security

- **Least privilege by default.** Start with the most restrictive configuration and expand permissions only when a concrete need arises. Never pre-authorize "just in case." This applies to CSP directives, file system access, and any other permission boundary.
- **Verify each expansion.** When broadening a security policy, confirm the change is necessary by reproducing the specific failure it resolves. Document *why* the permission was added (e.g., as a code comment or commit message).

### Maintaining CLAUDE.md

- **Integrate before creating.** When adding a rule, first check if existing content already touches the topic. Prefer strengthening an existing table cell, bullet, or section over adding a new heading. Create a new section only when the rule is standalone and integration would be awkward.

