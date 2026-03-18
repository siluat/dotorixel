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

### v0.1.0: Canvas Foundation

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
- [x] Global styles & design tokens — CSS variables (light mode color tokens), pixel font (Galmuri), base reset
- [x] Primitive components — PixelPanel (default/inset/raised), PixelButton (default/primary/secondary, sm/md/icon), ColorSwatch (sm/md, selected state)
- [x] Toolbar component — lucide-svelte setup, tool selection, undo/redo, zoom, grid toggle, clear, export
- [x] ColorPalette component — 36-color palette, current color preview, custom color input, recent colors
- [x] CanvasSettings component — size presets (8/16/32/64), custom W/H input, resize
- [x] StatusBar component — canvas size, zoom %, current tool display
- [x] Layout integration — 3-column responsive layout (+page.svelte refactoring)
- [x] Button style system — split PixelButton into BevelButton (3D border) and FlatButton (uniform border + shadow)
- [x] Toolbar button abstraction — decouple Toolbar from specific button component to allow button style swaps without internal changes
- [x] ColorSwatch border/shadow tinting — use color-relative border and shadow tones (matching the swatch color) as in the concept UI
- [x] Zoom/scroll input separation — trackpad pinch gesture for zoom, trackpad scroll for canvas pan, mouse wheel for zoom (match standard editor behavior)
- [x] Pan boundary clamping — prevent canvas from being panned entirely outside the visible panel area
- [x] Cross-platform testing — verify web (Chrome) and Tauri desktop/iOS simulator builds

#### Dual Shell PoC

Verify that a "Shared Rust Core + Platform-Native Shell" architecture works for this project. Not a product feature — a technical validation for the cross-platform learning goal.

Reference: [`docs/research/cross-platform-architecture-for-best-experience.en.md`](docs/research/cross-platform-architecture-for-best-experience.en.md)

**Migration Safety Net** — Existing TS unit tests (7 files in `src/lib/canvas/`) serve as the behavioral specification. During Rust migration, keep WASM API compatible with TS API so the same tests verify both implementations (import path change only). Browser-level E2E tests (Playwright) will be added minimally at the CI setup stage (Release).

- [x] TS unit test coverage for core logic (already in place)

**Rust Core Migration** — Migrate core logic from TS to Rust, one module at a time. Each step should keep both web and Tauri builds working. Run existing TS unit tests against WASM bindings after each migration step to verify no regressions.

- [x] Cargo workspace setup — `crates/core/` with `wasm/` and `src-tauri/` as consumers
- [x] Color type — Color struct, TRANSPARENT constant (from `src/lib/canvas/color.ts`)
- [x] Color utilities — hex conversion, palette helpers (replaces remaining `src/lib/canvas/color.ts`)
- [ ] Pixel buffer — RGBA data structure, canvas creation (replaces `src/lib/canvas/canvas.ts`)
- [ ] Coordinate transform — screen↔canvas math (replaces `src/lib/viewport.ts`)
- [ ] Tools — pencil, eraser (replaces `src/lib/tools.ts`)
- [ ] History — undo/redo snapshot logic (replaces `src/lib/history.ts`)
- [ ] WASM bindings — wasm-bindgen interface, Svelte integration verified
- [ ] PNG export — Rust-side encoding (replaces current Canvas2D `toDataURL` approach)

**Apple Native Shell** — SwiftUI + Metal app sharing the same Rust core via UniFFI. Targets macOS and iPadOS from a single Xcode project.

- [ ] UniFFI setup — generate Swift bindings from `crates/core/`, verify in Swift playground or test target
- [ ] Xcode project — Swift Package with macOS + iPadOS targets, Rust library linked
- [ ] Metal pixel grid renderer — minimal Metal pipeline rendering the pixel buffer
- [ ] Basic SwiftUI UI — tool selection, color picker, canvas view (Metal surface)
- [ ] Touch/Pencil input — Apple Pencil drawing on iPadOS, mouse drawing on macOS
- [ ] Zoom/pan — pinch gesture (iPadOS), scroll/trackpad (macOS), shared viewport transform from core
- [ ] Undo/redo — connected to core history module, SwiftUI toolbar integration

**Platform Comparison** — Record findings in `docs/comparison/` as each feature is implemented on both shells.

- [ ] Rendering performance — Canvas2D vs Metal FPS at various canvas sizes
- [ ] Input latency — event-to-pixel-update measurement on both shells
- [ ] Bundle size — Tauri `.app` vs native `.app`
- [ ] Implementation effort — per-feature LOC and time comparison
- [ ] Responsive layout — extract SwiftUI size class transitions, adapt to web CSS breakpoints

#### Web Deployment

Test-purpose deployment for accessing the app from any browser during development.

- [x] Vercel project setup — GitHub integration, auto-deploy on `main` push
- [x] Verify deployed build — WASM loading, all features working on `*.vercel.app`

#### Release

