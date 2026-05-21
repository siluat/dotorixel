# Platform Status

Feature implementation status across Core (Rust), Web (SvelteKit + Canvas2D), and Apple (SwiftUI + Metal).

**Legend**: ✅ Done | 🔧 Partial | ⬜ Not done | — N/A

## Drawing Tools

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pencil | ✅ | ✅ | ✅ | |
| Eraser | ✅ | ✅ | ✅ | |
| Line | ✅ | ✅ | ⬜ | Snapshot-restore preview |
| Rectangle | ✅ | ✅ | ⬜ | Outline only, snapshot-restore preview |
| Ellipse | ✅ | ✅ | ⬜ | Outline only, snapshot-restore preview |
| Flood fill | ✅ | ✅ | ⬜ | BFS, 4-connectivity |
| Eyedropper | — | ✅ | ⬜ | Drag-and-commit with live 9×9 loupe; releases to FG (left-click) or BG (right-click); skips transparent pixels |
| Move | — | ✅ | ⬜ | Drag to reposition canvas content, snapshot-restore preview |
| Right-click background color | — | ✅ | ⬜ | All tools draw with BG color on right-click; eraser unchanged |
| Stroke interpolation | ✅ | ✅ | ✅ | Bresenham algorithm |
| Pixel-perfect filter | ✅ | ✅ | ⬜ | L-corner 3-window rule (Aseprite-style). Web: topBar/mAppBar toggle, default ON, persisted; disabled on non-freehand tools |

## Canvas

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Create / resize | ✅ | ✅ | ✅ | 1–256px, presets available, 9-position anchor selector (Web) |
| Clear | ✅ | ✅ | ⬜ | RightPanel (docked) + Settings tab (mobile) |

## History

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Undo / redo | ✅ | ✅ | ✅ | Snapshot-based, dimension-aware (resize undoable on Web) |
| Document undo / redo | ✅ | ✅ | ⬜ | Snapshots the full `Document` (layer stack + counters), distinct from canvas snapshot path. Web: all undo/redo flows through this — resize emits a Document-shaped snapshot too. Not yet exposed through Apple bindings |

## Viewport

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Zoom | ✅ | ✅ | ✅ | Discrete levels + continuous |
| Pan | ✅ | ✅ | ✅ | |
| Fit to viewport | ✅ | ✅ | ✅ | |

## Color

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Color model (RGBA) | ✅ | ✅ | ✅ | Hex conversion in Core + Web |
| HSV conversion | — | ✅ | ⬜ | `rgbToHsv()` / `hsvToRgb()` |
| Color picker | — | ✅ | ✅ | Web: custom HSV picker, Apple: SwiftUI |
| Preset palette | — | ✅ | ✅ | 18 Pebble colors |
| Recent colors | — | ✅ | ⬜ | Last 12 used |
| FG/BG color swap | — | ✅ | ⬜ | Swap button + per-swatch color picker |
| Color loupe overlay | — | ✅ | ⬜ | 9×9 magnifier + hex chip during eyedropper drag (mouse) and 400ms long-press (touch); quadrant-flip keeps it visible near viewport edges |

## Rendering

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pixel rendering | — | ✅ | ✅ | Canvas2D / Metal |
| Multi-layer composite | ✅ | ✅ | ⬜ | All visible layers blended bottom-to-top with source-over alpha. Recomputed per `renderVersion` bump — caching deferred until measurement justifies it |
| Checkerboard transparency | — | ✅ | ✅ | |
| Grid overlay + toggle | — | ✅ | ✅ | Auto-hidden below 4px |

## Export

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| PNG | ✅ | ✅ | 🔧 | Apple: core ready, UI disabled |
| SVG | ✅ | ✅ | ⬜ | Apple: core ready, UI not wired |
| Export UI — desktop | — | ✅ | ⬜ | Popover: format selector, filename input, confirmation |
| Export UI — mobile | — | ✅ | — | Bottom sheet (vaul-svelte); format selector, filename input, export button |

## Input

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Mouse / trackpad | — | ✅ | ✅ | |
| Touch | — | ✅ | ✅ | Pointer Events / UITouch; Web: pinch-zoom + two-finger pan + touch deferral + long-press eyedropper |
| Apple Pencil | — | — | ✅ | |
| Keyboard shortcuts | — | ✅ | ✅ | Web: tool switch (P/E/L/U/O/F/I/V) + grid toggle (G) + undo/redo (Ctrl+Z/Y) + Alt eyedropper + Space pan + X swap colors + Shift constrain + `/` shortcut hints; Apple: undo/redo only |

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
| Session persistence | — | ✅ | ⬜ | Multi-tab IndexedDB restore, debounced auto-save, saved-doc retention, and V4 mixed-layer persistence with Reference source blobs |
| Save dialog on tab close | — | ✅ | ⬜ | Blank canvas detection, save/delete/cancel modal, focus trap, keyboard accessible |
| Saved work browser (desktop) | — | ✅ | ⬜ | Browse/open/delete saved documents; card grid with thumbnails, empty state, delete confirmation |
| Saved work browser (mobile) | — | ✅ | — | Bottom sheet (vaul-svelte); shared card grid, AppBar trigger, responsive 2/3 column grid |

