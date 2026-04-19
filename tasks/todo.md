# Todo

## Milestone 2: Production UIUX

- Pixel-perfect drawing — remove double-pixels at stroke joints — [PRD](../issues/069-pixel-perfect-drawing.md)

  - [072 — Pencil integration](../issues/072-pixel-perfect-pencil-integration.md)
  - [073 — Eraser integration](../issues/073-pixel-perfect-eraser-integration.md)
  - [074 — topBar/mAppBar toggle + preference](../issues/074-pixel-perfect-toggle-ui.md)

## Milestone 3: Editor for Serious Work

- Floating reference image windows (import from Files/Photos, reposition/minimize, color sampling) — inspired by Pixquare — [PRD](../issues/053-floating-reference-window.md)

  - [054 — UI design spec](../issues/054-reference-images-design.md) (HITL)
  - [055 — gallery foundation](../issues/055-reference-images-gallery-foundation.md)
  - [056 — display on canvas + close](../issues/056-reference-images-display-close.md)
  - [057 — move + resize](../issues/057-reference-images-move-resize.md)
  - [058 — minimize (window-shade)](../issues/058-reference-images-minimize.md)
  - [059 — z-order + cascade](../issues/059-reference-images-z-order-cascade.md)
  - [060 — Eyedropper sampling](../issues/060-reference-images-eyedropper-sampling.md)
  - [061 — long-press sampling](../issues/061-reference-images-long-press-sampling.md)
  - [062 — drag-drop import](../issues/062-reference-images-drag-drop-import.md)
- Layer system: basic infrastructure (add/delete/reorder)
- Reference Layer type (import image as non-editable layer, rasterize, restore original size) — rides on layer system
- Layer properties (visibility toggle, opacity control)
- Selection tool (rectangle select + move)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- (review) Evaluate serde-wasm-bindgen + tsify for WASM↔TS serialization — revisit when project file format requires multi-type Rust↔JSON↔TS conversion
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

## Apple Native: Phase 1 — [RFC](../issues/013-apple-native-catchup.md)

Phase 1 modernizes the native layout from Pebble UI to the web's docked structure.

- Layout transition: floating panels to docked layout (TopBar, LeftToolbar, RightPanel, StatusBar) — [PRD](../issues/014-apple-native-docked-layout.md)

  - [018 — RightPanel](../issues/018-apple-right-panel.md)
  - [019 — StatusBar](../issues/019-apple-status-bar.md)
- Responsive tiers: iPad compact / iPad regular / Mac
- Enable clear canvas (existing disabled button)
- Enable PNG export (existing disabled button)
- Shift-constrain for shape tools (macOS keyboard modifier)

## Deferred

- Dual Shell PoC — Platform Comparison (native development deferred)
  - Input latency — event-to-pixel-update measurement on both shells
  - Bundle size — Tauri `.app` vs native `.app`
  - Implementation effort — per-feature LOC and time comparison

## Review backlog (not assigned to a milestone)

- Reference image window polish — opacity slider, lock toggle, flip H/V, rotate (deferred from Milestone 3 MVP)
- Reference image import — clipboard paste support (Ctrl/Cmd+V), deferred from Milestone 3 MVP
- Design: share artwork dialog — URL sharing dialog UI (.pen)
- Share artwork via URL
- FG/BG swap UI improvements
- Dark mode toggle UI — design tokens support dark theme (`data-theme="dark"`), no UI to switch yet
- Document error conditions on `PixelCanvas` public API — `new`, `with_color`, `from_pixels`, `restore_pixels` all return `Result` but only document partial constraints; add `Err` variant descriptions per Rust API Guidelines C-FAILURE
- IndexedDB quota exceeded error handling — auto-save silently fails when storage is full; show user-facing notification with actionable guidance
- Document rename — allow renaming documents from tab and saved work browser
- Canvas resize via border drag — drag canvas edges to change canvas dimensions
- Timelapse recording — capture drawing process for playback/export

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
