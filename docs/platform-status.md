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
| Eyedropper | — | ✅ | ⬜ | Drag-and-commit with live 9×9 loupe (hatched out-of-canvas + checkerboard transparent cells); releases to FG (left-click) or BG (right-click); skips transparent pixels |
| Move | — | ✅ | ⬜ | Drag to reposition canvas content, snapshot-restore preview, `move` cursor |
| Right-click background color | — | ✅ | ⬜ | All tools draw with BG color on right-click; eraser unchanged |
| Stroke interpolation | ✅ | ✅ | ✅ | Bresenham algorithm |
| Pixel-perfect filter | ✅ | ✅ | ⬜ | L-corner 3-window rule (Aseprite-style); stateless with `TailState` carry; WASM + UniFFI bindings exported. Web: pencil/eraser strokes wired through `createPixelPerfectOps` decorator; topBar/mAppBar toggle with IndexedDB-persisted preference (default ON), disabled on non-freehand tools |

## Canvas

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Create / resize | ✅ | ✅ | ✅ | 1–256px, presets available, 9-position anchor selector (Web) |
| Clear | ✅ | ✅ | ⬜ | RightPanel (docked) + Settings tab (mobile) |

## History

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Undo / redo | ✅ | ✅ | ✅ | Snapshot-based, dimension-aware (resize undoable on Web) |

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
| Color loupe overlay | — | ✅ | ⬜ | 9×9 magnifier + hex chip during eyedropper drag (mouse) and 400ms long-press (touch) with quadrant-flip positioning (stays fully visible near viewport edges) |

## Rendering

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Pixel rendering | — | ✅ | ✅ | Canvas2D / Metal |
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
| Session persistence | — | ✅ | ⬜ | Multi-tab save/restore via IndexedDB; debounced auto-save with per-document dirty tracking; versioned document schema (V1/V2) with `saved` flag — saved documents survive tab close |
| Save dialog on tab close | — | ✅ | ⬜ | Blank canvas detection, save/delete/cancel modal, focus trap, keyboard accessible |
| Saved work browser (desktop) | — | ✅ | ⬜ | Browse/open/delete saved documents; card grid with thumbnails, empty state, delete confirmation |
| Saved work browser (mobile) | — | ✅ | — | Bottom sheet (vaul-svelte); shared card grid, AppBar trigger, responsive 2/3 column grid |

## Reference Images

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Gallery store + persistence | — | ✅ | ⬜ | Per-doc reactive store; round-trips through `WorkspaceRecord.references?` (optional, absent → empty); references for closed-but-saved docs are not retained yet |
| Import pipeline | — | ✅ | ⬜ | File picker; PNG/JPEG/WebP/GIF, ≤10 MB; `createImageBitmap` decode + `OffscreenCanvas` thumbnail (256px longest edge, aspect preserved) |
| Browser UI | — | ✅ | ⬜ | TopBar `Images` button; ReferenceBrowser modal (wide/x-wide), ReferenceBrowserSheet (compact/medium); gallery card with thumbnail/filename/dimensions, delete confirmation, empty state, Eye/EyeOff display toggle |
| Display on canvas | — | ✅ | ⬜ | `DisplayState` per-instance record (refId, visible, x/y/w/h, minimized, zOrder) round-trips through `WorkspaceRecord.displayStates?` (optional, absent → empty); `ReferenceWindowOverlay` mounts above canvas/below editor chrome; pointer-absorb on window, pass-through on overlay container; initial placement = viewport center + cascade offset, size = `min(natural, viewport×0.3)` on longer edge with shared `MIN_WINDOW_EDGE = 80` floor and viewport upper-bound cap; render-time fit clamps oversized/off-screen windows into viewport without mutating stored placement (responsive) |
| Multi-window z-order + cascade | — | ✅ | ⬜ | `store.display()` and `store.show()` bump `zOrder` above the current max so the most recently displayed/focused window is on top; overlay sorts by `zOrder` and marks the top one `data-active="true"`; `store.nextCascadeIndex(docId)` returns count of currently visible windows so cascade offsets `index × 24px` from the viewport center and resets to 0 once all windows are dismissed; window root `pointerdown` raises via `store.show()` with `.title-bar-button` guard (close/minimize don't flicker-raise); resize-handle pointerdown bubbles to root so resize also raises; clicking an already-displayed gallery card raises that window then closes the modal (explicit "show" action); `zOrder` persists through reload via `displayStatesSnapshot`/`restoredDisplayStates` |
| Move + resize | — | ✅ | ⬜ | Title-bar drag (PointerEvents, X-button guard) updates `DisplayState.x/y` continuously and clamps to viewport on release via `clampPosition`; bottom-right handle resize via `computeResize` (dominant-axis aspect-locked, uniform scale-up to `MIN_WINDOW_EDGE` floor); 44×44 hit area on the handle (`::before`) with subtle two-line diagonal grip (`::after`, `--ds-text-tertiary`); store mutators `setDisplayPosition`/`setDisplaySize` mark the doc dirty for auto-save so position/size survive reload |
| Minimize (window-shade) | — | ✅ | ⬜ | Title-bar minimize button (`ChevronUp`/`ChevronDown` toggling icon) and double-click on title bar both flip `DisplayState.minimized` via `store.setMinimized`; body and resize handle removed from DOM via `{#if !minimized}` so the accessibility tree shows only the title bar; container `style:height` switches to `auto`, `data-minimized` attribute drops the title-bar `border-bottom` for a clean pill silhouette; minimized window remains draggable; pre-minimize size restored on toggle (no x/y/w/h mutation); `closest('button')` guard on dblclick mirrors the pointerdown shield so dblclicks on the close/minimize buttons don't double-toggle |

## UI

| Feature | Core | Web | Apple | Notes |
|---------|------|-----|-------|-------|
| Design token system | — | ✅ | ✅ | `--ds-*` tokens (web), `DesignTokens` enum (Apple), light theme |
| Pebble UI theme | — | ✅ | ⬜ | Floating panels, earth tones (web legacy; Apple removed) |
| Editor UI theme | — | ✅ | 🔧 | `--ds-*` tokens, docked layout skeleton (Apple); TopBar + LeftToolbar implemented, RightPanel + StatusBar are placeholders |
| Responsive layout | — | ✅ | ⬜ | 4 breakpoints: compact/medium/wide/x-wide via matchMedia + CSS Grid/Flex |
| Toolbar tooltip | — | ✅ | ⬜ | Custom styled tooltip on hover (tool name + shortcut badge), Svelte action, GeistPixel-Square font |
| Tab bar slide indicator | — | ✅ | ⬜ | ease-in-out-cubic 180ms, pure CSS `--active-index` |
| Landing page | — | ✅ | — | Hero (+ editor mockup) / Features / Roadmap sections, nav with GitHub link, i18n (EN/KO/JA), responsive at 600/1024px, `--ds-*` tokens |
| Safe area handling | — | ✅ | ⬜ | `viewport-fit=cover` + `env(safe-area-inset-*)` on all routes |
