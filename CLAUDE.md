# DOTORIXEL

A 2D pixel art editor. Positioned as a learning-first, cross-platform tool.

## Tech Stack

| Component | Technology | Notes |
|---|---|---|
| UI | TypeScript + Svelte | SvelteKit (adapter-static) |
| Canvas Rendering | Canvas2D | MVP scope. WebGL2 later |
| Core Logic | TypeScript | JS-first for MVP. Migrate to Rust when performance demands it |
| Rust/WASM | wasm-pack | Build pipeline verified. Production use when performance demands it |
| Desktop | Tauri v2 | Same codebase as web |
| Package Manager | bun | Also used for script execution |
| Build | Vite + wasm-pack | |
| Web Deployment | Vercel | SPA via adapter-static |
| Testing | Vitest | Unified test runner — pure functions now, component tests later |
| Component Preview | Storybook 10 | `@storybook/sveltekit`, Svelte CSF v5 |

## Project Structure

MVP starts with a standard Tauri structure + a single WASM crate. No Cargo workspace yet — introduce it when Rust code sharing between WASM and Tauri backend is actually needed.

```text
dotorixel/
├── .storybook/         # Storybook config (main.ts, preview.ts)
├── wasm/               # Rust → WASM (single crate, wasm-pack)
├── src/                # Svelte frontend (shared by web & Tauri)
├── src-tauri/          # Tauri v2 config & Rust backend (own Cargo.toml)
├── package.json
├── svelte.config.js
└── vite.config.ts
```

When Rust core logic grows and needs to be shared between WASM and Tauri backend, migrate to Cargo workspace (`crates/core/`, `crates/backend/`). See [Tauri advanced structure guide](https://tauri.by.simon.hyll.nu/samples/advanced/) for reference.

## License

AGPL-3.0-or-later. Dual licensing and proprietary premium features are available as the copyright holder.

## Versioning

SemVer. Git tags and GitHub Releases start at v0.1.0. CHANGELOG.md follows [Keep a Changelog](https://keepachangelog.com) format.

## Current Version: v0.1.0 — Canvas Foundation

## Completed Milestones

### Build Pipeline Verification — Done
Verified Vite + SvelteKit + wasm-pack + Tauri v2 integration. `bun run dev` (web) and `bun run tauri dev` (desktop) both work.

## Roadmap

### v0.1.0: Canvas Foundation (MVP)

#### Core (complete)

Work order followed dependency chain: data structure → rendering → interaction → state management → export.

- [x] Vitest setup (test environment for pure functions)
- [x] Canvas creation (8x8, 16x16, 32x32) — pixel data structure + creation logic
- [x] Pixel grid display — Canvas2D rendering
- [x] Pencil tool (1px), eraser — first interaction, validates coordinate transform
- [x] Single color picker
- [x] Zoom in/out + panning — viewport transform, testable with drawing
- [x] Undo/Redo (snapshot-based) — requires state-changing operations to exist
- [x] PNG export

#### UI

Design reference: `~/Projects/dotorixel-ui-concept` (v0 prototype, React + Tailwind). Implement in Svelte + vanilla CSS.

- [x] Storybook setup — component preview environment for UI development
- [ ] Global styles & design tokens — CSS variables (light mode color tokens), pixel fonts (Press Start 2P, VT323), base reset
- [ ] Primitive components — PixelPanel (default/inset/raised), PixelButton (default/primary/secondary, sm/md/icon), ColorSwatch (sm/md, selected state)
- [ ] Toolbar component — lucide-svelte setup, tool selection, undo/redo, zoom, grid toggle, clear, export
- [ ] ColorPalette component — 36-color palette, current color preview, custom color input, recent colors
- [ ] CanvasSettings component — size presets (8/16/32/64), custom W/H input, resize
- [ ] StatusBar component — canvas size, zoom %, current tool display
- [ ] Layout integration — 3-column responsive layout (+page.svelte refactoring)

#### Release

- [ ] Create CHANGELOG.md (Keep a Changelog format)
- [ ] Set up CI (GitHub Actions: `tauri build` + Vitest + `tauri-driver` E2E)
- [ ] Git tag v0.1.0
- [ ] GitHub Release

### v0.2.0: Basic Tool Expansion

- [ ] Decide project file format (prerequisite — must be decided before v0.2.0 work begins)
- [ ] Line tool (Bresenham), rectangle/circle, flood fill, eyedropper
- [ ] Grid visibility toggle

### v0.3.0: Color System

- [ ] HSV color picker, foreground/background color swap, preset palettes

### Future triggers (not tied to a specific version)

- [ ] First external contributor → set up CLA
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

- **Declarative over imperative, when it clarifies.** Prefer data descriptions and transformations over step-by-step mutations when it makes the code easier to understand. When imperative logic is more direct (e.g., canvas rendering, sequential I/O), use it without apology.
- **Readable code over clever code.** If a function needs a comment to explain *what* it does, rename it. Reserve comments for *why* — non-obvious constraints, trade-offs, or domain context.
- **Make conditions self-documenting.** When a condition requires domain knowledge or API familiarity to understand (e.g., `event.button === 1`, `value === -1`), choose the right level of clarification: name the condition (`const isMiddleClick = event.button === 1`) when it appears in one place, define a shared constant when the same magic value appears in multiple places, or eliminate the magic value through types (`null` instead of `-1` as a sentinel) when the type system can enforce the meaning.
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

### Stories

- **Co-locate with the component.** Story files live next to their component: `Component.stories.svelte` beside `Component.svelte`. This follows the "group code by what changes together" architecture principle.
- **Svelte CSF v5 format.** Use `defineMeta` in `<script module>` and the destructured `Story` component. No CSF3 (JS object) format.
- **Title reflects directory structure.** e.g., `Canvas/PixelCanvasView`, `UI/PixelButton`. Hierarchy maps to `src/lib/` subdirectories.
- **Reuse core functions for story data.** Prefer `createCanvas()`, `createCanvasWithColor()` etc. over manually constructing test data. Stories double as living documentation of how core APIs are used.

### Styling

- **Vanilla CSS only.** No CSS frameworks (Tailwind, UnoCSS, etc.). Component styles use Svelte `<style>` scoped blocks.
- **Design tokens as CSS custom properties.** Colors, spacing, fonts defined in a global CSS file and consumed via `var(--token-name)`. Global styles are imported in `.storybook/preview.ts` for Storybook and in the app layout for production.
- **Component styles are scoped by default.** Use Svelte's built-in `<style>` scoping. Only extract to a shared CSS file when the same styles are genuinely reused across multiple components.

### Testing

- **Tests are specifications.** Each test should read as a behavioral description of its subject. A reader unfamiliar with the implementation should understand what the module does just by reading its tests.
- **Test behaviors, not implementation.** Assert on outcomes, not internal steps. If refactoring the internals breaks a test without changing behavior, the test was too tightly coupled.
- **Prioritize regression defense.** Focus test coverage on code paths where bugs would be hard to catch visually — edge cases in coordinate math, boundary conditions in flood fill, undo/redo state consistency.
- **Don't test the framework.** Don't verify that the UI framework's reactivity or rendering works correctly — that's the framework's job. Do test your own logic that *feeds into* the framework: state derivations, event handlers, computed values.
- **Guard the dev/prod gap.** Vite dev server (`http://localhost`) and Tauri production build (`tauri://localhost`) have different runtime behaviors — CSP enforcement, asset protocol handling, and WASM loading can all diverge. Unit tests and dev-mode verification alone cannot catch these. CI must include `tauri build` and `tauri-driver` E2E tests against the production artifact to prevent regressions that only surface in the packaged app.

