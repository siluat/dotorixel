# Todo

## v0.1.0: Canvas Foundation

### Dual Shell PoC — Rust Core Migration

Migrate core logic from TS to Rust, one module at a time. Each step should keep both web and Tauri builds working. Run existing TS unit tests against WASM bindings after each migration step to verify no regressions.

Reference: [`docs/research/cross-platform-architecture-for-best-experience.en.md`](../docs/research/cross-platform-architecture-for-best-experience.en.md)

**Migration Safety Net** — Existing TS unit tests (7 files in `src/lib/canvas/`) serve as the behavioral specification. During Rust migration, keep WASM API compatible with TS API so the same tests verify both implementations (import path change only). Browser-level E2E tests (Playwright) will be added minimally at the CI setup stage (Release).

- Tools — pencil, eraser (replaces `src/lib/tools.ts`)
- History — undo/redo snapshot logic (replaces `src/lib/history.ts`)
- WASM bindings — wasm-bindgen interface, Svelte integration verified
- PNG export — Rust-side encoding (replaces current Canvas2D `toDataURL` approach)

### Dual Shell PoC — Apple Native Shell

SwiftUI + Metal app sharing the same Rust core via UniFFI. Targets macOS and iPadOS from a single Xcode project.

- UniFFI setup — generate Swift bindings from `crates/core/`, verify in Swift playground or test target
- Xcode project — Swift Package with macOS + iPadOS targets, Rust library linked
- Metal pixel grid renderer — minimal Metal pipeline rendering the pixel buffer
- Basic SwiftUI UI — tool selection, color picker, canvas view (Metal surface)
- Touch/Pencil input — Apple Pencil drawing on iPadOS, mouse drawing on macOS
- Zoom/pan — pinch gesture (iPadOS), scroll/trackpad (macOS), shared viewport transform from core
- Undo/redo — connected to core history module, SwiftUI toolbar integration

### Dual Shell PoC — Platform Comparison

Record findings in `docs/comparison/` as each feature is implemented on both shells.

- Rendering performance — Canvas2D vs Metal FPS at various canvas sizes
- Input latency — event-to-pixel-update measurement on both shells
- Bundle size — Tauri `.app` vs native `.app`
- Implementation effort — per-feature LOC and time comparison
- Responsive layout — extract SwiftUI size class transitions, adapt to web CSS breakpoints

### Release

- Create CHANGELOG.md (Keep a Changelog format)
- Set up CI (GitHub Actions: `tauri build` + Vitest + minimal Playwright E2E + `tauri-driver`)
- Git tag v0.1.0
- GitHub Release

## v0.2.0: Basic Tool Expansion

- Decide project file format (prerequisite — must be decided before v0.2.0 work begins)
- Line tool (Bresenham), rectangle/circle, flood fill, eyedropper
- Grid visibility toggle
- Internationalization (i18n) — Korean/English support

## v0.3.0: Color System

- HSV color picker, foreground/background color swap, preset palettes

## Future triggers (not tied to a specific version)

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
