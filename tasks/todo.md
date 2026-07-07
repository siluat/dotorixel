# Todo

## Milestone 4: Animation-Capable Editor

- Feedback link to Google Form
- Apple Pencil: hover preview + palm rejection
- (review) In-editor feedback widget
- (review) Public roadmap & feature voting system — depends on user base size
- Project file format (JSON-based) + save/load
- (review) Evaluate serde-wasm-bindgen + tsify for WASM↔TS serialization — revisit when project file format requires multi-type Rust↔JSON↔TS conversion
- Feature guide page (basic usage instructions)

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
- TimelinePanel mobile touch targets — the header/row icon buttons (add-layer, add-reference, visibility, remove, reorder, fit-to-canvas) stay 24px on compact/medium, below the ≥44px touch guideline (`web-styling.md`) and the 187 spec §5 ("header actions ≥44px"). Pre-existing controls untouched by 191; enlarge to ≥44px on the mobile Timeline tab and coordinate with the 192 Frames action group.
- Flaky e2e: Reference Window reload persistence — `e2e/editor/reference-images.test.ts` "window position survives a page reload" failed once, then passed on solo and full re-runs (2026-07-04, surfaced during 205 verification). Timing-sensitive chain: drag via raw pointer events → reload → IndexedDB workspace restore. Investigate/stabilize if it recurs
- One authority for active-layer editability — architecture deepening, fully specified after a grilling pass, ready for an agent; independent of 221–223, also seals a mid-stroke layer-switch hazard ([issues/224](../issues/224-single-authority-active-layer-editability.md))

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
