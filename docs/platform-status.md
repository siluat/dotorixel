# Platform Status

Feature implementation status across Core (Rust), Web (SvelteKit + Canvas2D), and Apple (SwiftUI + Metal).

**Legend**: ✅ Done | 🔧 Partial | ⬜ Not done | — N/A

## Drawing Tools

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pencil | ✅ | ✅ | ✅ | |
| Eraser | ✅ | ✅ | ✅ | |
| Line | ✅ | ✅ | ✅ | Snapshot-restore preview |
| Rectangle | ✅ | ✅ | ✅ | Outline only, snapshot-restore preview |
| Ellipse | ✅ | ✅ | ✅ | Outline only, snapshot-restore preview |
| Flood fill | ✅ | ✅ | ⬜ | BFS, 4-connectivity |
| Eyedropper | — | ✅ | ⬜ | Drag-and-commit with live 9×9 loupe; releases to FG (left-click) or BG (right-click); skips transparent pixels |
| Move | — | ✅ | ⬜ | Drag to reposition canvas content, snapshot-restore preview |
| Selection / Marquee | 🔧 | 🔧 | ⬜ | Persistent Marquee with clipping, Delete, drag-to-move/cancel, copy/cut/paste, keyboard nudge, Shift-square define/axis drag, action bars; selection UI hides (Marquee preserved) while a Reference Layer is active |
| Right-click background color | — | ✅ | ✅ | All tools draw with BG color on right-click; eraser unchanged. Apple: macOS right-click + iPadOS pointer secondary button; touch always FG |
| Stroke interpolation | ✅ | ✅ | ✅ | Bresenham algorithm |
| Pixel-perfect filter | ✅ | ✅ | ⬜ | L-corner 3-window rule (Aseprite-style). Web: topBar/mAppBar toggle, default ON, persisted; disabled on non-freehand tools |

## Canvas

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Create / resize | ✅ | ✅ | ✅ | 1–256px, presets available, 9-position anchor selector (Web) |
| Clear | ✅ | ✅ | ✅ | History-integrated, no confirm dialog. Web: active Pixel Layer, RightPanel (docked) + Settings tab (mobile); Apple: single canvas, RightPanel |
| Flip / transform | ✅ | ✅ | ⬜ | Two tiers, one scope per button: Canvas Transform (panel) — all Pixel Layers × all frames, Marquee co-transformed + clipped, rotate swaps W↔H, Reference Layer fixed; Marquee Transform (SelectionActionBar) — Marquee region only, no-op without a Marquee or on a Reference Layer |

## History

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| PixelCanvas History (single-canvas) | ✅ | ⬜ | ✅ | Dimension-aware snapshots (pixels + W/H) so resize is undoable. Apple's undo path; the Web binding no longer exposes it — Web routes undo through Document History |
| Document History | ✅ | ✅ | ⬜ | Whole-`Document` snapshots (layer stack + Marquee + counters); Web's undo path. Its own species — never mixed with the PixelCanvas path (unrepresentable, not runtime-guarded). Not on Apple bindings yet |

## Viewport

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Zoom | ✅ | ✅ | ✅ | Discrete levels + continuous |
| Pan | ✅ | ✅ | ✅ | |
| Fit to viewport | ✅ | ✅ | ✅ | |
| Navigation Bounds clamp | 🔧 | ✅ | ⬜ | Clamp (pan/zoom/zoom-fit/resize) to canvas ∪ active-Reference footprint via one viewport sink. Rotation-aware footprint and clamp op are both core; the union is computed Web-side |

