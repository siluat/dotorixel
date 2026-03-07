# DOTORIXEL

A 2D pixel art editor. Positioned as a learning-first, cross-platform tool.

## Tech Stack

| Component | Technology | Notes |
|---|---|---|
| UI | TypeScript + Svelte | SvelteKit (adapter-static) |
| Canvas Rendering | Canvas2D | MVP scope. WebGL2 later |
| Core Logic | TypeScript | JS-first for MVP. Migrate to Rust when performance demands it |
| Rust/WASM | wasm-pack | Phase 0: build pipeline verification only |
| Desktop | Tauri v2 | Same codebase as web |
| Package Manager | bun | Also used for script execution |
| Build | Vite + wasm-pack | |
| Web Deployment | Vercel | SPA via adapter-static |
| Testing | Vitest | Unified test runner — pure functions now, component tests later |

## Project Structure

MVP starts with a standard Tauri structure + a single WASM crate. No Cargo workspace yet — introduce it when Rust code sharing between WASM and Tauri backend is actually needed.

```text
dotorixel/
├── wasm/               # Rust → WASM (single crate, wasm-pack)
├── src/                # Svelte frontend (shared by web & Tauri)
├── src-tauri/          # Tauri v2 config & Rust backend (own Cargo.toml)
├── package.json
├── svelte.config.js
└── vite.config.ts
```

