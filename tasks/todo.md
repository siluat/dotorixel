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
(full tool set + color + i18n, issues 230–242), Phase 3 (layer system, issues
256–261), and Phase 4 (multi-tab + persistence, issues 262–266) are complete;
Phase 5 is decomposed below (issues 267–282); Phase 6 is decomposed
(`/to-tickets`) when reached.

### Phase 5 — Reference + selection + transforms (issues 267–282)

Two parallel tracks; frontier: `{271, 272, 277}` (267–270 done).

Selection + transforms track:

- [271 — Marquee clipping of drawing tools](../issues/271-apple-marquee-clipping.md)
- [272 — Floating selection](../issues/272-apple-floating-selection.md)
- [273 — Selection keyboard ops](../issues/273-apple-selection-keyboard-ops.md)
- [274 — Selection clipboard](../issues/274-apple-selection-clipboard.md)
- [275 — Selection action bar](../issues/275-apple-selection-action-bar.md)
- [276 — Marquee persistence](../issues/276-apple-marquee-persistence.md)

Reference track:

- [277 — UniFFI reference bindings (expand)](../issues/277-apple-uniffi-reference-bindings.md)
- [278 — Reference import + underlay + timeline row](../issues/278-apple-reference-import-underlay.md)
- [279 — Reference edit guards + sampling](../issues/279-apple-reference-edit-guards-sampling.md)
- [280 — Reference placement overlay](../issues/280-apple-reference-placement-overlay.md)
- [281 — Navigation bounds clamp](../issues/281-apple-reference-navigation-bounds.md)
- [282 — Reference persistence](../issues/282-apple-reference-persistence.md)

### Phase 6 — roadmap (decompose when reached)

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
- Apple auto-save failure surfacing — a failed SwiftData save restores the dirty state and retries silently, with no log or user-facing notice; the Apple sibling of the IndexedDB quota item above. Surface it (log, then notification) once the shell has a logging convention (noted in 265 review)
- Flaky e2e: Reference Window reload persistence — `e2e/editor/reference-images.test.ts` "window position survives a page reload" failed once, then passed on solo and full re-runs (2026-07-04, surfaced during 205 verification). Timing-sensitive chain: drag via raw pointer events → reload → IndexedDB workspace restore. Investigate/stabilize if it recurs
- Web session-save gaps mirrored from the 265 review — two latent issues the Apple shell fixed in PR #351 that the web `SessionPersistence`/`AutoSave` share: (1) a fresh session whose first save happens after adding a second tab skips the never-stored first document (`dirtyDocIds` miss), persisting a tab order whose restore discards the whole workspace; (2) shared-state-only changes mark the active document dirty, rewriting its record (layers included) and stamping `updatedAt` for an edit that never touched it. Port the Apple fixes (write records missing from the store regardless of the dirty set; mark workspace-level dirt without a document id)
- Web hydration opacity validation — the Apple binding rejects non-finite / out-of-`[0,1]` layer opacity at its `from_layers` boundary (PR #349 review); the web's `WasmDocumentBuilder.add_layer` still accepts any f32, an isomorphic gap (a persisted NaN slips past the compositor's clamp and renders the layer transparent). Port the same guard, or promote the opacity invariant into a core validating constructor (ReferencePlacement precedent), when the persistence surface next changes
- Core/wasm `from_drag` span hardening — `MarqueeRegion::from_drag`'s `max − min + 1` is `i32` arithmetic, safe today because core and wasm callers pass shell-internal canvas coordinates (the Apple FFI validates spans at its own boundary since PR #353). If either path ever accepts unbounded external coordinates (file import, scripting), add a checked wide-arithmetic constructor in core and route all three boundaries through it (deferred from the #353 review)

## Future triggers

- First external contributor → set up CLA
- Community forming → add CONTRIBUTING.md, Code of Conduct, issue/PR templates
- Menu bar, command palette, or plugin system needed → adopt Action pattern for unified command dispatch (see [`docs/research/action-pattern-research.ko.md`](../docs/research/action-pattern-research.ko.md))