## Color

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Color model (RGBA) | ✅ | ✅ | ✅ | Hex conversion in Core + Web |
| HSV conversion | — | ✅ | ⬜ | `rgbToHsv()` / `hsvToRgb()` |
| Color picker | — | ✅ | ✅ | Web: custom HSV picker, Apple: SwiftUI |
| Preset palette | — | ✅ | ✅ | 18 Pebble colors |
| Recent colors | — | ✅ | ⬜ | Last 12 used |
| FG/BG color swap | — | ✅ | ✅ | Swap button + per-swatch color picker. Apple: swap button; palette/picker set FG only |
| Color loupe overlay | — | ✅ | ⬜ | 9×9 magnifier + hex chip during eyedropper drag (mouse) and 400ms long-press (touch); quadrant-flip keeps it visible near viewport edges |

## Rendering

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pixel rendering | — | ✅ | ✅ | Canvas2D / Metal |
| Multi-layer composite | ✅ | ✅ | ⬜ | Visible Pixel Layers blended bottom-to-top; Reference drawn separately as viewport underlay. Composites any frame (active = one case) — read seam for playback/onion/export |
| Checkerboard transparency | — | ✅ | ✅ | |
| Grid overlay + toggle | — | ✅ | ✅ | Auto-hidden below 4px |

## Export

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| PNG | ✅ | ✅ | ✅ | 1× scale, default filename `dotorixel-{w}x{h}.png` on both shells; Apple: system save flow (macOS save panel / iPadOS Files picker) |
| SVG | ✅ | ✅ | ⬜ | Apple: core ready, UI not wired |
| GIF (animated) | ✅ | ✅ | ⬜ | Timeline order, per-frame durations (centisecond quantization), infinite loop, binary transparency (α≥128), exact colors within palette limit; hidden/Reference layers excluded; Apple: core ready, UI not wired |
| Spritesheet (PNG) | ✅ | ✅ | ⬜ | Horizontal strip, tile = canvas size, frames in Timeline order, full RGBA; hidden/Reference layers excluded; sheet-marked default filename; Apple: core ready, UI not wired |
| Export UI — desktop | — | ✅ | 🔧 | Web popover: format selector, filename input, confirmation; Apple: one-tap PNG button, filename edited in the system save dialog |
| Export UI — mobile | — | ✅ | — | Bottom sheet (vaul-svelte); format selector, filename input, export button |

## Input

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Mouse / trackpad | — | ✅ | ✅ | |
| Touch | — | ✅ | ✅ | Pointer Events / UITouch; Web: pinch-zoom + two-finger pan + touch deferral + long-press eyedropper |
| Apple Pencil | — | — | ✅ | |
| Keyboard shortcuts | — | ✅ | ✅ | Web: tools, grid, undo/redo, Alt eyedropper, Space pan, X color swap, Shift constrain, `/` hints, selection C/X/V. Apple: undo/redo only |
| Constrain latch | — | ✅ | ⬜ | Re-tap the active constrainable tool (line/rect/ellipse/selection) to latch the Shift constraint keyboard-free; OR-combined with Shift; mid-stroke toggle re-resolves the in-flight shape instantly |
| Tool selection a11y | — | ✅ | ⬜ | Tool buttons form an ARIA radiogroup: aria-checked + roving tabindex, Arrow-key nav (wraps), Space/Enter activates (latch on constrainable). Latch state announced via a polite SR live region |

## i18n

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Internationalization | — | ✅ | ⬜ | Paraglide.js, URL path routing (`/ko/`, `/ja/`; root `/` for EN); root auto-detects browser language, explicit choice persists via localStorage |

## Analytics

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Page view tracking | — | ✅ | — | Umami Cloud, auto SPA tracking |
| Custom event tracking | — | ✅ | — | Tool usage, canvas resize, export, session duration |
| CSP headers | — | ✅ | — | Vercel response headers |