When Rust core logic grows and needs to be shared between WASM and Tauri backend, migrate to Cargo workspace (`crates/core/`, `crates/backend/`). See [Tauri advanced structure guide](https://tauri.by.simon.hyll.nu/samples/advanced/) for reference.

## License

MIT

## Versioning

SemVer. Phase milestones map to minor versions: Phase 1 → v0.1.0, Phase 2 → v0.2.0. Git tags and GitHub Releases start at v0.1.0. CHANGELOG.md follows [Keep a Changelog](https://keepachangelog.com) format.

## Current Phase: Phase 1 — Canvas Foundation

## Completed Phases

### Phase 0: Build Pipeline Verification — Done
Verified Vite + SvelteKit + wasm-pack + Tauri v2 integration. `bun run dev` (web) and `bun run tauri dev` (desktop) both work.

## Roadmap

### Phase 1: Canvas Foundation (MVP v0.1)

Work order follows dependency chain: data structure → rendering → interaction → state management → export.

- [x] Vitest setup (test environment for pure functions)
- [x] Canvas creation (8x8, 16x16, 32x32) — pixel data structure + creation logic
- [x] Pixel grid display — Canvas2D rendering
- [x] Pencil tool (1px), eraser — first interaction, validates coordinate transform
- [x] Single color picker
- [ ] Zoom in/out + panning — viewport transform, testable with drawing
- [ ] Undo/Redo (snapshot-based) — requires state-changing operations to exist
- [ ] PNG export

### Phase 1 completion
- [ ] Git tag v0.1.0
- [ ] Create CHANGELOG.md (Keep a Changelog format)
- [ ] GitHub Release
- [ ] Set up CI (GitHub Actions: `tauri build` + Vitest + `tauri-driver` E2E)

### Phase 1 → 2 transition
- [ ] Decide project file format (must be decided before Phase 2 starts)
- [ ] Update this CLAUDE.md: move "Current Phase" to Phase 2

### Phase 2: Basic Tool Expansion
- [ ] Line tool (Bresenham), rectangle/circle, flood fill, eyedropper
- [ ] Grid visibility toggle

### Phase 3: Color System
- [ ] HSV color picker, foreground/background color swap, preset palettes

### Future triggers (not tied to a specific phase)
- [ ] Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates

## MVP Technical Decisions

| Area | Decision | Rationale |
|---|---|---|
| Rendering | Canvas2D | Sufficient for small canvases (~32x32) |
| State Management | Svelte store | Editor state managed via Svelte reactivity |
| Undo/Redo | Snapshot-based | 32x32 RGBA = 4KB/snapshot, negligible memory cost |
| Coordinate Transform | Screen→Canvas single transform | Based on zoom level and pan offset |

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

### Roadmap Tracking

When a commit or PR completes a roadmap item, update its checkbox in this file (`[ ]` → `[x]`) as part of the same change.

### Code Style

- **Declarative over imperative.** Express *what* should happen, not *how*. Prefer data descriptions and transformations over step-by-step mutations.
- **Readable code over clever code.** If a function needs a comment to explain *what* it does, rename it. Reserve comments for *why* — non-obvious constraints, trade-offs, or domain context.
- **Right paradigm for the situation.** Use pure functions for stateless data transformations (coordinate math, color conversion). Use objects with encapsulation when identity and lifecycle matter (history manager, tool state). Don't force one paradigm everywhere.

### Naming

- **Names reveal intent.** A variable named `offset` is ambiguous; `panOffset` or `gridOffset` is clear. If the name needs a comment to disambiguate, the name is wrong.
- **Booleans read as questions.** `isVisible`, `hasSelection`, `canUndo` — not `visible`, `selection`, `undo`. Exception: component props may follow framework conventions (e.g., `visible` as a prop is fine).
- **Functions read as actions or answers.** `applyTool()`, `exportAsPng()` for actions. `getCanvasCoords()`, `isInsideBounds()` for queries.
- **Consistent domain vocabulary.** Use the same term for the same concept everywhere. If "canvas" means the pixel data, don't call it "image" or "bitmap" elsewhere. Document the domain glossary if it grows.

### Architecture

- **Depend on interfaces, not implementations.** Modules (rendering, state management, tool system) should interact through types and contracts, not concrete implementations. This keeps them independently replaceable.
- **High cohesion, low coupling.** Group code by what changes together. A tool's logic, its state, and its cursor behavior belong together — not scattered across "utils/", "types/", and "state/" directories.
- **Right-sized modules.** Single responsibility is valuable, but a module split so finely that understanding one feature requires jumping across 8 files is worse than a slightly larger, self-contained module. Optimize for navigability: a reader should understand a feature by looking at one place.
- **Core logic is self-contained.** Coordinate transforms, pixel manipulation, tool algorithms, and undo/redo must have no framework dependencies (DOM, Svelte, Tauri APIs) and no hidden side effects (global state, I/O). Stateless transformations should be pure functions; stateful operations may mutate explicitly passed data structures. This is a structural rule — it enables testability, portability across runtimes, and future migration paths.

### Error Handling

- **Fail at the boundary, trust the core.** Validate inputs where they enter the system (user input, file I/O, external APIs). Inside core logic, trust that preconditions are met — don't litter internal functions with redundant guards.
- **Errors should be actionable.** An error message should tell the developer (or user) what went wrong and what to do about it. "Invalid canvas size" is useless; "Canvas size must be between 1 and 256 pixels" is actionable.
- **Use the type system to prevent errors.** Prefer types that make illegal states unrepresentable over runtime validation. If a tool can only be one of five kinds, use a union type, not a string.

### Security

- **Least privilege by default.** Start with the most restrictive configuration and expand permissions only when a concrete need arises. Never pre-authorize "just in case." This applies to CSP directives, Tauri capabilities, file system access, and any other permission boundary.
- **Verify each expansion.** When broadening a security policy, confirm the change is necessary by reproducing the specific failure it resolves. Document *why* the permission was added (e.g., as a code comment or commit message).

### Markdown

- **Fenced code blocks must have a language tag.** Use `typescript`, `rust`, `bash`, `text`, etc. Never leave a bare ` ``` `.

### Testing

- **Tests are specifications.** Each test should read as a behavioral description of its subject. A reader unfamiliar with the implementation should understand what the module does just by reading its tests.
- **Test behaviors, not implementation.** Assert on outcomes, not internal steps. If refactoring the internals breaks a test without changing behavior, the test was too tightly coupled.
- **Prioritize regression defense.** Focus test coverage on code paths where bugs would be hard to catch visually — edge cases in coordinate math, boundary conditions in flood fill, undo/redo state consistency.
- **Don't test the framework.** Don't verify that the UI framework's reactivity or rendering works correctly — that's the framework's job. Do test your own logic that *feeds into* the framework: state derivations, event handlers, computed values.
- **Guard the dev/prod gap.** Vite dev server (`http://localhost`) and Tauri production build (`tauri://localhost`) have different runtime behaviors — CSP enforcement, asset protocol handling, and WASM loading can all diverge. Unit tests and dev-mode verification alone cannot catch these. CI must include `tauri build` and `tauri-driver` E2E tests against the production artifact to prevent regressions that only surface in the packaged app.

