# Todo

## Milestone 1: Usable Editor

### Release

- Create CHANGELOG.md (Keep a Changelog format)
- Vercel production deployment

## Milestone 2: Editor for Serious Work

- Layer system: basic infrastructure (add/delete/reorder)
- Layer properties (visibility toggle, opacity control)
- Selection tool (rectangle select + move)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- iPad + Apple Pencil optimization (hover preview, palm rejection)
- Feature guide page (basic usage instructions)
- (review) In-editor feedback widget

## Milestone 3: Animation-Capable Editor

- Frame management (add/delete/duplicate/reorder)
- Per-frame speed control
- Timeline UI
- Onion skinning
- Animation preview (play/pause in editor)
- GIF/spritesheet export
- Feedback link to Google Form
- (review) Public roadmap & feature voting system — depends on user base size

## Future milestones (directional hypotheses — redesign based on user feedback)

- Editor for Game Developers (Milestone 4)
- Beyond the Editor (Milestone 5)

## Deferred

- Dual Shell PoC — Platform Comparison (native development deferred)
  - Input latency — event-to-pixel-update measurement on both shells
  - Bundle size — Tauri `.app` vs native `.app`
  - Implementation effort — per-feature LOC and time comparison
  - Responsive layout — extract SwiftUI size class transitions, adapt to web CSS breakpoints
- Apple native shell improvements (deferred until web app matures)

## Review backlog (not assigned to a milestone)

- FG/BG swap UI improvements
- Tool-specific mouse cursor (eyedropper, crosshair, etc.) — toolCursor prop infrastructure exists but is not wired up

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
