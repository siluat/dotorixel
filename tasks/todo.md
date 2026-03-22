# Todo

## v0.1.0: Canvas Foundation

### Dual Shell PoC — Rust Core Migration

Migrate core logic from TS to Rust, one module at a time. Each step should keep both web and Tauri builds working. Run existing TS unit tests against WASM bindings after each migration step to verify no regressions.

Reference: [`docs/research/cross-platform-architecture-for-best-experience.en.md`](../docs/research/cross-platform-architecture-for-best-experience.en.md)

**Migration Safety Net** — Existing TS unit tests (7 files in `src/lib/canvas/`) serve as the behavioral specification. During Rust migration, keep WASM API compatible with TS API so the same tests verify both implementations (import path change only). Browser-level E2E tests (Playwright) will be added minimally at the CI setup stage (Release).

### Dual Shell PoC — Platform Comparison

Record findings in `docs/comparison/` as each feature is implemented on both shells.

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
