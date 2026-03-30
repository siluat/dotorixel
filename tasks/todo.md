# Todo

## Milestone 2: Production UI

### Design

- Editor UI design — current features (desktop, iPad, mobile)
- Editor UI design — layer/animation expansion
- Validate against references (Aseprite, Pixquare)

### Implementation

- Design system application (token and component refactoring)
- Editor layout restructure (including responsive)
- Touch target sizing — 44px minimum (buttons, swatches, preset buttons)
- Touch pinch-zoom and two-finger pan (multi-touch canvas navigation)
- Safe area and virtual keyboard handling (notch, home indicator, keyboard push)
- iOS Safari export fix (Blob URL fallback)

## Milestone 3: Editor for Serious Work

- Layer system: basic infrastructure (add/delete/reorder)
- Layer properties (visibility toggle, opacity control)
- Selection tool (rectangle select + move)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- Apple Pencil: hover preview + palm rejection
- Touch modifier alternatives (Shift-constrain, Alt-eyedropper UI for touchscreen)
- Feature guide page (basic usage instructions)
- (review) In-editor feedback widget

## Milestone 4: Animation-Capable Editor

- Frame management (add/delete/duplicate/reorder)
- Per-frame speed control
- Timeline UI
- Onion skinning
- Animation preview (play/pause in editor)
- GIF/spritesheet export
- Feedback link to Google Form
- (review) Public roadmap & feature voting system — depends on user base size

## Future milestones (directional hypotheses — redesign based on user feedback)

- Editor for Game Developers (Milestone 5)
- Beyond the Editor (Milestone 6)

## Deferred

- Dual Shell PoC — Platform Comparison (native development deferred)
  - Input latency — event-to-pixel-update measurement on both shells
  - Bundle size — Tauri `.app` vs native `.app`
  - Implementation effort — per-feature LOC and time comparison
- Apple native shell improvements (deferred until web app matures)

## Review backlog (not assigned to a milestone)

- FG/BG swap UI improvements
- Tool-specific mouse cursor (eyedropper, crosshair, etc.) — toolCursor prop infrastructure exists but is not wired up

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
