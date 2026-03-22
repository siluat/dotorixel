# Todo

## v0.1.0: Usable Editor (Milestone 1)

### Basic Tool Expansion

- Rectangle tool
- Circle/ellipse tool
- Flood fill tool
- Eyedropper tool
- Grid visibility toggle

### Color System

- HSV color picker
- Foreground/background color swap

### Keyboard Shortcuts

- Tool shortcuts (P, E, L, F, I, R, C, G)
- Modifier key: Alt=eyedropper (temporary tool switch)
- Modifier key: Space=pan (temporary pan mode)
- Modifier key: Shift=constrain (constrain drawing)
- Edit shortcuts (Ctrl+Z/Y, X=swap colors)

### i18n

- Internationalization — Korean/English as default languages

### Analytics

- Privacy-friendly analytics setup (no cookie banner required)
  - Candidates: Umami (self-hosted), Plausible
  - Custom event tracking: tool usage, canvas size selection, session length, export rate, device/platform

### Landing Page

- Minimal landing page (hero section + CTA "Start Drawing" button)
- Feedback link to Google Form

### Release

- Create CHANGELOG.md (Keep a Changelog format)
- Set up CI (GitHub Actions: Vitest + wasm-pack build + Playwright E2E)
- Vercel production deployment
- Git tag v0.1.0 + GitHub Release

## v0.2.0: Editor for Serious Work (Milestone 2)

- Layer system: basic infrastructure (add/delete/reorder)
- Layer properties (visibility toggle, opacity control)
- Selection tool (rectangle select + move)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- iPad + Apple Pencil optimization (hover preview, palm rejection)
- Feature guide page (basic usage instructions)
- (review) In-editor feedback widget

## v0.3.0: Animation-Capable Editor (Milestone 3)

- Frame management (add/delete/duplicate/reorder)
- Per-frame speed control
- Timeline UI
- Onion skinning
- Animation preview (play/pause in editor)
- GIF/spritesheet export
- (review) Public roadmap & feature voting system — depends on user base size

## Future milestones (directional hypotheses — redesign based on user feedback)

- v0.4.0: Editor for Game Developers (Milestone 4)
- v0.5.0: Beyond the Editor (Milestone 5)

## Deferred

- Dual Shell PoC — Platform Comparison (native development deferred)
  - Input latency — event-to-pixel-update measurement on both shells
  - Bundle size — Tauri `.app` vs native `.app`
  - Implementation effort — per-feature LOC and time comparison
  - Responsive layout — extract SwiftUI size class transitions, adapt to web CSS breakpoints
- Apple native shell improvements (deferred until web app matures)

## Future triggers (not tied to a specific version)

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
