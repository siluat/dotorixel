---
title: Apple native catch-up — phased strategy to reach full web parity
status: open
created: 2026-04-06
---

## Revision note (2026-07-09)

Re-planned on 2026-07-09. The original 2026-04-06 strategy (preserved under
[Superseded plan (2026-04-06)](#superseded-plan-2026-04-06)) targeted **M2-level
parity** and was written *before the web had a layer system* — its feature-gap
analysis is now more than two milestones stale.

**Decision (2026-07-09):** the Apple shell will reach **full parity with every
completed web _editor_ feature**, not a differentiated subset. This revision
re-baselines the gap against the web's current M4-complete state and re-phases the
roadmap accordingly. The "why UI-first" and "hybrid native controls" reasoning from
the original still governs and is carried forward below.

## Context

The web editor (SvelteKit) has been the primary development focus through
Milestones 1–4. It is now an animation-capable pixel editor: multi-layer documents,
a multi-tab workspace, session persistence, reference layers, rectangular selection,
whole-document and region transforms, a frame/timeline animation system with
playback and onion skinning, and PNG/SVG/GIF/spritesheet export.

The Apple native shell (SwiftUI + Metal) was built to MVP level — pencil, eraser,
zoom/pan, undo/redo — then given the web's docked layout shell (TopBar, LeftToolbar,
RightPanel, StatusBar). It then paused while the web matured through the layer
system and all of M3–M4. The gap is now large, and closing it fully is the goal.

## Decision & Goal

**Goal: full parity — every completed web editor feature ships on the Apple shell.**

Parity is the destination, not a single sprint. The roadmap below sequences the
catch-up by dependency and risk so the shell stays usable at every step.

**Scope.** "Editor features" means the drawing / animation / document capabilities a
user exercises inside the editor. Web-shell-only concerns are explicitly out of
scope or delivered the native way:

- Landing page, feature-voting, web analytics — out of scope (marketing surface).
- SVG *web* export — in scope as an editor export format, via the shared core encoder.
- i18n — in scope, delivered natively (String Catalog / `.xcstrings`), not Paraglide URL routing.
- Keyboard shortcuts — in scope, delivered natively (`.keyboardShortcut`).

## Shared Foundation

Both platforms consume the same Rust core via different bindings:

| Platform | Binding | Generated code |
|----------|---------|---------------|
| Web | wasm-pack (WASM) | `wasm/pkg/` |
| Native | UniFFI (Swift) | `apple/generated/` |

The core already implements the substance of nearly every missing feature: canvas
pixel storage, all tool algorithms, viewport math, undo/redo history, the
Document/Layer model and compositing, reference-layer sampling and placement, marquee
region ops, whole-document / region flip & rotate, the frame cel-grid and per-frame
duration, per-frame `composite_at`, color parsing, pixel-perfect filtering, and
PNG/SVG/GIF/spritesheet encoders.

This is what makes full parity tractable for a one-person team: catch-up is
primarily **shell work — wiring existing core functions to SwiftUI, building the
Swift-side state / interaction / persistence layers, and rendering the new visual
elements in Metal — not reimplementing logic.**

## Current gap (2026-07-09)

**Apple shell has today:** docked layout shell (TopBar / LeftToolbar / RightPanel /
StatusBar), Metal pixel rendering, a single flat `EditorState`, pencil + eraser,
zoom/pan, undo/redo, a default palette and color picker.

**Missing (the parity backlog), by area:**

| Area | Missing on native |
|------|-------------------|
| Tools | Line, rectangle, ellipse, flood fill, eyedropper, move |
| Color | FG/BG swap, recent colors, HSV picker, sampling loupe, pixel-perfect toggle |
| Input | Tool keyboard shortcuts, Shift constraint, right-click BG color |
| Layers | **Document/Layer model, compositing render path, layer panel** (foundation for everything below) |
| Workspace | Multi-tab workspace, per-tab state |
| Persistence | Session save/restore, auto-save (SwiftData) |
| Reference | Reference layers — import, placement overlay, sampling |
| Selection | Rectangular marquee, lift / move / nudge, clipboard cut / copy / paste, action bar |
| Transforms | Whole-document & region flip / rotate |
| Animation | Frames, timeline panel, per-frame duration, playback transport, onion skinning |
| Export | SVG, GIF, spritesheet (PNG exists) |
| Other | i18n (String Catalog), status-bar content, responsive tiers |

Note: the original RFC's gap table listed neither layers nor any of M3–M4 — those
web features postdate it. The table above is the true current baseline.

## Re-planned roadmap

Six phases, ordered by dependency and by keeping the app usable throughout. Later
phases are decomposed into issues (via `/to-tickets`) when reached, not up front.

| Phase | Scope | Why here |
|-------|-------|----------|
| **1 — Layout finish** | Responsive tiers (iPad compact / regular / Mac); quick wins: enable clear canvas, enable PNG export | Shell already exists; small, no state redesign |
| **2 — Full tool set + color** | Line, rect, ellipse, fill, eyedropper, move; Shift constraint; FG/BG swap; recent colors + HSV; pixel-perfect; tool keyboard shortcuts; StatusBar content | Runs on the current single-canvas model — low risk, makes native genuinely usable for drawing |
| **3 — Layer system** ★ | Document/Layer, composite render path, layer panel in a frames-less Timeline panel shell (its final home — see the 2026-08-01 reference-layout note); **Swift-side state-architecture redesign** (Document / active-layer ownership) | The foundation M3/M4 all build on |
| **4 — Multi-tab + persistence** | Workspace + per-tab state; SwiftData document storage, auto-save, restore | Persist the document model once it exists, before more content features land |
| **5 — Reference + selection + transforms** | Reference layers (import / placement / sampling); marquee selection + clipboard; flip / rotate | The M3 bundle — all sit on the Document model + persistence schema |
| **6 — Animation + extended export** | Frames + the frame axis extended into the Phase 3 Timeline panel shell, per-frame duration, playback transport, onion skinning; SVG / GIF / spritesheet export | The M4 bundle — the deepest, most interaction-heavy layer |

### Sequencing rationale

- **Re-sequencing note (2026-07-14):** Shift-constrain moved from Phase 1 to
  Phase 2 during Phase 1 decomposition. The shell has no shape tools until Phase 2,
  and the web implements the constraint in shell code (`tool-constraints.ts`), not
  the shared core — so in Phase 1 there is nothing to constrain and no core function
  to wire. The Phase 1 listing was carried over from the superseded 2026-04-06 plan.
- **Tools before layers (2 → 3).** The full tool set needs no document model and no
  state redesign; it lands quickly on today's `EditorState`, making the app usable and
  providing a validation base for the larger refactors that follow.
- **Layers before everything downstream (3).** Reference layers, selection masks, and
  animation cels are all expressed on the Document/Layer model. It is the single
  highest-leverage foundation and gates Phases 5–6.
- **Persistence right after layers (4).** Once users create multi-layer documents,
  losing them on close is unacceptable. Establish SwiftData persistence on the document
  model before adding more content-creation surface; extend the schema in Phases 5–6 the
  way the web migrated v3→v7.
- **M3 before M4 (5 → 6).** Mirrors the web's own dependency order; animation is the
  deepest and most interaction-heavy layer.

### Cross-cutting concerns

Folded into each phase rather than sequenced separately:

- **UniFFI regeneration** — a build-pipeline step whenever core functions are added, not a feature task.
- **i18n** — native String Catalog; introduce once the tool/menu label set stabilizes (around Phase 2).
- **Accessibility & touch targets** — 44px minimums and size-class behavior, per the web's own touch-target work.
- **Design tokens** — keep `DesignTokens.swift` synced with the CSS custom properties as the reference (see principles below).

## Design decision — hybrid: web layout as reference, SwiftUI-native controls

*(Carried forward from 2026-04-06, still governing.)* Use the web's docked structure
(TopBar, LeftToolbar, RightPanel, StatusBar) as the layout **reference**, but implement
with SwiftUI-native controls and conventions. No separate `.pen` design files for
native — the web design is the single source of truth, adapted to platform idioms
during implementation. Rationale: one-person team, small token set, avoids two-shell
design maintenance while keeping a platform-native feel.

**Reference-layout note (2026-08-01):** the layout reference is the web's *current*
docked layout, not the four-region snapshot listed above — it includes the
bottom-docked Timeline panel (layer sidebar home since the web's M3). Reading the
list as fixed is what produced 258's interim RightPanel Layers section; that
placement is superseded by issue 261 (Timeline panel shell within Phase 3, before
reorder). Phase 6 *extends* that shell with the frame axis — mirroring how the web
extended, not rebuilt, its frames-less M3 panel.

## Parallel development principles

### Synchronization cadence

Avoid per-feature context switching between web and native. Instead:

- **Rust core changes**: regenerate UniFFI bindings promptly when new core functions are added — a build-pipeline concern, not a feature task.
- **Native UI work**: bundle into focused sprints between web milestones, or interleave individual tasks when web work is blocked.

### Design token maintenance

Design tokens are manually replicated from CSS custom properties to
`DesignTokens.swift`. While the token set stays small and stable, manual sync is
acceptable. If tokens begin to diverge or grow, consider a shared token source (JSON)
with code generation for both platforms.

### Branch rule

Native tasks follow the same branch rule as web tasks — work branches, not main. The
`apple/` directory boundary makes web/native merge conflicts unlikely.

---

## Superseded plan (2026-04-06)

*Preserved for its reasoning. This plan targeted M2-level parity and predates the
web's layer system and all of M3–M4; it no longer reflects the goal or the gap. See
the current plan above.*

### Feature Gap (as assessed 2026-04-06)

#### Web has, native does not

| Category | Features | Effort |
|----------|----------|--------|
| Tools | Line, rectangle, ellipse, flood fill, eyedropper, move | Medium — core logic exists, wire to UI |
| Canvas ops | Clear, PNG export (buttons exist but disabled) | Small — enable existing buttons |
| Color | FG/BG swap, recent colors, HSV picker | Medium |
| Input | Tool keyboard shortcuts, Shift constraint, right-click BG color | Medium |
| Multi-tab | Workspace, tab strip, per-tab state | Large — native state redesign |
| Persistence | Session save/restore, auto-save | Large — SwiftData integration |
| Layout | Responsive 3-tier (mobile/tablet/desktop) | Medium — SwiftUI size classes |
| Other | i18n, analytics, status bar | Small-Medium |

#### Native has, web does not

| Feature | Notes |
|---------|-------|
| Metal GPU rendering | Higher performance ceiling than Canvas2D |
| Apple Pencil support | Pressure, tilt, hover (M3 scope for web) |
| Native gestures | Pinch/zoom feels more natural |

### Why UI-First (original rationale)

The current native shell uses the Pebble UI layout (floating panels, 2-tool bottom
bar). Several Phase 1 features — 6 additional tools, FG/BG color swap — have no place
in this layout. The web has already moved from Pebble UI to a docked layout
(`ui-editor/`) with LeftToolbar, RightPanel, and TopBar that accommodate these
features naturally.

Adding tools to the Pebble UI and then rewriting the layout is double work.
Modernizing the layout first creates the containers (toolbar, panel, status bar) that
subsequent features slot into. *(This reasoning drove the now-complete docked-layout
work, issues 015–019.)*

### Original 3-phase strategy

#### Phase 1 — UI Modernization

**Goal**: Transition native layout from Pebble UI floating panels to the web's current
docked structure, and enable features that require no UI design work.

- Layout transition: floating panels to docked layout (TopBar, LeftToolbar, RightPanel, StatusBar)
- Responsive tiers: iPad compact / iPad regular / Mac (SwiftUI size classes)
- Enable clear canvas / PNG export (buttons exist, currently disabled)
- Shift-constrain for shape tools (macOS keyboard modifier, no UI needed)

#### Phase 2 — Full Tool Set

**Goal**: Connect all Rust core tool logic to the modernized native UI.

- Enable remaining tools — line, rectangle, ellipse, fill, eyedropper, move
- FG/BG color swap + background color support
- Recent colors list
- Color picker improvements (HSV picker or enhanced native picker)
- Tool keyboard shortcuts (macOS)
- Status bar content (canvas dimensions, current tool)

#### Phase 3 — Advanced Feature Sync

**Goal**: Reach M2-level feature parity.

- Multi-tab system (Workspace pattern adapted to SwiftUI)
- Session persistence (SwiftData for document storage, auto-save)
- i18n (String Catalog / .xcstrings)
- Full keyboard shortcuts (.keyboardShortcut modifiers)

**Timing**: After web M2 is fully complete and stable.

---

## Notes

- **2026-07-14** — Phase 1 remaining quick wins decomposed into ready-for-agent
  issues: [227 — enable clear canvas](227-apple-enable-clear-canvas.md),
  [228 — enable PNG export](228-apple-enable-png-export.md). Shift-constrain
  re-sequenced to Phase 2 (see re-sequencing note above). Responsive tiers were
  already delivered by 225/226.
- **2026-07-26** — Phase 3 (Layer system) decomposed into ready-for-agent issues
  via `/to-tickets`:
  [256 — UniFFI Document bindings](256-apple-uniffi-document-bindings.md) →
  [257 — Document-backed editor state + composite render](257-apple-document-editor-state.md) →
  [258 — layer panel rows / active / visibility](258-apple-layer-panel-rows.md) →
  {[259 — add/remove](259-apple-layer-add-remove.md) ∥
  [260 — reorder](260-apple-layer-reorder.md)}. Expand–contract on the UniFFI
  surface: 256 expands (old canvas bindings untouched), 257 swaps the editor and
  contracts the canvas-snapshot history path. Layer opacity/rename UI excluded —
  no web UI exists for either (parity scope). Canvas-resize undo folded into 257
  (whole-document snapshots make cross-dimension restore representable — web
  parity, replaces the clear-history workaround).
- **2026-08-02** — Phase 4 (Multi-tab + persistence) decomposed into
  ready-for-agent issues via `/to-tickets`:
  {[262 — workspace state split (prefactor)](262-apple-workspace-state-split.md) ∥
  [263 — UniFFI persistence bindings (expand)](263-apple-uniffi-persistence-bindings.md)} →
  [264 — multi-tab workspace UI](264-apple-multi-tab-workspace.md) →
  [265 — SwiftData session auto-save + restore](265-apple-swiftdata-session-persistence.md) →
  [266 — save dialog + saved work browser](266-apple-save-dialog-saved-work.md).
  262 performs the Swift-side state-architecture redesign in isolation; 263 is
  expand-only on the UniFFI surface (256 pattern) wrapping the core's existing
  `Document::from_layers`. 264 ships tab close behind an interim
  discard-confirmation that 266 replaces with the save dialog. Persistence
  schema covers the current Apple document model only — reference layers,
  frames, and marquee arrive as Phase 5–6 schema extensions, the way the web
  migrated v3→v7. Document rename excluded (no web UI — parity scope).
- **2026-08-05** — Phase 5 (Reference + selection + transforms) decomposed into
  ready-for-agent issues via `/to-tickets`, as two parallel tracks that each
  open with an expand-only UniFFI issue (256/263 pattern).
  Selection + transforms track:
  [267 — UniFFI selection + transform bindings](267-apple-uniffi-selection-transform-bindings.md) →
  {[268 — canvas transforms](268-apple-canvas-transforms.md) ∥
  [269 — marquee select tool](269-apple-marquee-select-tool.md)} →
  {[270 — constraints + status bar readout](270-apple-marquee-constraints-statusbar.md) ∥
  [271 — marquee clipping](271-apple-marquee-clipping.md) ∥
  [272 — floating selection](272-apple-floating-selection.md)} →
  {[273 — keyboard ops](273-apple-selection-keyboard-ops.md) ∥
  [274 — clipboard](274-apple-selection-clipboard.md) ∥
  [276 — marquee persistence](276-apple-marquee-persistence.md)} →
  [275 — action bar](275-apple-selection-action-bar.md).
  Reference track:
  [277 — UniFFI reference bindings](277-apple-uniffi-reference-bindings.md) →
  [278 — import + underlay + timeline row](278-apple-reference-import-underlay.md) →
  [279 — edit guards + sampling](279-apple-reference-edit-guards-sampling.md) →
  [280 — placement overlay](280-apple-reference-placement-overlay.md) →
  {[281 — navigation bounds](281-apple-reference-navigation-bounds.md) ∥
  [282 — reference persistence](282-apple-reference-persistence.md)}.
  Persistence schema extensions (marquee, reference) are per-track slices, the
  way the web migrated v4/v5. **Scope memo**: the web's floating Reference
  Images windows (gallery, window move/resize/minimize, window sampling —
  issues 053–062 + follow-ups) are missing from the 2026-07-09 gap table above
  and are deliberately excluded from Phase 5 (decision 2026-08-05); reaching
  full parity on that feature set needs its own scheduling decision.
