# Todo

## Milestone 3: Editor for Serious Work

- Touch modifier alternatives (Shift-constrain, Alt-eyedropper UI for touchscreen) — **blocks** Shift-related Selection sub-issues
- Selection tool — Marquee with move/copy/paste and per-tool clipping ([PRD](../issues/131-selection-tool-rectangle-select-move-nudge-copy-paste.md))
  - [150 — Action Bar Floating state](../issues/150-selection-action-bar-floating-state.md)
  - [151 — Shift = square define (blocked by external Touch modifier alternatives)](../issues/151-shift-square-define.md)
  - [152 — Shift = axis lock during Floating drag (blocked by external Touch modifier alternatives)](../issues/152-shift-axis-lock-during-floating-drag.md)
- Copy/paste
- Flip/transform
- Project file format (JSON-based) + save/load
- (review) Evaluate serde-wasm-bindgen + tsify for WASM↔TS serialization — revisit when project file format requires multi-type Rust↔JSON↔TS conversion
- Apple Pencil: hover preview + palm rejection
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

- Apple view test infrastructure — evaluate ViewInspector / swift-snapshot-testing / XCUITest. Trigger: a regression class that's hard to catch via `EditorState` unit tests alone (e.g., reactive binding miss, layout drift, gesture flow on iPad).
- Apple spacing tokens — `DesignTokens.swift` has no spacing scale; sibling views inline `4`/`8`/`12`/`16` literals. Promote to constants once the docked layout has settled and reuse is confirmed.
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
- Validate `ReferencePlacement.scale` invariant (strictly positive, finite) via a constructor — currently `pub f32` field permits `0.0`, negative, NaN, and `±∞`, which `sample_reference` cannot defend against without violating "trust the core". Flagged by greptile/coderabbit/cubic on PR #208
- `cargo fmt` debt in `wasm/src/lib.rs` — sub-issue 110 noted that workspace-level `cargo fmt --check` fails on pre-existing whitespace in the wasm shell; clean up in a focused formatting pass.
- Collapse `sample_reference` free function into `ReferenceData::sample_at(x, y)` — rust-conventions prefer behavior on the type. Out of scope for 109/110 to preserve testability of raw-buffer signature; revisit once the binding layer (113) settles call sites.

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
