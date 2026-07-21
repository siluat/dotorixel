# Todo

## Milestone 4: Animation-Capable Editor

- Feedback link to Google Form
- Apple Pencil: hover preview + palm rejection ([PRD](../issues/251-apple-pencil-hover-palm-rejection.md))
  - [252 — Pencil contact priority: palm rejection + gesture suppression](../issues/252-apple-pencil-contact-priority.md)
  - [253 — Pencil hover preview: Hover Point + target-cell highlight](../issues/253-apple-pencil-hover-preview.md) (blocked by 252)
  - [254 — Pencil hover gate: block finger begins while hovering](../issues/254-apple-pencil-hover-finger-block.md) (blocked by 252, 253)
  - [255 — Device verification pass (HITL)](../issues/255-apple-pencil-device-verification.md) (blocked by 252–254)
- (review) In-editor feedback widget
- (review) Public roadmap & feature voting system — depends on user base size
- Project file format (JSON-based) + save/load
- (review) Evaluate serde-wasm-bindgen + tsify for WASM↔TS serialization — revisit when project file format requires multi-type Rust↔JSON↔TS conversion
- Feature guide page (basic usage instructions)

## Future milestones (directional hypotheses — redesign based on user feedback)

- Editor for Game Developers (Milestone 5)
- Beyond the Editor (Milestone 6)

## Apple Native: full web parity — [RFC](../issues/013-apple-native-catchup.md)

Phased catch-up to full parity with completed web editor features. See the RFC for
the 6-phase roadmap and sequencing rationale. Phase 1 (layout finish) and Phase 2
(full tool set + color + i18n, issues 230–242) are complete; Phases 3–6 are
decomposed into issues (`/to-issues`) when reached.

### Phases 3–6 — roadmap (decompose when reached)

- Phase 3 — Layer system (Document/Layer, composite render, layer panel, Swift state redesign) ★ foundation
- Phase 4 — Multi-tab + persistence (Workspace, SwiftData auto-save/restore)
- Phase 5 — Reference + selection + transforms (M3 bundle)
- Phase 6 — Animation + extended export (frames/timeline/playback/onion skin, SVG/GIF/spritesheet)

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
- Web pen priority — palm rejection + hover target cell, the web counterpart of the 252–254 Apple Pencil work. Pointer Events already report `pointerType: 'pen'` (Apple Pencil / S Pen / Surface pen), and the interaction machine already defers only `'touch'` begins and keeps pen out of the two-touch gesture check — but a pen begin is still blocked while any interaction is active, and a two-touch palm ends an in-flight pen stroke and enters pinching (isomorphic to the pre-252 Apple gap). Port the pen-priority semantics (CONTEXT.md: Originating Touch / Gesture Signal) to `canvas-interaction.svelte.ts`; hover preview arrives via pen hover pointer events (iPadOS 16.4+ Safari, S Pen, Windows stylus) with natural degradation. Whether to also admit mouse-hover target cell on desktop is a separate decision
- TimelinePanel mobile touch targets — the header/row icon buttons (add-layer, add-reference, visibility, remove, reorder, fit-to-canvas) stay 24px on compact/medium, below the ≥44px touch guideline (`web-styling.md`) and the 187 spec §5 ("header actions ≥44px"). Pre-existing controls untouched by 191; enlarge to ≥44px on the mobile Timeline tab and coordinate with the 192 Frames action group.
- Flaky e2e: Reference Window reload persistence — `e2e/editor/reference-images.test.ts` "window position survives a page reload" failed once, then passed on solo and full re-runs (2026-07-04, surfaced during 205 verification). Timing-sensitive chain: drag via raw pointer events → reload → IndexedDB workspace restore. Investigate/stabilize if it recurs

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