## Multi-image Workflow

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Tab management (Workspace) | — | ✅ | ⬜ | Workspace model, page wiring, TabStrip UI complete |
| Session persistence | — | ✅ | ⬜ | Multi-tab IndexedDB restore, debounced auto-save, retention; V7 Document persistence (layers, per-frame Cels + durations, Reference blobs, Marquee) round-trips multi-frame state; lossless V1→V7 migration; one unreadable record is skipped, not fatal |
| Save dialog on tab close | — | ✅ | ⬜ | Blank canvas detection, save/delete/cancel modal, focus trap, keyboard accessible |
| Saved work browser (desktop) | — | ✅ | ⬜ | Browse/open/delete; opens full Document snapshots while cards use composite thumbnails |
| Saved work browser (mobile) | — | ✅ | — | Bottom sheet; opens full Document snapshots while cards use composite thumbnails |

## Layers

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Document/Layer model | 🔧 | 🔧 | ⬜ | Pixel Layer stack with active layer, visibility, opacity, Timeline collapse state, and Pixel-only composite. Apple remains single-canvas |
| Frame cel-grid | ✅ | ✅ | ⬜ | One Cel per Pixel Layer per frame (grid invariant); Reference frame-independent. Web: undoable add/duplicate/remove/reorder + set-active journal intents (undo restores frame+cel); multi-frame V7 persistence round-trips through the snapshot |
| Per-frame duration | ✅ | ✅ | ⬜ | Each frame holds a display duration; default 100ms (10fps); identity unchanged when retimed. 1–60000ms clamp at the shell boundary (core trusts the value). Web complete: active-frame editor in the timeline corner (ms + derived fps), undoable, V7-persisted. Apple pending |
| Reference Layer (timeline kind) | ✅ | ✅ | ⬜ | Singleton viewport underlay with import/replace, fit, placement controls, draw-tool no-op cursor, and rotation-aware source sampling. Editability (Reference takes no paint/Marquee) has one authority enforced at the document-state boundary; a live stroke's target layer/frame can't switch or vanish mid-stroke. Fixed under canvas transforms (nothing produces new quarter-turns; saved ones still render). Placement invariant (finite pos, scale > 0, quarter-turn 0..=3) enforced by the core constructor |
| Timeline panel | — | 🔧 | ⬜ | Layer × Frame grid (occupancy dots, Reference span, 2-channel active highlight); ruler/cell select; header add/duplicate/delete + ruler-cell drag-reorder; per-document collapse; full-width transport strip (Play/Pause · Loop · Ghost · `n/N`) + ▼ playhead marker lane. Mobile row-button touch targets pending |
| Playback (animation) | — | ✅ | ⬜ | Per-tab engine: transient Playhead + rAF clock holds each frame its `duration_ms` (carry → no drift), loops or stops at end. Previews committed art via `composite_at` — no Document mutation/history/dirty, never persisted; tab/document change stops it. Transport strip (Play/Pause · Loop · ▼ playhead) wired on docked + mobile |
| Onion skinning | — | ✅ | ⬜ | Adjacent-frame ghosts while drawing (prev/next 1, clamped, no wrap): prev warm / next cool, dimmed, committed art on top; hidden during Playback; never in exports; per-tab persisted toggle in the transport strip |

