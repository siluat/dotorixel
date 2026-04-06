---
title: Apple native catch-up — phased strategy to reach web feature parity
status: active
created: 2026-04-06
---

## Context

The web editor (SvelteKit) has been the primary development focus through Milestones 1-2. The Apple native shell (SwiftUI + Metal) was built to MVP level — pencil, eraser, zoom/pan, undo/redo, and the Pebble UI floating panel layout — then paused while the web app matured.

Now that M2 is nearing completion (multi-tab, session persistence, auto-save all done), the native shell can begin catching up incrementally, in parallel with ongoing web work.

## Shared Foundation

Both platforms consume the same Rust core via different bindings:

| Platform | Binding | Generated code |
|----------|---------|---------------|
| Web | wasm-pack (WASM) | `wasm/pkg/` |
| Native | UniFFI (Swift) | `apple/generated/` |

Shared core covers: canvas pixel storage, tool algorithms (pencil, eraser, fill, line, rectangle, ellipse, interpolation), viewport math, undo/redo history, color parsing, and PNG encoding.

This means native catch-up is primarily **UI shell work** — connecting existing Rust core functions to SwiftUI, not reimplementing logic.

## Feature Gap

### Web has, native does not

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

### Native has, web does not

| Feature | Notes |
|---------|-------|
| Metal GPU rendering | Higher performance ceiling than Canvas2D |
| Apple Pencil support | Pressure, tilt, hover (M3 scope for web) |
| Native gestures | Pinch/zoom feels more natural |

## Why UI-First

The current native shell uses the Pebble UI layout (floating panels, 2-tool bottom bar). Several Phase 1 features — 6 additional tools, FG/BG color swap — have no place in this layout. The web has already moved from Pebble UI to a docked layout (`ui-editor/`) with LeftToolbar, RightPanel, and TopBar that accommodate these features naturally.

Adding tools to the Pebble UI and then rewriting the layout is double work. Modernizing the layout first creates the containers (toolbar, panel, status bar) that subsequent features slot into.

## Strategy: 3 Phases

### Phase 1 — UI Modernization

**Goal**: Transition native layout from Pebble UI floating panels to the web's current docked structure, and enable features that require no UI design work.

Layout tasks:

- Layout transition: floating panels to docked layout (TopBar, LeftToolbar, RightPanel, StatusBar)
- Responsive tiers: iPad compact / iPad regular / Mac (SwiftUI size classes)

Quick wins (no layout dependency — can be done alongside or immediately after):

- Enable clear canvas (button exists, currently disabled)
- Enable PNG export (button exists, currently disabled)
- Shift-constrain for shape tools (macOS keyboard modifier, no UI needed)

**Design decision required** — two approaches for native layout:

- **Option A: Mirror web layout** — same structure (TopBar, LeftToolbar, RightPanel) adapted to SwiftUI. Maximizes cross-platform consistency. Larger rewrite of current native UI.
- **Option B: Platform-native layout** — follow Apple HIG conventions (NavigationSplitView, inspector panels). Better platform fit but doubles design maintenance.

**Outcome**: Native has the structural foundation for all subsequent features.

**Web impact**: None — all work within `apple/` directory.

### Phase 2 — Full Tool Set

**Goal**: Connect all Rust core tool logic to the modernized native UI. The new layout provides LeftToolbar for tool buttons and RightPanel for color management.

Tasks:

- Enable remaining tools — line, rectangle, ellipse, fill, eyedropper, move
- FG/BG color swap + background color support
- Recent colors list
- Color picker improvements (HSV picker or enhanced native picker)
- Tool keyboard shortcuts (macOS)
- Status bar content (canvas dimensions, current tool)

**Outcome**: Native reaches full drawing tool parity with web — usable for actual pixel art.

### Phase 3 — Advanced Feature Sync

**Goal**: Reach M2-level feature parity.

Tasks:

- Multi-tab system (Workspace pattern adapted to SwiftUI)
- Session persistence (SwiftData for document storage, auto-save)
- i18n (String Catalog / .xcstrings)
- Full keyboard shortcuts (.keyboardShortcut modifiers)

**Timing**: After web M2 is fully complete and stable.

## Parallel Development Principles

### Synchronization cadence

Avoid per-feature context switching between web and native. Instead:

- **Rust core changes**: Regenerate UniFFI bindings promptly when new core functions are added. This is a build-pipeline concern, not a feature task.
- **Native UI work**: Bundle into focused sprints between web milestones, or interleave individual tasks when web work is blocked.

### Design token maintenance

Currently, design tokens are manually replicated from CSS custom properties to `DesignTokens.swift`. As long as the token set is small and stable, manual sync is acceptable. If tokens begin to diverge or grow significantly, consider a shared token source (JSON) with code generation for both platforms.

### Branch rule

Native tasks follow the same branch rule as web tasks — work branches, not main. The existing `apple/` directory structure means merge conflicts between web and native work are unlikely.