## Layers

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Document/Layer model | 🔧 | 🔧 | ⬜ | Ordered mixed-kind stack with active layer, visibility, opacity, Timeline collapse state, source-over composite, and Pixel-only export composite. Apple remains single-canvas |
| Reference Layer (timeline kind) | 🔧 | 🔧 | ⬜ | Core supports tracing, export exclusion, placement, and sampling. Web round-trips persisted Reference Layers; import UI and placement overlay pending |
| Timeline panel | — | 🔧 | ⬜ | Top-z first; activate/remove/reorder/visibility are undoable. Desktop collapse state is persisted per document and not undoable. Frame column is an M4 placeholder |

## Reference Images

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Gallery store + persistence | — | ✅ | ⬜ | Per-doc reactive store; round-trips through `WorkspaceRecord.references?` (optional, absent → empty); references for closed-but-saved docs are not retained yet |
| Import pipeline | — | ✅ | ⬜ | File picker; PNG/JPEG/WebP/GIF, ≤10 MB; `createImageBitmap` decode + `OffscreenCanvas` thumbnail (256px longest edge, aspect preserved) |
| Drag-and-drop import | — | ✅ | ⬜ | Drag onto modal/sheet adds to gallery. Drag onto canvas adds AND displays each ref with cascade offsets, drop position centered on cursor (clamped so the title bar stays on-screen). Partial batches keep valid imports and surface per-file rejections |
| Browser UI | — | ✅ | ⬜ | TopBar `Images` button; ReferenceBrowser modal (wide/x-wide), ReferenceBrowserSheet (compact/medium); gallery card with thumbnail/filename/dimensions, delete confirmation, empty state, Eye/EyeOff display toggle |
| Display on canvas | — | ✅ | ⬜ | Per-instance window state (`refId`, visible, position/size, minimized, zOrder) persists through `WorkspaceRecord`. Initial placement = viewport center + cascade offset; size = `min(natural, viewport × 0.3)` on longer edge with 80px floor. Viewport shrink aspect-preservingly refits windows but does not regrow |
| Multi-window z-order + cascade | — | ✅ | ⬜ | Newly displayed/focused window goes to top of `zOrder`; topmost is `data-active`. Cascade offset 24px from viewport center per visible window; resets to 0 when all dismissed. Root pointerdown raises (close/minimize guards prevent flicker). zOrder persists through reload |
| Move + resize | — | ✅ | ⬜ | Title-bar drag updates position continuously; clamped to viewport on release (throw-and-snap-back). Resize handle (bottom-right, 44×44 hit area) clamps during drag, aspect-locked uniform scale-up with 80px floor. Both mark doc dirty so geometry survives reload |
| Minimize (window-shade) | — | ✅ | ⬜ | Title-bar minimize button + title-bar double-click toggle `minimized`. Body/resize handle removed from DOM (accessibility tree shows title bar only); pre-minimize size restored on toggle. Window remains draggable while minimized |
| Color sampling — Eyedropper | — | ✅ | ⬜ | Eyedropper tool active + tap a reference image → samples pixel into foreground. Transparent samples and decode failures are silent. Letterbox area around the image falls through to z-order activation |
| Color sampling — long-press + drag | — | ✅ | ⬜ | Tool-independent. Touch/pen long-press (400ms threshold, 8px slop) on a reference image starts a sampling session; drag re-samples; release commits via the same `colorPick + addRecentColor` path as the Eyedropper. Decoded image cached for the session so pointer-moves avoid `createImageBitmap` |
| Color sampling — long-press loupe | — | ✅ | ⬜ | Shared `<Loupe>` overlay (single instance at page root) shows the 9×9 RGBA neighborhood during reference long-press sampling — visual parity with the canvas Eyedropper loupe. Reuses the same `SamplingSession` via a reference-side `SamplingPort` adapter |
| Color sampling — mouse loupe parity | — | ✅ | ⬜ | Mouse press-and-drag on a reference image (Eyedropper active) engages the same sample lifecycle as touch/pen, so the loupe appears on press and tracks the cursor. Loupe positioning reuses the canvas mouse-vs-touch offset (mouse: diagonal; touch/pen: centered above) |

## UI

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Design token system | — | ✅ | ✅ | `--ds-*` tokens (web), `DesignTokens` enum (Apple), light theme |
| Pebble UI theme | — | ✅ | ⬜ | Floating panels, earth tones (web legacy; Apple removed) |
| Editor UI theme | — | ✅ | ✅ | `--ds-*` tokens, docked layout skeleton (Apple); TopBar + LeftToolbar + RightPanel + StatusBar all implemented |
| Responsive layout | — | ✅ | ⬜ | 4 breakpoints: compact/medium/wide/x-wide via matchMedia + CSS Grid/Flex |
| Toolbar tooltip | — | ✅ | ⬜ | Custom styled tooltip on hover (tool name + shortcut badge), Svelte action, GeistPixel-Square font |
| Tab bar slide indicator | — | ✅ | ⬜ | ease-in-out-cubic 180ms, pure CSS `--active-index` |
| Landing page | — | ✅ | — | Hero (+ editor mockup) / Features / Roadmap sections, nav with GitHub link, i18n (EN/KO/JA), responsive at 600/1024px, `--ds-*` tokens |
| Safe area handling | — | ✅ | ⬜ | `viewport-fit=cover` + `env(safe-area-inset-*)` on all routes |
