# DOTORIXEL

A 2D pixel art editor. Positioned as a learning-first, cross-platform tool.

## Tech Stack

| Component | Technology | Notes |
|---|---|---|
| UI | TypeScript + Svelte | SvelteKit (adapter-static) |
| Canvas Rendering | Canvas2D | MVP scope. WebGL2 later |
| Core Logic | TypeScript | JS-first for MVP. Migrate to Rust when performance demands it |
| Rust/WASM | wasm-pack | Build pipeline verified. Production use when performance demands it |
| Package Manager | bun | Always `bun run <script>`, never bare `bun <script>` |
| Build | Vite + wasm-pack | |
| Web Deployment | Vercel | SPA via adapter-static |
| Testing | Vitest | Unified test runner — pure functions now, component tests later |
| Component Preview | Storybook 10 | `@storybook/sveltekit`, Svelte CSF v5 |

## License

AGPL-3.0-or-later. Dual licensing and proprietary premium features are available as the copyright holder.

## Versioning

SemVer. Git tags and GitHub Releases start at v0.1.0. CHANGELOG.md follows [Keep a Changelog](https://keepachangelog.com) format.

## Current Version: v0.1.0 — Canvas Foundation

## MVP Technical Decisions

| Area | Decision | Rationale |
|---|---|---|
| Rendering (WebView) | Canvas2D | Sufficient for small canvases (~32x32) |
| Rendering (Native) | Metal | Shared across macOS and iPadOS |
| State Management | Svelte store (WebView), SwiftUI @Observable (Native) | Each shell uses its framework's reactivity |
| Undo/Redo | Snapshot-based (Rust core) | 32x32 RGBA = 4KB/snapshot, shared across shells |
| Coordinate Transform | Screen→Canvas single transform (Rust core) | Based on zoom level and pan offset, shared across shells |
| Core Bindings | wasm-bindgen (web), UniFFI (Apple native) | Single Rust core, platform-specific binding per shell |
| Apple Project | Single Xcode project, macOS + iPadOS targets | SwiftUI + Metal shared, platform-specific UI via `#if os()` |

## Task Workflow

Implementation tasks are managed through files in the `tasks/` directory.

| File / Directory | Purpose |
|------|---------|
| [tasks/todo.md](tasks/todo.md) | Full task list (items removed on completion) |
| [tasks/progress.md](tasks/progress.md) | Currently working on / last completed / next up |
| [tasks/done.md](tasks/done.md) | Completion index (table linking to record files) |
| [tasks/records/](tasks/records/) | One file per task — plan + completion record |

### Starting a Task

Run the `/task-start` skill.

1. Read `tasks/progress.md` to understand the current state.
2. If there are 2+ items in "Next Up", ask the user which task to work on.
3. Enter plan mode to draft an implementation plan and get user approval.
4. Save the approved plan to `tasks/records/<NNN>-<slug>.md`.
5. Update "Currently Working On" in `tasks/progress.md`.

### Completing a Task

When a task item is completed, notify the user and suggest using the `/task-done` skill. Running `/task-done` performs the following steps, then creates a git commit.

1. **Update record file**: Append results, key decisions, and notes to the task's record file in `tasks/records/`.
2. **Update done.md**: Add a row to the index table linking to the record file.
3. **Update todo.md**: Remove the completed item from `tasks/todo.md`.
4. **Update progress.md**: Set current to "None", update last completed, refresh next up.
5. **Git commit**: Include implementation code and task records in a single commit.

### Branch Rule

- Task work is always done on a work branch, never directly on `main`.
- Before writing any implementation code, verify the current branch is not `main`. If it is, create and switch to a work branch first.

### Principles

- Work on one task item at a time. Never work on two or more items simultaneously.

## Development Guide

### Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/) format.

```text
<type>: <subject>

<optional body>
```

- **type**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`
- **subject**: lowercase, no period, imperative mood
- **body**: only when additional context is needed
- scope: introduce when the project grows enough to need it
- **PR title**: follows the same Conventional Commits format — squash merge makes it the final commit message on `main`

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

### Rust Migration

When porting TS logic to Rust, write idiomatic Rust — not a line-by-line transliteration of TypeScript. Study how established Rust crates (`image`, `tiny-skia`, `bevy`) solve the same problem and follow community conventions.

- **Associated constants over module-level constants.** `Color::TRANSPARENT`, not `color::TRANSPARENT`. Groups related values under the type for discoverability.
- **Provide `const fn new()` constructors when they improve readability.** For types with many fields (3+), a constructor reduces boilerplate: `Color::new(255, 0, 0, 255)` vs a 4-line struct literal. For simple 2-field structs with `pub` fields, the struct literal (`CanvasCoords { x: 3, y: 7 }`) is often clearer because field names are visible at the call site — provide `new()` only when there's a concrete convenience benefit (e.g., const context).
- **Derive traits when their semantics are unambiguous for the type.** For value types with integer fields, derive `Hash` alongside `Eq`. Only derive `Ord`/`PartialOrd` when the auto-derived field-order comparison is the semantically correct ordering — if field declaration order could mislead (e.g., `CanvasCoords { x, y }` derives column-major order, but the pixel buffer is row-major), omit it until a use site confirms the desired semantics.
- **Use Rust's type system beyond what TS offered.** Enums with data for tool types, newtypes for domain values (`CanvasCoord` vs raw `i32`), `Option`/`Result` instead of sentinel values. If TS used a string union, use a Rust enum.
- **`impl` blocks for behavior.** Methods belong on the type (`color.to_hex()`), not as free functions (`color_to_hex(color)`), unless the function doesn't have a natural receiver. When adding a method would introduce a reverse dependency on the receiver's module (e.g., `PixelCanvas::encode_png()` would couple canvas to the `png` crate), use an extension trait in the dependent module to preserve method syntax without the coupling (`impl PngExport for PixelCanvas` in the export module). If the trait adds no value (single method, no polymorphism), a free function is also acceptable.
- **Error types implement `std::error::Error`.** All error enums must implement `Display` and `std::error::Error`. This enables interop with `?` propagation, `Box<dyn Error>`, and error-handling crates.
- **Doc comments follow std conventions: write when it adds signal, skip when the signature speaks.** Simple getters (`width()`, `pixels()`), trivial predicates (`is_empty()`), and obvious constructors (`new()` with self-evident fields) need no doc comment. Write doc comments when the method has non-obvious side effects (eviction, stack clearing), when the behavior goes beyond what the name and signature convey (e.g., `push_snapshot` clears the redo stack), or when panic/error conditions exist. Don't restate what `Option` or `Result` return types already express.

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

### Stories

- **Co-locate with the component.** Story files live next to their component: `Component.stories.svelte` beside `Component.svelte`. This follows the "group code by what changes together" architecture principle.
- **Svelte CSF v5 format.** Use `defineMeta` in `<script module>` and the destructured `Story` component. No CSF3 (JS object) format.
- **Let autotitle handle hierarchy.** Omit the `title` property — Storybook generates sidebar hierarchy from the file path automatically. Only set `title` when the desired hierarchy differs from the physical location.
- **Reuse pure data factory functions for story data.** Prefer `createCanvas()`, `createCanvasWithColor()` etc. over manually constructing test data. Only use deterministic, side-effect-free functions — mock anything that involves I/O, global state, or randomness.

### Styling

- **Vanilla CSS only (web).** No CSS frameworks (Tailwind, UnoCSS, etc.). Component styles use Svelte `<style>` scoped blocks.
- **Design tokens as CSS custom properties (web).** Colors, spacing, fonts defined in a global CSS file and consumed via `var(--token-name)`. Global styles are imported in `.storybook/preview.ts` for Storybook and in the app layout for production.
- **Component styles are scoped by default (web).** Use Svelte's built-in `<style>` scoping. Only extract to a shared CSS file when the same styles are genuinely reused across multiple components.
- **Shared visual identity across shells.** Both web and Apple native shells should feel like the same app. Share design tokens (color palette, spacing scale, sizing) and the Pebble UI theme (warm earth tones, rounded floating panels, acorn brown accent). On Apple native, define shared color tokens as static `SwiftUI.Color` properties in a tokens enum, mirroring the web's CSS custom properties.
- **Visual parity across platforms.** The Pebble UI layout (full-screen canvas with floating overlay panels) translates naturally to SwiftUI. Match the web's panel positions, component structure, and visual styling. Use native controls where they provide equivalent or better functionality (e.g., SwiftUI `ColorPicker` instead of HTML color input).
- **Native-first responsive design.** Implement responsive layout on the Apple native shell first, then adapt the same layout transitions to web. SwiftUI's automatic size class handling (sidebar collapse, panel reorganization) serves as the design reference. Extract layout breakpoints and transition rules from the native implementation, then map them to CSS media/container queries on web.

### Testing

- **Tests are specifications.** Each test should read as a behavioral description of its subject. A reader unfamiliar with the implementation should understand what the module does just by reading its tests.
- **Test behaviors, not implementation.** Assert on outcomes, not internal steps. If refactoring the internals breaks a test without changing behavior, the test was too tightly coupled.
- **Prioritize regression defense.** Focus test coverage on code paths where bugs would be hard to catch visually — edge cases in coordinate math, boundary conditions in flood fill, undo/redo state consistency.
- **Don't test the framework.** Don't verify that the UI framework's reactivity or rendering works correctly — that's the framework's job. Do test your own logic that *feeds into* the framework: state derivations, event handlers, computed values.
- **Guard the dev/prod gap.** Dev server and production build can have different runtime behaviors — CSP enforcement and WASM loading can diverge. Unit tests and dev-mode verification alone cannot catch these. CI should verify production builds to prevent regressions that only surface in the deployed app.

### Maintaining CLAUDE.md

- **Integrate before creating.** When adding a rule, first check if existing content already touches the topic. Prefer strengthening an existing table cell, bullet, or section over adding a new heading. Create a new section only when the rule is standalone and integration would be awkward.

