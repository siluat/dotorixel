# Todo

## Milestone 2: Production UIUX

### Multi-image workflow

- Tab system (work on multiple images simultaneously) — [PRD](../issues/002-tab-system.md)
  - [006 — TabStrip component — visual tab management](../issues/006-tab-strip-component.md)
- Session persistence (restore work after refresh/revisit)
- Design: saved work browser — list/modal UI for reopening past work (.pen)
- Reopen past work (browse and restore from saved work list)

### Export & sharing

- SVG export
- Sync: export UI format options updated in Editor frames (.pen)
- Design: share artwork dialog — URL 공유 다이얼로그 UI (.pen)
- Share artwork via URL

### Landing page

- Design: landing page improvements (.pen)
- Landing page UI improvements

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
- Dark mode toggle UI — design tokens support dark theme (`data-theme="dark"`), no UI to switch yet
- Document error conditions on `PixelCanvas` public API — `new`, `with_color`, `from_pixels`, `restore_pixels` all return `Result` but only document partial constraints; add `Err` variant descriptions per Rust API Guidelines C-FAILURE

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
