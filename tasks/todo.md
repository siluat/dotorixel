# Todo

## Milestone 4: Animation-Capable Editor

- Feedback link to Google Form
- Apple Pencil: hover preview + palm rejection ([PRD](../issues/251-apple-pencil-hover-palm-rejection.md))
  - [255 — Device verification pass (HITL)](../issues/255-apple-pencil-device-verification.md)
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
the 6-phase roadmap and sequencing rationale. Phase 1 (layout finish), Phase 2
(full tool set + color + i18n, issues 230–242), and Phase 3 (layer system, issues
256–261) are complete; Phases 5–6 are decomposed into issues (`/to-tickets`) when
reached.

### Phase 4 — Multi-tab + persistence (issues 262–266)

- [265 — SwiftData session auto-save + restore](../issues/265-apple-swiftdata-session-persistence.md) — unblocked (263, 264 done)
- [266 — Save dialog + saved work browser](../issues/266-apple-save-dialog-saved-work.md) — blocked by 265

### Phases 5–6 — roadmap (decompose when reached)

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
- Apple tab strip keyboard navigation — ArrowLeft/Right + Home/End roving focus for hardware keyboards (web `TabStrip.svelte` keydown parity); needs `FocusState`/`onKeyPress` plumbing. Deferred from the 264 PR review (cubic P3): not in the 264 acceptance scope, and an independent slice
- Apple layer reorder — interrupted-drag recovery, OS-interruption residual. SwiftUI `DragGesture` has no cancel callback, so a drag whose `onEnded` never arrives leaves `TimelinePanel.reorderDrag` non-nil: row preview offsets stay applied and the body's `scrollDisabled` lock stays on until the next drag. The in-app orphan paths self-heal since PR #347 review (stack mutation mid-drag cancels via `onChange` of the panel-order ids; collapse cancels via `onDisappear`), so what remains is system-level teardown only — app backgrounded mid-drag, gesture preempted by the OS. The web clears the equivalent state on `pointerCancel`; a `scenePhase` reset is the candidate guard. Needs a hands-on read of whether teardown actually skips `onEnded` on device before adopting it (deferred from 260)
- Apple layer panel predicates — `canReorderLayers` vs the adjacent `canRemoveLayer` differ in number. Kept as-is in 260 because the concepts differ (reordering a stack vs removing one layer); revisit if a third panel predicate lands and the set reads inconsistent
- Apple bindings staleness guard — `build-rust.sh` bootstraps Swift bindings only when `apple/generated` is empty, so a workspace built before a binding-surface change compiles against stale bindings until regenerated manually; add an mtime-based regeneration guard (surfaced by greptile on PR #342; recurs as Phase 3 keeps growing the binding surface)
- Flaky e2e: Reference Window reload persistence — `e2e/editor/reference-images.test.ts` "window position survives a page reload" failed once, then passed on solo and full re-runs (2026-07-04, surfaced during 205 verification). Timing-sensitive chain: drag via raw pointer events → reload → IndexedDB workspace restore. Investigate/stabilize if it recurs
- Web hydration opacity validation — the Apple binding rejects non-finite / out-of-`[0,1]` layer opacity at its `from_layers` boundary (PR #349 review); the web's `WasmDocumentBuilder.add_layer` still accepts any f32, an isomorphic gap (a persisted NaN slips past the compositor's clamp and renders the layer transparent). Port the same guard, or promote the opacity invariant into a core validating constructor (ReferencePlacement precedent), when the persistence surface next changes

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