- [ ] Create CHANGELOG.md (Keep a Changelog format)
- [ ] Set up CI (GitHub Actions: `tauri build` + Vitest + minimal Playwright E2E + `tauri-driver`)
- [ ] Git tag v0.1.0
- [ ] GitHub Release

### v0.2.0: Basic Tool Expansion

- [ ] Decide project file format (prerequisite — must be decided before v0.2.0 work begins)
- [ ] Line tool (Bresenham), rectangle/circle, flood fill, eyedropper
- [ ] Grid visibility toggle
- [ ] Internationalization (i18n) — Korean/English support

### v0.3.0: Color System

- [ ] HSV color picker, foreground/background color swap, preset palettes

### Future triggers (not tied to a specific version)

- [ ] First external contributor → set up CLA
- [ ] Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- [ ] Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](docs/research/action-pattern-research.ko.md))

## MVP Technical Decisions

| Area | Decision | Rationale |
|---|---|---|
| Rendering (WebView) | Canvas2D | Sufficient for small canvases (~32x32) |
| Rendering (Native) | Metal | Shared across macOS and iPadOS |
| State Management | Svelte store (WebView), SwiftUI @Observable (Native) | Each shell uses its framework's reactivity |
| Undo/Redo | Snapshot-based (Rust core) | 32x32 RGBA = 4KB/snapshot, shared across shells |
| Coordinate Transform | Screen→Canvas single transform (Rust core) | Based on zoom level and pan offset, shared across shells |
| Core Bindings | wasm-bindgen (web), UniFFI (Apple native) | Single Rust core, two binding strategies |
| Apple Project | Single Xcode project, macOS + iPadOS targets | SwiftUI + Metal shared, platform-specific UI via `#if os()` |

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
- **`impl` blocks for behavior.** Methods belong on the type (`color.to_hex()`), not as free functions (`color_to_hex(color)`), unless the function doesn't have a natural receiver.
- **Error types implement `std::error::Error`.** All error enums must implement `Display` and `std::error::Error`. This enables interop with `?` propagation, `Box<dyn Error>`, and error-handling crates — essential for Tauri backend integration.

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
- **Let autotitle handle hierarchy.** Omit the `title` property — Storybook generates sidebar hierarchy from the file path automatically. Only set `title` when the desired hierarchy differs from the physical location.
- **Reuse pure data factory functions for story data.** Prefer `createCanvas()`, `createCanvasWithColor()` etc. over manually constructing test data. Only use deterministic, side-effect-free functions — mock anything that involves I/O, global state, or randomness.

### Styling

- **Vanilla CSS only (web).** No CSS frameworks (Tailwind, UnoCSS, etc.). Component styles use Svelte `<style>` scoped blocks.
- **Design tokens as CSS custom properties (web).** Colors, spacing, fonts defined in a global CSS file and consumed via `var(--token-name)`. Global styles are imported in `.storybook/preview.ts` for Storybook and in the app layout for production.
- **Component styles are scoped by default (web).** Use Svelte's built-in `<style>` scoping. Only extract to a shared CSS file when the same styles are genuinely reused across multiple components.
- **Shared visual identity across shells.** Both web and Apple native shells should feel like the same app. Share design tokens (color palette, spacing scale, font sizes) and the pixel art theme (Galmuri font, bevel/inset panel style). On Apple native, use SwiftUI Asset Catalogs for colors and bundle the Galmuri font as a custom font.
- **Platform-native UI patterns.** Do not replicate web UI pixel-for-pixel in SwiftUI. Use each platform's natural components and layout conventions (e.g., `NavigationSplitView` instead of CSS 3-column layout, native `ColorPicker` where appropriate). The theme ties the shells together; the interaction patterns should feel native to each platform.
- **Native-first responsive design.** Implement responsive layout on the Apple native shell first, then adapt the same layout transitions to web. SwiftUI's automatic size class handling (sidebar collapse, panel reorganization) serves as the design reference. Extract layout breakpoints and transition rules from the native implementation, then map them to CSS media/container queries on web.

### Testing

- **Tests are specifications.** Each test should read as a behavioral description of its subject. A reader unfamiliar with the implementation should understand what the module does just by reading its tests.
- **Test behaviors, not implementation.** Assert on outcomes, not internal steps. If refactoring the internals breaks a test without changing behavior, the test was too tightly coupled.
- **Prioritize regression defense.** Focus test coverage on code paths where bugs would be hard to catch visually — edge cases in coordinate math, boundary conditions in flood fill, undo/redo state consistency.
- **Don't test the framework.** Don't verify that the UI framework's reactivity or rendering works correctly — that's the framework's job. Do test your own logic that *feeds into* the framework: state derivations, event handlers, computed values.
- **Guard the dev/prod gap.** Vite dev server (`http://localhost`) and Tauri production build (`tauri://localhost`) have different runtime behaviors — CSP enforcement, asset protocol handling, and WASM loading can all diverge. Unit tests and dev-mode verification alone cannot catch these. CI must include `tauri build` and `tauri-driver` E2E tests against the production artifact to prevent regressions that only surface in the packaged app.