## Reference Images

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Gallery store + persistence | — | ✅ | ⬜ | Per-doc reactive store; round-trips through `WorkspaceRecord.references?` (optional, absent → empty); references for closed-but-saved docs are not retained yet |
| Import pipeline | — | ✅ | ⬜ | File picker; PNG/JPEG/WebP/GIF, ≤10 MB; `createImageBitmap` decode + `OffscreenCanvas` thumbnail (256px longest edge, aspect preserved) |
| Drag-and-drop import | — | ✅ | ⬜ | Drag onto modal/sheet adds to gallery. Drag onto canvas adds AND displays each ref with cascade offsets, drop position centered on cursor (clamped so the title bar stays on-screen). Partial batches keep valid imports and surface per-file rejections |
| Browser UI | — | ✅ | ⬜ | TopBar `Images` button; ReferenceBrowser modal (wide/x-wide), ReferenceBrowserSheet (compact/medium); gallery card with thumbnail/filename/dimensions, delete confirmation, empty state, Eye/EyeOff display toggle |
| Display on canvas | — | ✅ | ⬜ | Per-instance window state (`refId`, visible, position/size, minimized, zOrder) persists through `WorkspaceRecord`. Initial placement = viewport center + cascade offset; size = `min(natural, viewport × 0.3)` on longer edge with 80px floor. Viewport shrink aspect-preservingly refits windows but does not regrow |
| Multi-window z-order + cascade | — | ✅ | ⬜ | Newly displayed/focused window goes to top of `zOrder`; topmost is `data-active`. Cascade offset 24px from viewport center per visible window; resets to 0 when all dismissed. Root pointerdown raises (close/minimize guards prevent flicker). zOrder persists through reload |
| Move + resize | — | ✅ | ⬜ | Title-bar drag follows unclamped, clamps to viewport on release (throw-and-snap-back). Resize handle (44×44 hit area) clamps live, aspect-locked, 80px floor. Auto-save fires once per completed gesture; one window gesture at a time |
| Minimize (window-shade) | — | ✅ | ⬜ | Title-bar minimize button + title-bar double-click toggle `minimized`. Body/resize handle removed from DOM (accessibility tree shows title bar only); pre-minimize size restored on toggle. Window remains draggable while minimized |
| Color sampling — Eyedropper | — | ✅ | ⬜ | Eyedropper tool active + tap a reference image → samples pixel into foreground. Transparent samples and decode failures are silent. Letterbox area around the image falls through to z-order activation |
| Color sampling — long-press + drag | — | ✅ | ⬜ | Tool-independent. Touch/pen long-press (400ms threshold, 8px slop) on a reference image starts a sampling session; drag re-samples; release commits via the same `colorPick + addRecentColor` path as the Eyedropper. Decoded image cached for the session so pointer-moves avoid `createImageBitmap` |
| Color sampling — long-press loupe | — | ✅ | ⬜ | Shared `<Loupe>` overlay (single instance at page root) shows the 9×9 RGBA neighborhood during reference long-press sampling — visual parity with the canvas Eyedropper loupe. Reuses the same `SamplingSession` via a reference-side `SamplingPort` adapter |
| Color sampling — mouse loupe parity | — | ✅ | ⬜ | Mouse press-and-drag on a reference image (Eyedropper active) engages the same sample lifecycle as touch/pen, so the loupe appears on press and tracks the cursor. Loupe positioning reuses the canvas mouse-vs-touch offset (mouse: diagonal; touch/pen: centered above) |

## UI

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Design token system | — | ✅ | ✅ | `--ds-*` tokens (web), `DesignTokens` enum (Apple; spacing scale mirrors in-use steps 1–5), light theme |
| Pebble UI theme | — | ✅ | ⬜ | Floating panels, earth tones (web legacy; Apple removed) |
| Editor UI theme | — | ✅ | ✅ | `--ds-*` tokens, docked layout skeleton (Apple); TopBar + LeftToolbar + RightPanel + StatusBar all implemented |
| Responsive layout | — | ✅ | 🔧 | Web: compact/medium/wide/x-wide via matchMedia + CSS Grid, ≥44px targets. Apple: docked adapts wide↔x-wide (1440pt panel/bar sizing); iPad-compact deferred to the mobile paradigm |
| Toolbar tooltip | — | ✅ | ⬜ | Custom styled tooltip on hover (tool name + shortcut badge), Svelte action, GeistPixel-Square font |
| Tab bar slide indicator | — | ✅ | ⬜ | ease-in-out-cubic 180ms, pure CSS `--active-index` |
| Landing page | — | ✅ | — | Hero (+ editor mockup) / Features / Roadmap sections, nav with GitHub link, i18n (EN/KO/JA), responsive at 600/1024px, `--ds-*` tokens |
| Safe area handling | — | ✅ | ⬜ | `viewport-fit=cover` + `env(safe-area-inset-*)` on all routes |
